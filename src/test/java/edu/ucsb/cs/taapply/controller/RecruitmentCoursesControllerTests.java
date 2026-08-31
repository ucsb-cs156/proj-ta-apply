package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.RecruitmentCoursesController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class RecruitmentCoursesControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean UserRepository userRepository;

  private static RecruitmentCourse rc(long id, String courseId, String section, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(courseId)
        .section(section)
        .enrollCode("EC" + id)
        .removed(removed)
        .build();
  }

  // ---- GET /api/recruitmentcourses/all ----

  @Test
  public void logged_out_users_cannot_list() throws Exception {
    mockMvc.perform(get("/api/recruitmentcourses/all?recruitmentId=7")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_list() throws Exception {
    mockMvc.perform(get("/api/recruitmentcourses/all?recruitmentId=7")).andExpect(status().is(403));
  }

  /** Removed rows are an admin's decision to hide something; they do not show unless asked for. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void removed_courses_are_hidden_by_default() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(rc(1L, "CMPSC   156", "0100", false), rc(2L, "CMPSC   130A", "0100", true)));

    MvcResult response =
        mockMvc
            .perform(get("/api/recruitmentcourses/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(rc(1L, "CMPSC   156", "0100", false))),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void includeRemoved_shows_them_as_well() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(rc(1L, "CMPSC   156", "0100", false), rc(2L, "CMPSC   130A", "0100", true)));

    MvcResult response =
        mockMvc
            .perform(get("/api/recruitmentcourses/all?recruitmentId=7&includeRemoved=true"))
            .andExpect(status().isOk())
            .andReturn();

    // Sorted by course id, so 130A precedes 156.
    assertEquals(
        mapper.writeValueAsString(
            List.of(rc(2L, "CMPSC   130A", "0100", true), rc(1L, "CMPSC   156", "0100", false))),
        response.getResponse().getContentAsString());
  }

  /** A course's lectures sit together, in section order. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void courses_sort_by_course_id_then_section() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(
                rc(1L, "CMPSC   156", "0200", false),
                rc(2L, "CMPSC     1A", "0100", false),
                rc(3L, "CMPSC   156", "0100", false)));

    MvcResult response =
        mockMvc
            .perform(get("/api/recruitmentcourses/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(
            List.of(
                rc(2L, "CMPSC     1A", "0100", false),
                rc(3L, "CMPSC   156", "0100", false),
                rc(1L, "CMPSC   156", "0200", false))),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_null_section_does_not_break_the_sort() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(rc(1L, "CMPSC   156", "0100", false), rc(2L, "CMPSC   156", null, false)));

    mockMvc.perform(get("/api/recruitmentcourses/all?recruitmentId=7")).andExpect(status().isOk());
  }

  // ---- PUT /api/recruitmentcourses/removed ----

  @Test
  public void logged_out_users_cannot_change_removed() throws Exception {
    mockMvc
        .perform(put("/api/recruitmentcourses/removed?id=1&removed=true").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_removed() throws Exception {
    mockMvc
        .perform(put("/api/recruitmentcourses/removed?id=1&removed=true").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_remove_a_course() throws Exception {
    RecruitmentCourse course = rc(1L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));

    mockMvc
        .perform(put("/api/recruitmentcourses/removed?id=1&removed=true").with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertTrue(captor.getValue().isRemoved());
  }

  /** A removal made by mistake has to be reversible, which is why this is not a delete. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_put_a_removed_course_back() throws Exception {
    RecruitmentCourse course = rc(1L, "CMPSC   156", "0100", true);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));

    MvcResult response =
        mockMvc
            .perform(put("/api/recruitmentcourses/removed?id=1&removed=false").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertEquals(false, captor.getValue().isRemoved());
    assertEquals(
        mapper.writeValueAsString(rc(1L, "CMPSC   156", "0100", false)),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_removed_on_an_unknown_course_is_a_404() throws Exception {
    when(recruitmentCourseRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(put("/api/recruitmentcourses/removed?id=99&removed=true").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(recruitmentCourseRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
  }
}
