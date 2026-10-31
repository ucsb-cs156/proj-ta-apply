package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.PublishedAssignmentsService;
import edu.ucsb.cs.taapply.services.PublishedAssignmentsService.Table;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AssignmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class AssignmentsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean PublishedAssignmentsService publishedAssignmentsService;
  @MockitoBean UserRepository userRepository;

  private static final Recruitment PUBLISHED =
      Recruitment.builder()
          .id(7L)
          .quarter("20264")
          .type(RecruitmentType.TA)
          .assignmentsPublished(true)
          .build();

  private static final Table TABLE =
      new Table(
          7L,
          RecruitmentType.TA,
          "course",
          List.of("Course", "Instructor", "Instructor email", "TA"),
          List.of(
              List.of("CMPSC 8", "CONRAD P", "pconrad@ucsb.edu", "Ada Lovelace (ada@ucsb.edu)")));

  private static final String CSV =
      "\"Course\",\"Instructor\",\"Instructor email\",\"TA\"\n"
          + "\"CMPSC 8\",\"CONRAD P\",\"pconrad@ucsb.edu\",\"Ada Lovelace (ada@ucsb.edu)\"\n";

  // ---- GET /api/assignments ----

  @Test
  public void logged_out_users_cannot_see_assignments() throws Exception {
    mockMvc
        .perform(get("/api/assignments?recruitmentId=7&layout=course"))
        .andExpect(status().is(403));
    verify(publishedAssignmentsService, never()).table(any(), any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void students_cannot_see_assignments() throws Exception {
    mockMvc
        .perform(get("/api/assignments?recruitmentId=7&layout=course"))
        .andExpect(status().is(403));
    verify(publishedAssignmentsService, never()).table(any(), any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_get_the_table() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(PUBLISHED));
    when(publishedAssignmentsService.table(PUBLISHED, "course")).thenReturn(TABLE);

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments?recruitmentId=7&layout=course"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(TABLE), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_get_the_table_in_the_layout_they_ask_for() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(PUBLISHED));
    when(publishedAssignmentsService.table(PUBLISHED, "student")).thenReturn(TABLE);

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments?recruitmentId=7&layout=student"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(TABLE), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments?recruitmentId=99&layout=course"))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 99 not found", json.get("message"));
    verify(publishedAssignmentsService, never()).table(any(), any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void unpublished_assignments_are_a_400_with_the_service_message() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(PUBLISHED));
    when(publishedAssignmentsService.table(PUBLISHED, "course"))
        .thenThrow(
            new IllegalArgumentException("Assignments for recruitment 7 have not been published"));

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments?recruitmentId=7&layout=course"))
            .andExpect(status().isBadRequest())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("IllegalArgumentException", json.get("type"));
    assertEquals("Assignments for recruitment 7 have not been published", json.get("message"));
  }

  // ---- GET /api/assignments/csv ----

  @Test
  public void logged_out_users_cannot_download_the_csv() throws Exception {
    mockMvc
        .perform(get("/api/assignments/csv?recruitmentId=7&layout=course"))
        .andExpect(status().is(403));
    verify(publishedAssignmentsService, never()).csv(any(), any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void students_cannot_download_the_csv() throws Exception {
    mockMvc
        .perform(get("/api/assignments/csv?recruitmentId=7&layout=student"))
        .andExpect(status().is(403));
    verify(publishedAssignmentsService, never()).csv(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_download_the_csv_named_after_the_recruitment_and_layout() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(PUBLISHED));
    when(publishedAssignmentsService.csv(PUBLISHED, "course")).thenReturn(CSV);

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments/csv?recruitmentId=7&layout=course"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(CSV, response.getResponse().getContentAsString());
    assertEquals(
        "attachment; filename=\"assignments-7-course.csv\"",
        response.getResponse().getHeader("Content-Disposition"));
    assertEquals("text/csv;charset=UTF-8", response.getResponse().getContentType());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_download_the_csv_in_either_layout() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(PUBLISHED));
    when(publishedAssignmentsService.csv(PUBLISHED, "student")).thenReturn(CSV);

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments/csv?recruitmentId=7&layout=student"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(CSV, response.getResponse().getContentAsString());
    assertEquals(
        "attachment; filename=\"assignments-7-student.csv\"",
        response.getResponse().getHeader("Content-Disposition"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_csv_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(get("/api/assignments/csv?recruitmentId=99&layout=course"))
        .andExpect(status().isNotFound());
    verify(publishedAssignmentsService, never()).csv(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_csv_of_unpublished_assignments_is_a_400() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(PUBLISHED));
    when(publishedAssignmentsService.csv(PUBLISHED, "course"))
        .thenThrow(new IllegalArgumentException("layout must be course or student"));

    MvcResult response =
        mockMvc
            .perform(get("/api/assignments/csv?recruitmentId=7&layout=course"))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals("layout must be course or student", responseToJson(response).get("message"));
  }
}
