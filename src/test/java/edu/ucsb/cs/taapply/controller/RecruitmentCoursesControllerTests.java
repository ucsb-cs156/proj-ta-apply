package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbInstructor;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.models.UcsbTimeLocation;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
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
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UCSBCurriculumService ucsbCurriculumService;
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

  // ---- POST /api/recruitmentcourses/post (issue #125) ----

  private static final Recruitment RECRUITMENT =
      Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();

  private static UcsbSection section(String enrollCode, String number, String instructor) {
    return UcsbSection.builder()
        .enrollCode(enrollCode)
        .section(number)
        .enrolledTotal(100)
        .maxEnroll(120)
        .instructors(List.of(UcsbInstructor.builder().instructor(instructor).build()))
        .timeLocations(
            List.of(
                UcsbTimeLocation.builder()
                    .days("T R")
                    .beginTime("14:00")
                    .endTime("15:15")
                    .building("PHELP")
                    .room("3526")
                    .build()))
        .build();
  }

  private static UcsbCourseOffering offering156() {
    return UcsbCourseOffering.builder()
        .courseId("CMPSC 156  ")
        .title("ADV APP PROGRAM")
        .classSections(
            List.of(section("07492", "0100", "CONRAD P"), section("07500", "0101", "GAUCHO C")))
        .build();
  }

  @Test
  public void logged_out_users_cannot_add_by_enroll_code() throws Exception {
    mockMvc
        .perform(post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=07492").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_add_by_enroll_code() throws Exception {
    mockMvc
        .perform(post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=07492").with(csrf()))
        .andExpect(status().is(403));
  }

  /** A lecture of a course that is not flagged, and not even in the courses table, can be added. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_add_a_lecture_by_enroll_code() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(ucsbCurriculumService.getOffering("20261", "07492")).thenReturn(offering156());
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/recruitmentcourses/post")
                    .param("recruitmentId", "7")
                    .param("enrollCode", " 07492 ")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    RecruitmentCourse saved = captor.getValue();
    assertEquals(7L, saved.getRecruitmentId());
    assertEquals("CMPSC   156", saved.getCourseId());
    assertEquals("07492", saved.getEnrollCode());
    assertEquals("0100", saved.getSection());
    assertEquals("ADV APP PROGRAM", saved.getTitle());
    assertEquals("CONRAD P", saved.getInstructor());
    assertEquals("T R", saved.getDays());
    assertEquals("14:00 - 15:15", saved.getTime());
    assertEquals("PHELP 3526", saved.getRoom());
    assertEquals(100, saved.getEnrollment());
    assertEquals(120, saved.getMaxEnroll());
    assertEquals("open", saved.getStatus());
    assertTrue(saved.isManuallyAdded());
    assertFalse(saved.isRemoved());
    assertFalse(saved.isStale());
    assertEquals(mapper.writeValueAsString(saved), response.getResponse().getContentAsString());
  }

  /** Adding a lecture that is already there, removed and stale, refreshes it and puts it back. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void adding_an_existing_removed_row_puts_it_back_refreshed() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(ucsbCurriculumService.getOffering("20261", "07492")).thenReturn(offering156());
    RecruitmentCourse existing = rc(3L, "CMPSC   156", "0100", true);
    existing.setEnrollCode("07492");
    existing.setStale(true);
    existing.setInstructor("OLD NAME");
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(7L, "07492"))
        .thenReturn(Optional.of(existing));

    mockMvc
        .perform(post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=07492").with(csrf()))
        .andExpect(status().isOk());

    verify(recruitmentCourseRepository, times(1)).save(existing);
    assertEquals(3L, existing.getId(), "same row, not a duplicate");
    assertEquals("CONRAD P", existing.getInstructor());
    assertFalse(existing.isRemoved());
    assertFalse(existing.isStale());
    assertTrue(existing.isManuallyAdded());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_secondary_section_cannot_be_added() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(ucsbCurriculumService.getOffering("20261", "07500")).thenReturn(offering156());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=07500").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "Enroll code 07500 is section 0101, a discussion or lab; only lectures (section numbers"
            + " ending in 00) can be added",
        responseToJson(response).get("message"));
    verify(recruitmentCourseRepository, never()).save(any());
  }

  /** The API answers with the whole offering; the code must be one of its sections. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_enroll_code_the_offering_does_not_contain_is_refused() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(ucsbCurriculumService.getOffering("20261", "99999")).thenReturn(offering156());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=99999").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "The UCSB API has no section with enroll code 99999 in quarter 20261",
        responseToJson(response).get("message"));
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_offering_without_sections_or_a_null_answer_is_refused() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(ucsbCurriculumService.getOffering("20261", "11111"))
        .thenReturn(UcsbCourseOffering.builder().courseId("CMPSC 156").build());
    when(ucsbCurriculumService.getOffering("20261", "22222")).thenReturn(null);

    mockMvc
        .perform(post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=11111").with(csrf()))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=22222").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentCourseRepository, never()).save(any());
  }

  /** The API refusing the code (a 404 upstream, say) is a plain 400 for the admin. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_api_error_is_reported_as_an_unknown_enroll_code() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(ucsbCurriculumService.getOffering("20261", "00000"))
        .thenThrow(new RuntimeException("404 Not Found"));

    MvcResult response =
        mockMvc
            .perform(
                post("/api/recruitmentcourses/post?recruitmentId=7&enrollCode=00000").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "The UCSB API has no section with enroll code 00000 in quarter 20261",
        responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void adding_to_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(
            post("/api/recruitmentcourses/post?recruitmentId=99&enrollCode=07492").with(csrf()))
        .andExpect(status().isNotFound());
    verify(ucsbCurriculumService, never()).getOffering(any(), any());
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

  // ---- PUT /api/recruitmentcourses/allocation (issue #174) ----

  @Test
  public void logged_out_users_cannot_change_an_allocation() throws Exception {
    mockMvc
        .perform(put("/api/recruitmentcourses/allocation?id=1&allocation=2").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_an_allocation() throws Exception {
    mockMvc
        .perform(put("/api/recruitmentcourses/allocation?id=1&allocation=2").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @Test
  public void a_new_row_has_no_allocation_yet() {
    assertEquals(0, rc(1L, "CMPSC   156", "0100", false).getAllocation());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_set_an_allocation() throws Exception {
    RecruitmentCourse course = rc(1L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));

    MvcResult response =
        mockMvc
            .perform(put("/api/recruitmentcourses/allocation?id=1&allocation=3").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<RecruitmentCourse> captor = ArgumentCaptor.forClass(RecruitmentCourse.class);
    verify(recruitmentCourseRepository, times(1)).save(captor.capture());
    assertEquals(3, captor.getValue().getAllocation());
    RecruitmentCourse expected = rc(1L, "CMPSC   156", "0100", false);
    expected.setAllocation(3);
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_allocation_can_be_set_back_to_zero() throws Exception {
    RecruitmentCourse course = rc(1L, "CMPSC   156", "0100", false);
    course.setAllocation(4);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));

    mockMvc
        .perform(put("/api/recruitmentcourses/allocation?id=1&allocation=0").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(0, course.getAllocation());
    verify(recruitmentCourseRepository, times(1)).save(course);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_negative_allocation_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(put("/api/recruitmentcourses/allocation?id=1&allocation=-1").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    verify(recruitmentCourseRepository, never()).findById(any());
    verify(recruitmentCourseRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("allocation must not be negative", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_allocation_that_is_not_a_number_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/recruitmentcourses/allocation?id=1&allocation=two").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_the_allocation_of_an_unknown_course_is_a_404() throws Exception {
    when(recruitmentCourseRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(put("/api/recruitmentcourses/allocation?id=99&allocation=1").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(recruitmentCourseRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
  }
}
