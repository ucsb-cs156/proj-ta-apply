package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAuditService;
import edu.ucsb.cs.taapply.services.ApplicationCsvService;
import edu.ucsb.cs.taapply.services.LegacyApplicationCsvService;
import edu.ucsb.cs.taapply.services.LegacyApplicationCsvService.ImportResult;
import edu.ucsb.cs.taapply.services.LegacyUlaApplicationCsvService;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.multipart.MultipartFile;

@WebMvcTest(controllers = AdminApplicationsController.class)
@Import({
  DraftApplicationsControllerTests.DetectorConfig.class,
  edu.ucsb.cs.taapply.testconfig.TestConfig.class,
  ApplicationCsvService.class,
  ApplicationAuditService.class
})
public class AdminApplicationsControllerTests extends ControllerTestCase {

  @Autowired DraftApplicationsControllerTests.ResettableDetector detector;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;
  @MockitoBean AuditTrailRepository auditTrailRepository;
  @MockitoBean LegacyApplicationCsvService legacyApplicationCsvService;
  @MockitoBean LegacyUlaApplicationCsvService legacyUlaApplicationCsvService;

  // A save answers with the application it saved, as the real repository does.
  @BeforeEach
  public void savesAnswerWithWhatTheySaved() {
    detector.reset();
    when(applicationRepository.save(any(Application.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
  }

  private static Application application(long id, long recruitmentId, String email, boolean test) {
    return Application.builder()
        .id(id)
        .version(0)
        .recruitmentId(recruitmentId)
        .email(email)
        .status(ApplicationReviewStatus.PENDING)
        .origin(test ? ApplicationOrigin.ADMIN_TEST : ApplicationOrigin.APPLICANT)
        .submittedAt(LocalDateTime.of(2026, 4, 1, 9, 30))
        .firstName("Ada")
        .lastName("Lovelace")
        .adminComments("Looks strong")
        .build();
  }

  // ---- authorization: admins only, since these show other people's applications ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/admin/applications/all?recruitmentId=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/applications?id=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/applications/csv?recruitmentId=1")).andExpect(status().is(403));
    mockMvc
        .perform(put("/api/admin/applications/adminComments?id=1&adminComments=x").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/admin/applications?id=1&version=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void applicants_and_instructors_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/admin/applications/all?recruitmentId=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/applications?id=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/applications/csv?recruitmentId=1")).andExpect(status().is(403));
    mockMvc
        .perform(put("/api/admin/applications/adminComments?id=1&adminComments=x").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/admin/applications?id=1&version=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(applicationRepository, never()).save(any());
  }

  // ---- CSV download ----

  private static Recruitment recruitment(long id, RecruitmentType type) {
    return Recruitment.builder().id(id).quarter("20262").type(type).build();
  }

  /** The file names the recruitment, and its columns follow the recruitment's type. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_download_a_recruitment_s_applications_as_csv() throws Exception {
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.ULA)));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(
            List.of(
                application(1L, 7L, "a@ucsb.edu", false),
                application(2L, 7L, "admin@ucsb.edu", true)));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/csv?recruitmentId=7"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "text/csv"))
            .andExpect(
                header()
                    .string("Content-Disposition", "attachment; filename=\"applications-7.csv\""))
            .andReturn();

    String csv = response.getResponse().getContentAsString();
    String[] lines = csv.split("\n");
    assertEquals(3, lines.length);
    assertEquals(true, lines[0].startsWith("\"id\",\"submittedAt\",\"email\""));
    // ULA columns, so interests is the last header and the TA-only ones are absent.
    assertEquals(true, lines[0].endsWith("\"interests\""));
    assertEquals(-1, lines[0].indexOf("classLevel"));
    assertEquals(
        true,
        lines[1].startsWith("\"1\",\"2026-04-01T09:30\",\"a@ucsb.edu\",\"PENDING\",\"APPLICANT\""));
    assertEquals(
        true,
        lines[2].startsWith(
            "\"2\",\"2026-04-01T09:30\",\"admin@ucsb.edu\",\"PENDING\",\"ADMIN_TEST\""));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_ta_recruitment_downloads_with_the_ta_columns() throws Exception {
    when(recruitmentRepository.findById(8L))
        .thenReturn(Optional.of(recruitment(8L, RecruitmentType.TA)));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(8L)).thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/csv?recruitmentId=8"))
            .andExpect(status().isOk())
            .andReturn();

    String[] lines = response.getResponse().getContentAsString().split("\n");
    assertEquals(1, lines.length);
    assertEquals(true, lines[0].contains("\"classLevel\",\"residencyStatus\""));
    assertEquals(-1, lines[0].indexOf("interests"));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_csv_for_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/csv?recruitmentId=99"))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).findByRecruitmentIdOrderByIdAsc(any());
  }

  // ---- all for a recruitment ----

  /** Everything the repository returns, in its order, test applications included and flagged. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_sees_every_application_to_a_recruitment() throws Exception {
    List<Application> applications =
        List.of(
            application(1L, 7L, "a@ucsb.edu", false),
            application(2L, 7L, "admin@ucsb.edu", true),
            application(3L, 7L, "b@ucsb.edu", false));
    applications.get(0).setTentativeAssignmentId(20L);
    when(recruitmentRepository.existsById(7L)).thenReturn(true);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(applications);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(applications), response.getResponse().getContentAsString());
    // The tentative assignment (issue #179) is reported only by the admin assignments endpoint.
    assertEquals(-1, response.getResponse().getContentAsString().indexOf("entativeAssignment"));
    verify(applicationRepository, times(1)).findByRecruitmentIdOrderByIdAsc(7L);
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_recruitment_with_no_applications_is_an_empty_list() throws Exception {
    when(recruitmentRepository.existsById(7L)).thenReturn(true);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  /**
   * A missing recruitment is a 404, not an empty list, so a bad link is not mistaken for no
   * applicants.
   */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void applications_to_an_unknown_recruitment_are_a_404() throws Exception {
    when(recruitmentRepository.existsById(99L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/all?recruitmentId=99"))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).findByRecruitmentIdOrderByIdAsc(any());
  }

  // ---- one application ----

  /** Unlike the applicant's endpoint, this one is not restricted to the caller's own rows. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_read_anyone_s_application() throws Exception {
    Application application = application(5L, 7L, "someone@ucsb.edu", false);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(application));

    MvcResult response =
        mockMvc.perform(get("/api/admin/applications?id=5")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(application), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_missing_application_is_a_404() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications?id=5"))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Application with id 5 not found", responseToJson(response).get("message"));
  }

  // ---- edit, with an audit trail ----

  /** A TA application with three courses, so the coursework rule is met before and after. */
  private static Application editable() {
    Application application = application(5L, 7L, "ada@ucsb.edu", false);
    application.setMajor("Computer Science");
    application.setPriorCoursework(
        new ArrayList<>(
            List.of(
                PriorCoursework.builder().id(1L).ucsbCourse(true).courseNumber("CMPSC 8").build(),
                PriorCoursework.builder().id(2L).ucsbCourse(true).courseNumber("CMPSC 16").build(),
                PriorCoursework.builder()
                    .id(3L)
                    .ucsbCourse(true)
                    .courseNumber("CMPSC 24")
                    .build())));
    application.setTopicProficiencies(new HashMap<>(Map.of("Java", 4)));
    return application;
  }

  /** The same three courses as the form sends them, plus whatever else the test sets. */
  private String editBody(Map<String, Object> changes) throws Exception {
    Map<String, Object> body = new HashMap<>();
    body.put("firstName", "Ada");
    body.put("lastName", "Lovelace");
    body.put("major", "Computer Science");
    body.put(
        "priorCoursework",
        List.of(
            Map.of("ucsbCourse", true, "courseNumber", "CMPSC 8"),
            Map.of("ucsbCourse", true, "courseNumber", "CMPSC 16"),
            Map.of("ucsbCourse", true, "courseNumber", "CMPSC 24")));
    body.put("topicProficiencies", Map.of("Java", 4));
    body.putAll(changes);
    return mapper.writeValueAsString(body);
  }

  /**
   * A row as the edit should write it. Issue #337: the editor is the logged-in admin, whom the test
   * configuration's current user service names user@example.org under {@code @WithMockUser}.
   */
  private static AuditTrail change(
      Long ta, Long ula, String field, String oldValue, String newValue) {
    return AuditTrail.builder()
        .taApplicationId(ta)
        .ulaApplicationId(ula)
        .fieldName(field)
        .oldValue(oldValue)
        .newValue(newValue)
        .editorEmail("user@example.org")
        .build();
  }

  @SuppressWarnings("unchecked")
  private List<AuditTrail> audited() {
    ArgumentCaptor<List<AuditTrail>> captor = ArgumentCaptor.forClass(List.class);
    verify(auditTrailRepository, times(1)).saveAll(captor.capture());
    return captor.getValue();
  }

  /**
   * Issue #323: an admin edit refuses a grade that does not fit its column, saving and auditing
   * nothing.
   */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_edit_with_a_grade_over_16_characters_is_a_bad_request() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(editable()));
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.TA)));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications?id=5&version=0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        editBody(
                            Map.of(
                                "priorCoursework",
                                List.of(
                                    Map.of("ucsbCourse", true, "courseNumber", "CMPSC 8"),
                                    Map.of("ucsbCourse", true, "courseNumber", "CMPSC 16"),
                                    Map.of(
                                        "ucsbCourse",
                                        true,
                                        "courseNumber",
                                        "CMPSC 24",
                                        "grade",
                                        "x".repeat(17))))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Grade must be at most 16 characters (17 given)", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
    verify(auditTrailRepository, never()).saveAll(any());
  }

  /** Every changed field is applied and gets an audit row; unchanged ones get none. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_edit_is_saved_and_each_changed_field_is_audited() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(editable()));
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.TA)));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications?id=5&version=0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        editBody(
                            Map.of(
                                "major",
                                "Computer Engineering",
                                "gpaMajor",
                                3.5,
                                "topicProficiencies",
                                Map.of("Java", 5))))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(saved.capture());
    assertEquals("Computer Engineering", saved.getValue().getMajor());
    assertEquals(3.5, saved.getValue().getGpaMajor());
    assertEquals(Map.of("Java", 5), saved.getValue().getTopicProficiencies());
    // Untouched answers stay: the name, the courses.
    assertEquals("Lovelace", saved.getValue().getLastName());
    assertEquals(3, saved.getValue().getPriorCoursework().size());
    assertEquals(
        mapper.writeValueAsString(saved.getValue()), response.getResponse().getContentAsString());

    assertEquals(
        List.of(
            change(5L, null, "major", "Computer Science", "Computer Engineering"),
            change(5L, null, "gpaMajor", null, "3.5"),
            change(5L, null, "topicProficiencies", "{\"topic\":\"Java\",\"proficiency\":4}", null),
            change(5L, null, "topicProficiencies", null, "{\"topic\":\"Java\",\"proficiency\":5}")),
        audited());
  }

  /** Saving the same answers again changes nothing and audits nothing. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_edit_that_changes_nothing_audits_nothing() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(editable()));
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.TA)));

    mockMvc
        .perform(
            put("/api/admin/applications?id=5&version=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content(editBody(Map.of()))
                .with(csrf()))
        .andExpect(status().isOk());

    verify(applicationRepository, times(1)).save(any());
    verify(auditTrailRepository, never()).saveAll(any());
  }

  /** A ULA application's rows fill the ULA id column. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_ula_edit_is_audited_against_the_ula_application_id() throws Exception {
    // A ULA topic rating is 1 to 3, so the stored and sent ratings are on that scale.
    Application existing = editable();
    existing.setTopicProficiencies(new HashMap<>(Map.of("Java", 3)));
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.ULA)));

    mockMvc
        .perform(
            put("/api/admin/applications?id=5&version=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    editBody(Map.of("lastName", "Byron", "topicProficiencies", Map.of("Java", 3))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(List.of(change(null, 5L, "lastName", "Lovelace", "Byron")), audited());
  }

  /** The coursework minimum is kept; the notice agreement rule is not the admin's to meet. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_edit_with_too_few_courses_is_refused_before_anything_is_saved() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(editable()));
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.TA)));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications?id=5&version=0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        editBody(
                            Map.of(
                                "priorCoursework",
                                List.of(Map.of("ucsbCourse", true, "courseNumber", "CMPSC 8")))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "A TA application must list at least 3 prior courses",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
    verify(auditTrailRepository, never()).saveAll(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void editing_a_missing_application_is_a_404() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications?id=5&version=0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(editBody(Map.of()))
                    .with(csrf()))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Application with id 5 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void editing_an_application_whose_recruitment_is_gone_is_a_404() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(editable()));
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications?id=5&version=0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(editBody(Map.of()))
                    .with(csrf()))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Recruitment with id 7 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  // ---- admin comments ----

  /** The comments are replaced; nothing else on the row changes. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_can_save_comments_on_an_application() throws Exception {
    Application existing = application(5L, 7L, "someone@ucsb.edu", false);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications/adminComments")
                    .param("id", "5")
                    .param("adminComments", "Interview on Tuesday")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Application> captor = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(captor.capture());
    Application expected = application(5L, 7L, "someone@ucsb.edu", false);
    expected.setAdminComments("Interview on Tuesday");
    assertEquals(expected, captor.getValue());
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  /** Clearing the comments is allowed: an empty string is a value, not a missing parameter. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void comments_can_be_cleared() throws Exception {
    Application existing = application(5L, 7L, "someone@ucsb.edu", false);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));

    mockMvc
        .perform(
            put("/api/admin/applications/adminComments")
                .param("id", "5")
                .param("adminComments", "")
                .with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Application> captor = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(captor.capture());
    assertEquals("", captor.getValue().getAdminComments());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void saving_comments_on_a_missing_application_is_a_404() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/applications/adminComments?id=5&adminComments=x").with(csrf()))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Application with id 5 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  // ---- POST /legacy/upload ----

  private static MockMultipartFile legacyCsv() {
    return new MockMultipartFile(
        "file",
        "legacy.csv",
        "text/csv",
        "email,first_name,last_name\nada@ucsb.edu,Ada,Lovelace\n".getBytes(StandardCharsets.UTF_8));
  }

  @Test
  public void logged_out_users_cannot_upload_legacy_applications() throws Exception {
    mockMvc
        .perform(
            multipart("/api/admin/applications/legacy/upload?quarter=W26")
                .file(legacyCsv())
                .with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void non_admins_cannot_upload_legacy_applications() throws Exception {
    mockMvc
        .perform(
            multipart("/api/admin/applications/legacy/upload?quarter=W26")
                .file(legacyCsv())
                .with(csrf()))
        .andExpect(status().is(403));
    verify(legacyApplicationCsvService, never()).upload(any(), any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_quarter_names_the_ta_recruitment_and_the_file_goes_to_the_service()
      throws Exception {
    Recruitment w26 =
        Recruitment.builder().id(4L).quarter("20261").type(RecruitmentType.TA).build();
    when(recruitmentRepository.findByQuarterAndType("20261", RecruitmentType.TA))
        .thenReturn(Optional.of(w26));
    ImportResult result =
        new ImportResult(2, 1, 1, List.of("row 4: no usable email address"), List.of("Rust"));
    when(legacyApplicationCsvService.upload(any(), eq(w26))).thenReturn(result);

    MvcResult response =
        mockMvc
            .perform(
                multipart("/api/admin/applications/legacy/upload?quarter=w26")
                    .file(legacyCsv())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(result), response.getResponse().getContentAsString());
    ArgumentCaptor<MultipartFile> file = ArgumentCaptor.forClass(MultipartFile.class);
    verify(legacyApplicationCsvService, times(1)).upload(file.capture(), eq(w26));
    assertEquals("legacy.csv", file.getValue().getOriginalFilename());
    verify(recruitmentRepository, times(1)).findByQuarterAndType("20261", RecruitmentType.TA);
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_quarter_with_no_ta_recruitment_is_a_400_saying_to_create_it() throws Exception {
    when(recruitmentRepository.findByQuarterAndType("20264", RecruitmentType.TA))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                multipart("/api/admin/applications/legacy/upload?quarter=F26")
                    .file(legacyCsv())
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "There is no TA recruitment for F26; create it under Admin > Recruitments first",
        responseToJson(response).get("message"));
    verify(legacyApplicationCsvService, never()).upload(any(), any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_malformed_quarter_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                multipart("/api/admin/applications/legacy/upload?quarter=Winter")
                    .file(legacyCsv())
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Quarter should be like W26, S26, M26 or F26 (or 20261), not 'Winter'",
        responseToJson(response).get("message"));
    verify(recruitmentRepository, never()).findByQuarterAndType(any(), any());
  }

  // ---- the ULA perm number on an admin edit (issue #72) ----

  /** An admin is held only to the perm number's format, not to answering the ULA questions. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_edit_of_a_ula_application_needs_no_ula_answers_but_a_valid_perm_number()
      throws Exception {
    Application existing = editable();
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.ULA)));

    // No perm number and none of the other ULA answers: fine for an admin. (The rating is on the
    // ULA scale, as the body's default of 4 is a TA rating.)
    Map<String, Object> ulaScale = Map.of("topicProficiencies", Map.of("Java", 3));
    mockMvc
        .perform(
            put("/api/admin/applications?id=5&version=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content(editBody(ulaScale))
                .with(csrf()))
        .andExpect(status().isOk());

    // A perm number typed in lower case is stored upper case.
    Map<String, Object> lowerCase = new HashMap<>(ulaScale);
    lowerCase.put("permNumber", "a1b2c3d");
    mockMvc
        .perform(
            put("/api/admin/applications?id=5&version=0")
                .contentType(MediaType.APPLICATION_JSON)
                .content(editBody(lowerCase))
                .with(csrf()))
        .andExpect(status().isOk());
    assertEquals("A1B2C3D", existing.getPermNumber());
    verify(applicationRepository, times(2)).save(existing);

    // A malformed one is refused, as for the applicant.
    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/applications?id=5&version=0")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        editBody(
                            Map.of(
                                "permNumber", "12-4567", "topicProficiencies", Map.of("Java", 3))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals(
        "Perm number must be exactly 7 characters, letters and digits only",
        responseToJson(response).get("message"));
    verify(applicationRepository, times(2)).save(any());
  }

  // ---- POST /legacy-ula/upload (issue #70) ----

  @Test
  public void logged_out_users_cannot_upload_ula_form_responses() throws Exception {
    mockMvc
        .perform(
            multipart("/api/admin/applications/legacy-ula/upload?quarter=F26")
                .file(legacyCsv())
                .with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void non_admins_cannot_upload_ula_form_responses() throws Exception {
    mockMvc
        .perform(
            multipart("/api/admin/applications/legacy-ula/upload?quarter=F26")
                .file(legacyCsv())
                .with(csrf()))
        .andExpect(status().is(403));
    verify(legacyUlaApplicationCsvService, never()).upload(any(), any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_quarter_names_the_ula_recruitment_and_the_file_goes_to_the_ula_service()
      throws Exception {
    Recruitment f26 =
        Recruitment.builder().id(9L).quarter("20264").type(RecruitmentType.ULA).build();
    when(recruitmentRepository.findByQuarterAndType("20264", RecruitmentType.ULA))
        .thenReturn(Optional.of(f26));
    LegacyUlaApplicationCsvService.ImportResult result =
        new LegacyUlaApplicationCsvService.ImportResult(
            3, 1, 0, List.of(), List.of("React"), List.of("Grading"));
    when(legacyUlaApplicationCsvService.upload(any(), eq(f26))).thenReturn(result);

    MvcResult response =
        mockMvc
            .perform(
                multipart("/api/admin/applications/legacy-ula/upload?quarter=f26")
                    .file(legacyCsv())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(result), response.getResponse().getContentAsString());
    ArgumentCaptor<MultipartFile> file = ArgumentCaptor.forClass(MultipartFile.class);
    verify(legacyUlaApplicationCsvService, times(1)).upload(file.capture(), eq(f26));
    assertEquals("legacy.csv", file.getValue().getOriginalFilename());
    verify(legacyApplicationCsvService, never()).upload(any(), any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_quarter_with_no_ula_recruitment_is_a_400_saying_to_create_it() throws Exception {
    when(recruitmentRepository.findByQuarterAndType("20261", RecruitmentType.ULA))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                multipart("/api/admin/applications/legacy-ula/upload?quarter=W26")
                    .file(legacyCsv())
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "There is no ULA recruitment for W26; create it under Admin > Recruitments first",
        responseToJson(response).get("message"));
    verify(legacyUlaApplicationCsvService, never()).upload(any(), any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_malformed_quarter_is_a_400_for_the_ula_import_too() throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                multipart("/api/admin/applications/legacy-ula/upload?quarter=Fall")
                    .file(legacyCsv())
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Quarter should be like W26, S26, M26 or F26 (or 20261), not 'Fall'",
        responseToJson(response).get("message"));
    verify(recruitmentRepository, never()).findByQuarterAndType(any(), any());
  }

  // ---- version check and the multi-tab warning (issue #302) ----

  private static Application versionedEditable(long id, int version) {
    Application application = editable();
    application.setId(id);
    application.setVersion(version);
    return application;
  }

  private org.springframework.test.web.servlet.ResultActions adminPut(
      long id, int version, String clientId) throws Exception {
    var request =
        put("/api/admin/applications?id=" + id + "&version=" + version)
            .contentType(MediaType.APPLICATION_JSON)
            .content(editBody(Map.of()))
            .with(csrf());
    return mockMvc.perform(clientId == null ? request : request.header("X-Client-Id", clientId));
  }

  private void recruitmentExists() {
    when(recruitmentRepository.findById(7L))
        .thenReturn(Optional.of(recruitment(7L, RecruitmentType.TA)));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_edit_made_from_an_old_version_is_refused_and_shows_the_application()
      throws Exception {
    when(applicationRepository.findById(401L)).thenReturn(Optional.of(versionedEditable(401L, 4)));
    recruitmentExists();

    MvcResult response = adminPut(401L, 3, null).andExpect(status().isConflict()).andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals(4, json.get("version"));
    Map<?, ?> current = (Map<?, ?>) json.get("application");
    assertEquals(4, current.get("version"));
    // An admin may see the admin's notes.
    assertEquals("Looks strong", current.get("adminComments"));
    verify(applicationRepository, never()).save(any());
    verify(auditTrailRepository, never()).saveAll(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_edit_from_the_current_version_is_saved_and_audited_from_what_was_saved()
      throws Exception {
    when(applicationRepository.findById(402L)).thenReturn(Optional.of(versionedEditable(402L, 4)));
    recruitmentExists();
    when(applicationRepository.save(any(Application.class)))
        .thenAnswer(
            invocation -> {
              Application saved = invocation.getArgument(0);
              saved.setVersion(5);
              return saved;
            });

    MvcResult response = adminPut(402L, 4, null).andExpect(status().isOk()).andReturn();

    assertEquals(5, responseToJson(response).get("version"));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_save_that_loses_a_race_is_a_conflict_too() throws Exception {
    when(applicationRepository.findById(403L))
        .thenReturn(
            Optional.of(versionedEditable(403L, 4)), Optional.of(versionedEditable(403L, 5)));
    recruitmentExists();
    when(applicationRepository.save(any(Application.class)))
        .thenThrow(
            new org.springframework.orm.ObjectOptimisticLockingFailureException(
                Application.class, 403L));

    MvcResult response = adminPut(403L, 4, null).andExpect(status().isConflict()).andReturn();

    assertEquals(5, responseToJson(response).get("version"));
    verify(auditTrailRepository, never()).saveAll(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_race_with_an_application_that_has_since_gone_is_not_hidden() throws Exception {
    when(applicationRepository.findById(404L))
        .thenReturn(Optional.of(versionedEditable(404L, 4)), Optional.empty());
    recruitmentExists();
    when(applicationRepository.save(any(Application.class)))
        .thenThrow(
            new org.springframework.orm.ObjectOptimisticLockingFailureException(
                Application.class, 404L));

    jakarta.servlet.ServletException thrown =
        org.junit.jupiter.api.Assertions.assertThrows(
            jakarta.servlet.ServletException.class, () -> adminPut(404L, 4, null));
    // The race itself is what is reported, not a failure to report it.
    org.junit.jupiter.api.Assertions.assertInstanceOf(
        org.springframework.orm.ObjectOptimisticLockingFailureException.class, thrown.getCause());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_save_that_names_its_client_is_recorded_as_an_admin() throws Exception {
    when(applicationRepository.findById(405L)).thenReturn(Optional.of(versionedEditable(405L, 4)));
    recruitmentExists();

    // Refused or not, a save that names its client counts as being there.
    adminPut(405L, 1, "admin-tab").andExpect(status().isConflict());

    assertEquals(
        List.of(
            new edu.ucsb.cs.taapply.concurrency.OtherClient(
                "user@example.org (Fake user)", false, true)),
        detector.othersActive("application:405", "observer"));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_save_that_names_no_client_records_nobody() throws Exception {
    when(applicationRepository.findById(406L)).thenReturn(Optional.of(versionedEditable(406L, 4)));
    recruitmentExists();

    adminPut(406L, 4, null).andExpect(status().isOk());

    assertEquals(List.of(), detector.othersActive("application:406", "observer"));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_plain_user_cannot_save_and_is_not_recorded() throws Exception {
    adminPut(407L, 4, "intruder-tab").andExpect(status().isForbidden());

    assertEquals(List.of(), detector.othersActive("application:407", "observer"));
  }
}
