package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import edu.ucsb.cs.taapply.services.AssignmentsService.AssignmentRow;
import edu.ucsb.cs.taapply.services.AssignmentsService.Assignments;
import edu.ucsb.cs.taapply.services.AssignmentsService.CourseSummary;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AdminAssignmentsController.class)
class AdminAssignmentsControllerTests extends ControllerTestCase {
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean AssignmentsService assignmentsService;

  private static final Recruitment RECRUITMENT =
      Recruitment.builder().id(7L).quarter("20264").type(RecruitmentType.TA).build();

  private static final Assignments PAGE =
      new Assignments(
          7L,
          RecruitmentType.TA,
          List.of("firstName", "lastName", "email"),
          List.of(new CourseSummary(10L, "CMPSC    16", "0100", "100", 2, 1, 1, false)),
          List.of(
              new AssignmentRow(
                  1L,
                  Map.of("firstName", "Ada", "lastName", "Lovelace", "email", "a@ucsb.edu"),
                  10L,
                  Map.of(10L, 3),
                  Map.of(10L, "1st Choice"))));

  private static Application application(long id, Long recruitmentId, Long tentative) {
    return Application.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .email("a@ucsb.edu")
        .tentativeAssignmentId(tentative)
        .build();
  }

  private static RecruitmentCourse course(long id, long recruitmentId) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .courseId("CMPSC    16")
        .section("0100")
        .build();
  }

  // ---- access ----

  @Test
  void logged_out_users_are_refused() throws Exception {
    forbidden();
  }

  @Test
  @WithMockUser(roles = {"USER"})
  void applicants_are_refused() throws Exception {
    forbidden();
  }

  @Test
  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  void instructors_are_refused() throws Exception {
    forbidden();
  }

  private void forbidden() throws Exception {
    mockMvc
        .perform(get("/api/admin/assignments?recruitmentId=7"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10")
                .with(csrf()))
        .andExpect(status().isForbidden());
    verify(recruitmentRepository, never()).findById(any());
    verify(applicationRepository, never()).findById(any());
    verify(applicationRepository, never()).save(any());
    verify(assignmentsService, never()).assignments(any());
  }

  // ---- GET ----

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void admin_reads_the_assignments_of_a_recruitment() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(PAGE);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/assignments?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(PAGE), response.getResponse().getContentAsString());
    verify(assignmentsService).assignments(RECRUITMENT);
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void unknown_recruitment_is_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/assignments?recruitmentId=99"))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 99 not found", json.get("message"));
    verify(assignmentsService, never()).assignments(any());
  }

  // ---- PUT /tentative ----

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void admin_assigns_an_applicant_to_a_section_and_gets_the_new_page_back() throws Exception {
    Application application = application(1L, 7L, null);
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(course(10L, 7L)));
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(PAGE);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    InOrder inOrder = inOrder(applicationRepository, assignmentsService);
    inOrder.verify(applicationRepository).save(saved.capture());
    inOrder.verify(assignmentsService).assignments(RECRUITMENT);
    assertEquals(10L, saved.getValue().getTentativeAssignmentId());
    assertEquals(1L, saved.getValue().getId());
    assertEquals(mapper.writeValueAsString(PAGE), response.getResponse().getContentAsString());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void leaving_the_section_out_clears_the_assignment_without_reading_courses() throws Exception {
    Application application = application(1L, 7L, 10L);
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application));
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(PAGE);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/assignments/tentative?applicationId=1").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository).save(saved.capture());
    assertNull(saved.getValue().getTentativeAssignmentId());
    verify(recruitmentCourseRepository, never()).findById(any());
    assertEquals(mapper.writeValueAsString(PAGE), response.getResponse().getContentAsString());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void a_section_of_another_recruitment_is_400_and_nothing_is_saved() throws Exception {
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application(1L, 7L, null)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(course(10L, 8L)));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "RecruitmentCourse 10 is not part of recruitment 7",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
    verify(assignmentsService, never()).assignments(any());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void unknown_application_is_404_and_nothing_is_saved() throws Exception {
    when(applicationRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=99&recruitmentCourseId=10")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Application with id 99 not found", json.get("message"));
    verify(recruitmentCourseRepository, never()).findById(any());
    verify(applicationRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void unknown_section_is_404_and_nothing_is_saved() throws Exception {
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application(1L, 7L, null)));
    when(recruitmentCourseRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=99")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("RecruitmentCourse with id 99 not found", json.get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void a_vanished_recruitment_after_saving_is_404() throws Exception {
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application(1L, 7L, null)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(course(10L, 7L)));
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 7 not found", responseToJson(response).get("message"));
    verify(assignmentsService, never()).assignments(any());
  }

  // ---- GET /api/admin/assignments/cancelled (issue #199) ----

  @Test
  void logged_out_users_cannot_read_cancelled_applications() throws Exception {
    mockMvc
        .perform(get("/api/admin/assignments/cancelled?recruitmentId=7"))
        .andExpect(status().is(403));
    verify(assignmentsService, never()).cancelledApplications(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  void instructors_cannot_read_cancelled_applications_here() throws Exception {
    mockMvc
        .perform(get("/api/admin/assignments/cancelled?recruitmentId=7"))
        .andExpect(status().is(403));
    verify(assignmentsService, never()).cancelledApplications(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  void admin_reads_the_cancelled_applications_of_a_recruitment() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    List<AssignmentsService.CancelledApplication> cancelled =
        List.of(
            new AssignmentsService.CancelledApplication(
                4L, "Grace", "Hopper", "grace@ucsb.edu", "Took another job"),
            new AssignmentsService.CancelledApplication(
                5L, "Alan", "Turing", "alan@ucsb.edu", null));
    when(assignmentsService.cancelledApplications(7L)).thenReturn(cancelled);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/assignments/cancelled?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(cancelled), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  void cancelled_applications_of_an_unknown_recruitment_are_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/assignments/cancelled?recruitmentId=99"))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
    verify(assignmentsService, never()).cancelledApplications(any());
  }
}
