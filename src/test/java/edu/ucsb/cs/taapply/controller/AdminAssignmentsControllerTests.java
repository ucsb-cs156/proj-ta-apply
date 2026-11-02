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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.OtherClient;
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
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AdminAssignmentsController.class)
@Import(DraftApplicationsControllerTests.DetectorConfig.class)
class AdminAssignmentsControllerTests extends ControllerTestCase {
  private static final String CLIENT_ID = "X-Client-Id";

  @org.springframework.beans.factory.annotation.Autowired
  DraftApplicationsControllerTests.ResettableDetector detector;

  @org.junit.jupiter.api.BeforeEach
  void forgetWhoWasThere() {
    detector.reset();
  }

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
                  Map.of(10L, "1st Choice"))),
          3);

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
            put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10&version=3")
                .with(csrf()))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(post("/api/admin/assignments/heartbeat?recruitmentId=7").with(csrf()))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(post("/api/admin/assignments/leave?recruitmentId=7").with(csrf()))
        .andExpect(status().isForbidden());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).bumpAssignmentsVersionIf(any(), any());
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
    when(recruitmentRepository.bumpAssignmentsVersionIf(7L, 3)).thenReturn(1);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10&version=3")
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
    when(recruitmentRepository.bumpAssignmentsVersionIf(7L, 3)).thenReturn(1);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/assignments/tentative?applicationId=1&version=3").with(csrf()))
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
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10&version=3")
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
                put("/api/admin/assignments/tentative?applicationId=99&recruitmentCourseId=10&version=3")
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
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=99&version=3")
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
    when(recruitmentRepository.bumpAssignmentsVersionIf(7L, 3)).thenReturn(1);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10&version=3")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 7 not found", responseToJson(response).get("message"));
    verify(assignmentsService, never()).assignments(any());
  }

  // ---- the version check (issue #280) ----

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void a_stale_assignment_is_409_with_the_current_page_and_nothing_is_saved() throws Exception {
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application(1L, 7L, null)));
    when(recruitmentCourseRepository.findById(10L)).thenReturn(Optional.of(course(10L, 7L)));
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(PAGE);
    when(recruitmentRepository.bumpAssignmentsVersionIf(7L, 2)).thenReturn(0);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10&version=2")
                    .with(csrf()))
            .andExpect(status().isConflict())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals(
        "Assignments changed while you were working. The page has been refreshed; please check the"
            + " placement and try again.",
        json.get("message"));
    assertEquals(
        mapper.readValue(mapper.writeValueAsString(PAGE), Map.class), json.get("assignments"));
    verify(applicationRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void an_assignment_without_a_version_is_400() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/assignments/tentative?applicationId=1&recruitmentCourseId=10")
                .with(csrf()))
        .andExpect(status().isBadRequest());
    verify(applicationRepository, never()).save(any());
  }

  // ---- the multi-tab warning (issue #280) ----

  private org.springframework.test.web.servlet.ResultActions heartbeatAs(
      long recruitmentId, String clientId) throws Exception {
    var request =
        post("/api/admin/assignments/heartbeat?recruitmentId=" + recruitmentId).with(csrf());
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  private org.springframework.test.web.servlet.ResultActions leaveAs(
      long recruitmentId, String clientId) throws Exception {
    var request = post("/api/admin/assignments/leave?recruitmentId=" + recruitmentId).with(csrf());
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  @Test
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  void an_admin_sees_the_other_admins_working_on_the_same_recruitment() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    detector.record(
        "assignments:7",
        "other-admin-tab",
        new ClientIdentity("phtcon@ucsb.edu", "phtcon@ucsb.edu (Phill Conrad)"));

    heartbeatAs(7L, "my-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("phtcon@ucsb.edu (Phill Conrad)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false))
        .andExpect(jsonPath("$.heartbeatSeconds").value(5))
        .andExpect(jsonPath("$.newest").value(true));
  }

  @Test
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  void an_admins_own_other_tab_is_marked_as_the_same_person() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));

    heartbeatAs(7L, "first-tab").andExpect(jsonPath("$.others.length()").value(0));
    heartbeatAs(7L, "second-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("admin@example.org (Fake admin)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
  }

  @Test
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  void a_save_counts_as_being_there_and_other_recruitments_never_warn() throws Exception {
    Application application = application(1L, 7L, null);
    when(applicationRepository.findById(1L)).thenReturn(Optional.of(application));
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    when(recruitmentRepository.findById(8L))
        .thenReturn(
            Optional.of(
                Recruitment.builder().id(8L).quarter("20264").type(RecruitmentType.ULA).build()));
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(PAGE);
    when(recruitmentRepository.bumpAssignmentsVersionIf(7L, 3)).thenReturn(1);

    mockMvc
        .perform(
            put("/api/admin/assignments/tentative?applicationId=1&version=3")
                .header(CLIENT_ID, "saving-tab")
                .with(csrf()))
        .andExpect(status().isOk());

    heartbeatAs(7L, "idle-tab").andExpect(jsonPath("$.others.length()").value(1));
    heartbeatAs(8L, "idle-tab").andExpect(jsonPath("$.others.length()").value(0));
  }

  @Test
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  void a_tab_that_leaves_is_forgotten_at_once() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    heartbeatAs(7L, "staying-tab");
    heartbeatAs(7L, "leaving-tab").andExpect(jsonPath("$.others.length()").value(1));

    leaveAs(7L, "leaving-tab").andExpect(status().isNoContent());

    heartbeatAs(7L, "staying-tab").andExpect(jsonPath("$.others.length()").value(0));
  }

  @Test
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  void a_heartbeat_or_goodbye_for_a_missing_recruitment_is_404_and_records_nothing()
      throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    heartbeatAs(99L, "lost-tab").andExpect(status().isNotFound());
    leaveAs(99L, "lost-tab").andExpect(status().isNotFound());

    assertEquals(List.of(), detector.othersActive("assignments:99", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_caller_without_access_is_403_and_nothing_is_recorded_told_or_removed() throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    detector.record(
        "assignments:7",
        "admins-tab",
        new ClientIdentity("phtcon@ucsb.edu", "phtcon@ucsb.edu (Phill Conrad)"));

    var result = heartbeatAs(7L, "intruder").andExpect(status().isForbidden()).andReturn();
    leaveAs(7L, "admins-tab").andExpect(status().isForbidden());
    mockMvc
        .perform(
            put("/api/admin/assignments/tentative?applicationId=1&version=3")
                .header(CLIENT_ID, "intruder")
                .with(csrf()))
        .andExpect(status().isForbidden());

    assertEquals(false, result.getResponse().getContentAsString().contains("Phill Conrad"));
    // Only the admin's tab is there: the intruder left no mark and the admin was not removed.
    assertEquals(
        List.of(new OtherClient("phtcon@ucsb.edu (Phill Conrad)", false)),
        detector.othersActive("assignments:7", "observer"));
  }

  /** A signed-in admin whose account has the given name, or none. */
  private static org.springframework.test.web.servlet.request.RequestPostProcessor adminNamed(
      String email, String name) {
    return org.springframework.security.test.web.servlet.request
        .SecurityMockMvcRequestPostProcessors.oauth2Login()
        .authorities(
            new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))
        .attributes(
            attributes -> {
              attributes.put("sub", "sub-" + email);
              attributes.put("email", email);
              if (name != null) {
                attributes.put("name", name);
              }
            });
  }

  @Test
  void an_admin_is_labelled_by_the_email_and_the_trimmed_name_or_the_email_alone()
      throws Exception {
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    String[][] admins = {
      {"named@ucsb.edu", "  Nora Named  ", "named@ucsb.edu (Nora Named)"},
      {"nameless@ucsb.edu", null, "nameless@ucsb.edu"},
      {"blank@ucsb.edu", "   ", "blank@ucsb.edu"},
    };
    for (String[] admin : admins) {
      detector.reset();
      mockMvc
          .perform(
              post("/api/admin/assignments/heartbeat?recruitmentId=7")
                  .header(CLIENT_ID, "tab")
                  .with(adminNamed(admin[0], admin[1]))
                  .with(csrf()))
          .andExpect(status().isOk());
      assertEquals(
          List.of(new OtherClient(admin[2], false)), detector.othersActive("assignments:7", "x"));
    }
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
