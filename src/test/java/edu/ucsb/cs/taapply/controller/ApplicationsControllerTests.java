package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import java.time.LocalDate;
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

@WebMvcTest(controllers = ApplicationsController.class)
@Import({edu.ucsb.cs.taapply.testconfig.TestConfig.class, ApplicationAccessService.class})
public class ApplicationsControllerTests extends ControllerTestCase {

  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

  /** MockCurrentUserServiceImpl derives the email from the mock user's name. */
  private static final String GRAD_EMAIL = "grad@example.org";

  private static final String ULA_EMAIL = "ula@example.org";

  private static Recruitment recruitment(
      long id, RecruitmentType type, ApplicationStatus status, LocalDate deadline) {
    return Recruitment.builder()
        .id(id)
        .quarter("20262")
        .type(type)
        .applicationStatus(status)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(deadline)
        .build();
  }

  private static final LocalDate FUTURE = LocalDate.now().plusDays(1);
  private static final LocalDate PAST = LocalDate.now().minusDays(1);

  private static final Recruitment OPEN_TA =
      recruitment(1L, RecruitmentType.TA, ApplicationStatus.OPEN, FUTURE);
  private static final Recruitment OPEN_ULA =
      recruitment(2L, RecruitmentType.ULA, ApplicationStatus.OPEN, FUTURE);
  private static final Recruitment CLOSED_TA =
      recruitment(3L, RecruitmentType.TA, ApplicationStatus.CLOSED, FUTURE);
  private static final Recruitment PAST_DEADLINE_TA =
      recruitment(4L, RecruitmentType.TA, ApplicationStatus.OPEN, PAST);

  /** Every applicant-supplied field set to something distinctive, so nothing can be dropped. */
  private static final ApplicationFields FULL_FIELDS =
      new ApplicationFields(
          "Ada",
          "M",
          "Lovelace",
          "Computer Science",
          3.9,
          3.8,
          "2nd",
          "S27",
          "CS 156, CS 130A",
          "Java, Spring, React",
          "TA for CS 24",
          "CMPSC   156",
          "Happy to help with either",
          "CMPSC   156",
          "CMPSC   130A",
          true,
          true,
          true,
          true,
          ResidencyStatus.F1_STUDENT_VISA,
          LanguageExamStatus.PASSED,
          LocalDate.of(2025, 9, 1),
          ClassLevel.PHD,
          "Compilers at another school",
          "CS 290A",
          "https://example.org/video",
          2);

  /** The same application with every availability answer turned off. */
  private static final ApplicationFields NO_AVAILABILITY =
      new ApplicationFields(
          FULL_FIELDS.firstName(),
          FULL_FIELDS.middleName(),
          FULL_FIELDS.lastName(),
          FULL_FIELDS.major(),
          FULL_FIELDS.gpaMajor(),
          FULL_FIELDS.gpaOverall(),
          FULL_FIELDS.yearInProgram(),
          FULL_FIELDS.graduationDate(),
          FULL_FIELDS.courseworkUcsb(),
          FULL_FIELDS.knowledge(),
          FULL_FIELDS.prevExperience(),
          FULL_FIELDS.desiredCourses(),
          FULL_FIELDS.comments(),
          FULL_FIELDS.firstChoiceCourse(),
          FULL_FIELDS.secondChoiceCourse(),
          false,
          false,
          false,
          false,
          FULL_FIELDS.residencyStatus(),
          FULL_FIELDS.languageExam(),
          FULL_FIELDS.languageExamDatePassed(),
          FULL_FIELDS.classLevel(),
          FULL_FIELDS.courseworkOther(),
          FULL_FIELDS.coursework290(),
          FULL_FIELDS.videoLink(),
          FULL_FIELDS.previousServiceAsUla());

