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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAuditService;
import edu.ucsb.cs.taapply.services.ApplicationCsvService;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = AdminApplicationsController.class)
@Import({
  edu.ucsb.cs.taapply.testconfig.TestConfig.class,
  ApplicationCsvService.class,
  ApplicationAuditService.class
})
public class AdminApplicationsControllerTests extends ControllerTestCase {

  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;
  @MockitoBean AuditTrailRepository auditTrailRepository;

  private static Application application(long id, long recruitmentId, String email, boolean test) {
    return Application.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .email(email)
        .status(ApplicationReviewStatus.PENDING)
        .testApplication(test)
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
            put("/api/admin/applications?id=1")
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
            put("/api/admin/applications?id=1")
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
        lines[1].startsWith("\"1\",\"2026-04-01T09:30\",\"a@ucsb.edu\",\"PENDING\",\"false\""));
    assertEquals(
        true,
        lines[2].startsWith("\"2\",\"2026-04-01T09:30\",\"admin@ucsb.edu\",\"PENDING\",\"true\""));
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
    when(recruitmentRepository.existsById(7L)).thenReturn(true);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L)).thenReturn(applications);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/applications/all?recruitmentId=7"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(applications), response.getResponse().getContentAsString());
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

  private static AuditTrail change(
      Long ta, Long ula, String field, String oldValue, String newValue) {
    return AuditTrail.builder()
        .taApplicationId(ta)
        .ulaApplicationId(ula)
        .fieldName(field)
        .oldValue(oldValue)
        .newValue(newValue)
        .build();
  }

  @SuppressWarnings("unchecked")
  private List<AuditTrail> audited() {
    ArgumentCaptor<List<AuditTrail>> captor = ArgumentCaptor.forClass(List.class);
    verify(auditTrailRepository, times(1)).saveAll(captor.capture());
    return captor.getValue();
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
                put("/api/admin/applications?id=5")
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
            put("/api/admin/applications?id=5")
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
            put("/api/admin/applications?id=5")
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
                put("/api/admin/applications?id=5")
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
                put("/api/admin/applications?id=5")
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
                put("/api/admin/applications?id=5")
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
}
