package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.repository.CourseRepository;
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

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.CoursesController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class CoursesControllerTests extends ControllerTestCase {

  @MockitoBean CourseRepository courseRepository;
  @MockitoBean UserRepository userRepository;

  private static Course course(String id, String title, boolean ta, boolean ula) {
    return Course.builder().courseId(id).title(title).needsTa(ta).needsUla(ula).build();
  }

  // ---- GET /api/courses/all ----

  @Test
  public void logged_out_users_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/courses/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/courses/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void grad_students_cannot_get_all() throws Exception {
    mockMvc.perform(get("/api/courses/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_get_all_courses() throws Exception {
    List<Course> expected =
        List.of(
            course("CMPSC   130A", "Data Structures", false, true),
            course("CMPSC   156", "ADV APP PROGRAM", true, false));
    when(courseRepository.findAll()).thenReturn(expected);

    MvcResult response =
        mockMvc.perform(get("/api/courses/all")).andExpect(status().isOk()).andReturn();

    verify(courseRepository, times(1)).findAll();
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  // ---- PUT /api/courses/flags ----

  @Test
  public void logged_out_users_cannot_update_flags() throws Exception {
    mockMvc
        .perform(
            put("/api/courses/flags?courseId=CMPSC   156&needsTa=true&needsUla=false").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_update_flags() throws Exception {
    mockMvc
        .perform(
            put("/api/courses/flags?courseId=CMPSC   156&needsTa=true&needsUla=false").with(csrf()))
        .andExpect(status().is(403));
    verify(courseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_set_both_flags() throws Exception {
    Course existing = course("CMPSC   156", "ADV APP PROGRAM", false, false);
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.of(existing));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/courses/flags?courseId=CMPSC   156&needsTa=true&needsUla=true")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository, times(1)).save(captor.capture());
    assertEquals(true, captor.getValue().isNeedsTa());
    assertEquals(true, captor.getValue().isNeedsUla());
    assertEquals(
        mapper.writeValueAsString(course("CMPSC   156", "ADV APP PROGRAM", true, true)),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_clear_a_flag() throws Exception {
    Course existing = course("CMPSC   156", "ADV APP PROGRAM", true, true);
    when(courseRepository.findByCourseId("CMPSC   156")).thenReturn(Optional.of(existing));

    mockMvc
        .perform(
            put("/api/courses/flags?courseId=CMPSC   156&needsTa=false&needsUla=true").with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
    verify(courseRepository, times(1)).save(captor.capture());
    assertEquals(false, captor.getValue().isNeedsTa());
    assertEquals(true, captor.getValue().isNeedsUla());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void updating_flags_on_an_unknown_course_is_a_404() throws Exception {
    when(courseRepository.findByCourseId("CMPSC   999")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/courses/flags?courseId=CMPSC   999&needsTa=true&needsUla=false")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(courseRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Course with id CMPSC   999 not found", json.get("message"));
  }

  /**
   * Course ids keep the API's fixed-width padding, so lexical order is numeric order. The
   * controller sorts in Java rather than with an ORDER BY, because Postgres' default collation can
   * treat spaces as negligible and would put 100 and 130A ahead of 9 and 24.
   */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void courses_come_back_in_numeric_course_number_order() throws Exception {
    when(courseRepository.findAll())
        .thenReturn(
            List.of(
                course("CMPSC   156", "Adv App Programming", false, false),
                course("CMPSC     9", "Intro", false, false),
                course("CMPSC   130A", "Data Structures", false, false),
                course("CMPSC    24", "Problem Solving", false, false),
                course("CMPSC     1A", "Seminar", false, false),
                course("CMPSC   100", "Ethics", false, false)));

    MvcResult response =
        mockMvc.perform(get("/api/courses/all")).andExpect(status().isOk()).andReturn();

    List<Course> expected =
        List.of(
            course("CMPSC     1A", "Seminar", false, false),
            course("CMPSC     9", "Intro", false, false),
            course("CMPSC    24", "Problem Solving", false, false),
            course("CMPSC   100", "Ethics", false, false),
            course("CMPSC   130A", "Data Structures", false, false),
            course("CMPSC   156", "Adv App Programming", false, false));

    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }
}