  /** The same values, as the entity they should produce. */
  private static Application expectedFrom(
      Long id, Long recruitmentId, String email, String postApplicationComments) {
    return Application.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .email(email)
        .status(ApplicationReviewStatus.PENDING)
        .postApplicationComments(postApplicationComments)
        .firstName("Ada")
        .middleName("M")
        .lastName("Lovelace")
        .major("Computer Science")
        .gpaMajor(3.9)
        .gpaOverall(3.8)
        .yearInProgram("2nd")
        .graduationDate("S27")
        .courseworkUcsb("CS 156, CS 130A")
        .knowledge("Java, Spring, React")
        .prevExperience("TA for CS 24")
        .desiredCourses("CMPSC   156")
        .comments("Happy to help with either")
        .firstChoiceCourse("CMPSC   156")
        .secondChoiceCourse("CMPSC   130A")
        .availableForLecturesFirstChoice(true)
        .availableForLecturesSecondChoice(true)
        .availableForDiscussionFirstChoice(true)
        .availableForDiscussionSecondChoice(true)
        .residencyStatus(ResidencyStatus.F1_STUDENT_VISA)
        .languageExam(LanguageExamStatus.PASSED)
        .languageExamDatePassed(LocalDate.of(2025, 9, 1))
        .classLevel(ClassLevel.PHD)
        .courseworkOther("Compilers at another school")
        .coursework290("CS 290A")
        .videoLink("https://example.org/video")
        .previousServiceAsUla(2)
        .build();
  }

  private static Application application(long id, long recruitmentId, String email) {
    return Application.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .email(email)
        .status(ApplicationReviewStatus.PENDING)
        .firstName("Ada")
        .build();
  }

  private String body() throws Exception {
    return mapper.writeValueAsString(FULL_FIELDS);
  }

  private Application saved() {
    ArgumentCaptor<Application> captor = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(1)).save(captor.capture());
    return captor.getValue();
  }

  // ---- authorization: logged out and plain users ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/applications/mine")).andExpect(status().is(403));
    mockMvc.perform(get("/api/applications?id=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/applications/prefill")).andExpect(status().is(403));
    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/applications?id=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(put("/api/applications/comments?id=1&postApplicationComments=hi").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void plain_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/applications/mine")).andExpect(status().is(403));
    mockMvc.perform(get("/api/applications?id=1")).andExpect(status().is(403));
    mockMvc.perform(get("/api/applications/prefill")).andExpect(status().is(403));
    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/applications?id=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(put("/api/applications/comments?id=1&postApplicationComments=hi").with(csrf()))
        .andExpect(status().is(403));
  }

  /** An admin can look at their own (empty) list, but is not an applicant and cannot write. */
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void an_admin_may_read_but_not_write() throws Exception {
    when(applicationRepository.findByEmailOrderByIdDesc("admin@example.org")).thenReturn(List.of());

    mockMvc.perform(get("/api/applications/mine")).andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/applications?id=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(put("/api/applications/comments?id=1&postApplicationComments=hi").with(csrf()))
        .andExpect(status().is(403));
  }

  // ---- GET /mine ----

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void mine_lists_only_the_current_users_applications() throws Exception {
    List<Application> mine =
        List.of(application(2L, 1L, GRAD_EMAIL), application(1L, 3L, GRAD_EMAIL));
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL)).thenReturn(mine);

    MvcResult response =
        mockMvc.perform(get("/api/applications/mine")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(mine), response.getResponse().getContentAsString());
    verify(applicationRepository, times(1)).findByEmailOrderByIdDesc(GRAD_EMAIL);
  }

  // ---- GET one ----

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void an_applicant_can_read_their_own_application() throws Exception {
    Application mine = application(5L, 1L, GRAD_EMAIL);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(mine));

    MvcResult response =
        mockMvc.perform(get("/api/applications?id=5")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(mine), response.getResponse().getContentAsString());
  }

  /** The row exists; refusing it as forbidden rather than missing is deliberate. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void an_applicant_cannot_read_someone_elses_application() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 1L, "someoneelse@example.org")));

    MvcResult response =
        mockMvc.perform(get("/api/applications?id=5")).andExpect(status().is(403)).andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("ForbiddenException", json.get("type"));
    assertEquals("That application belongs to someone else", json.get("message"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void reading_an_application_that_does_not_exist_is_a_404() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc.perform(get("/api/applications?id=5")).andExpect(status().isNotFound()).andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Application with id 5 not found", json.get("message"));
  }

  // ---- GET /prefill ----

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void prefill_returns_only_the_most_recent_application() throws Exception {
    Application newest = application(2L, 1L, GRAD_EMAIL);
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL))
        .thenReturn(List.of(newest, application(1L, 3L, GRAD_EMAIL)));

    MvcResult response =
        mockMvc.perform(get("/api/applications/prefill")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(newest)), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void prefill_is_empty_for_a_first_time_applicant() throws Exception {
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL)).thenReturn(List.of());

    MvcResult response =
        mockMvc.perform(get("/api/applications/prefill")).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  // ---- POST ----

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_grad_student_can_apply_to_an_open_ta_recruitment() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    Application expected = expectedFrom(null, 1L, GRAD_EMAIL, null);
    assertEquals(expected, saved());
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "ula",
      roles = {"UNDERGRAD"})
  @Test
  public void an_undergrad_can_apply_to_an_open_ula_recruitment() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(expectedFrom(null, 2L, ULA_EMAIL, null), saved());
  }

  /** The type check is server side, not merely a hidden link. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_grad_student_cannot_apply_to_a_ula_recruitment() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals(
        "You are not eligible to apply to this recruitment",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "ula",
      roles = {"UNDERGRAD"})
  @Test
  public void an_undergrad_cannot_apply_to_a_ta_recruitment() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().is(403));

    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void applying_to_a_recruitment_that_does_not_exist_is_a_404() throws Exception {
    when(recruitmentRepository.findById(9L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=9")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 9 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void applying_to_a_closed_recruitment_is_refused() throws Exception {
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "Applications are not currently open for this recruitment",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_second_application_to_the_same_recruitment_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "You already have an application for this recruitment",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  // ---- PUT ----

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void an_applicant_can_edit_their_own_application_before_the_deadline() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    existing.setPostApplicationComments("still keen");
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications?id=5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    // The comments are not part of the edit, so they survive it untouched.
    Application expected = expectedFrom(5L, 1L, GRAD_EMAIL, "still keen");
    assertEquals(expected, saved());
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  /** Each availability answer has to be able to go back to no, not merely to yes. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_can_clear_the_availability_answers() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    existing.setAvailableForLecturesFirstChoice(true);
    existing.setAvailableForLecturesSecondChoice(true);
    existing.setAvailableForDiscussionFirstChoice(true);
    existing.setAvailableForDiscussionSecondChoice(true);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NO_AVAILABILITY))
                .with(csrf()))
        .andExpect(status().isOk());

    Application after = saved();
    assertFalse(after.isAvailableForLecturesFirstChoice());
    assertFalse(after.isAvailableForLecturesSecondChoice());
    assertFalse(after.isAvailableForDiscussionFirstChoice());
    assertFalse(after.isAvailableForDiscussionSecondChoice());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_is_refused_once_the_deadline_has_passed() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 4L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(4L)).thenReturn(Optional.of(PAST_DEADLINE_TA));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications?id=5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals(
        "This application can no longer be edited; you may still update your post application"
            + " comments",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void an_applicant_cannot_edit_someone_elses_application() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 1L, "someoneelse@example.org")));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications?id=5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals(
        "That application belongs to someone else", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** The FK should make this impossible, but the lookup still has to handle it. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_an_application_whose_recruitment_is_missing_is_a_404() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 8L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(8L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications?id=5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 8 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  // ---- PUT /comments ----

  /** The whole point of the separate endpoint: comments outlive the editing deadline. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void comments_can_still_be_updated_after_the_deadline() throws Exception {
    Application existing = application(5L, 4L, GRAD_EMAIL);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(4L)).thenReturn(Optional.of(PAST_DEADLINE_TA));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications/comments?id=5&postApplicationComments=Took CS 190J since")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    Application expected = application(5L, 4L, GRAD_EMAIL);
    expected.setPostApplicationComments("Took CS 190J since");
    assertEquals(expected, saved());
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void comments_are_refused_once_the_recruitment_is_closed() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 3L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));

    MvcResult response =
        mockMvc
            .perform(put("/api/applications/comments?id=5&postApplicationComments=hi").with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals("This recruitment is closed", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void an_applicant_cannot_comment_on_someone_elses_application() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 1L, "someoneelse@example.org")));

    MvcResult response =
        mockMvc
            .perform(put("/api/applications/comments?id=5&postApplicationComments=hi").with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals(
        "That application belongs to someone else", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }
}
