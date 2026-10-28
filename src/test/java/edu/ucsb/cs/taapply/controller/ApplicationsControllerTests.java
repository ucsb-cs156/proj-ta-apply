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
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.controller.ApplicationsController.PriorCourseworkFields;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.NoticeVersion;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.NoticeVersionRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
  @MockitoBean NoticeVersionRepository noticeVersionRepository;
  @MockitoBean UserRepository userRepository;

  /** MockCurrentUserServiceImpl derives the email from the mock user's name. */
  private static final String GRAD_EMAIL = "grad@example.org";

  private static final String ULA_EMAIL = "ula@example.org";

  private static final String ADMIN_EMAIL = "admin@example.org";

  /** Three prior courses, enough for a TA application, one of them taken elsewhere. */
  private static final List<PriorCourseworkFields> COURSES =
      List.of(
          new PriorCourseworkFields(true, null, "CMPSC 130A", "Data Structures", "F25", "A"),
          new PriorCourseworkFields(true, "", "CMPSC 156", "Advanced App Programming", "W26", "IP"),
          new PriorCourseworkFields(
              false, "De Anza College", "CIS 22A", "Intro to C", "Fall 2023", ""));

  /** The same three as the rows the controller should build: trimmed, blanks nulled, no ids. */
  private static final List<PriorCoursework> EXPECTED_COURSES =
      List.of(
          PriorCoursework.builder()
              .ucsbCourse(true)
              .courseNumber("CMPSC 130A")
              .courseTitle("Data Structures")
              .term("F25")
              .grade("A")
              .build(),
          PriorCoursework.builder()
              .ucsbCourse(true)
              .courseNumber("CMPSC 156")
              .courseTitle("Advanced App Programming")
              .term("W26")
              .grade("IP")
              .build(),
          PriorCoursework.builder()
              .ucsbCourse(false)
              .otherSchool("De Anza College")
              .courseNumber("CIS 22A")
              .courseTitle("Intro to C")
              .term("Fall 2023")
              .build());

  /** The TA notice version FULL_FIELDS says the applicant agreed to. */
  private static final Long NOTICE_ID = 40L;

  private static final NoticeVersion TA_NOTICE =
      NoticeVersion.builder()
          .id(NOTICE_ID)
          .type(RecruitmentType.TA)
          .content("Be nice.")
          .createdAt(LocalDateTime.of(2026, 1, 2, 3, 4))
          .build();
  private static final NoticeVersion ULA_NOTICE =
      NoticeVersion.builder()
          .id(41L)
          .type(RecruitmentType.ULA)
          .content("Be nicer.")
          .createdAt(LocalDateTime.of(2026, 1, 2, 3, 5))
          .build();

  /** Every submitting test agrees to the TA notice; the ULA tests swap it for the ULA one. */
  @BeforeEach
  public void noticesExist() {
    when(noticeVersionRepository.findById(NOTICE_ID)).thenReturn(Optional.of(TA_NOTICE));
    when(noticeVersionRepository.findById(41L)).thenReturn(Optional.of(ULA_NOTICE));
    when(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.TA))
        .thenReturn(Optional.of(TA_NOTICE));
    when(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.ULA))
        .thenReturn(Optional.of(ULA_NOTICE));
  }

  /** The full application with a different notice agreement. */
  private static ApplicationFields withNotice(Long noticeVersionId) {
    return new ApplicationFields(
        FULL_FIELDS.firstName(),
        FULL_FIELDS.middleName(),
        FULL_FIELDS.lastName(),
        FULL_FIELDS.major(),
        FULL_FIELDS.gpaMajor(),
        FULL_FIELDS.gpaOverall(),
        FULL_FIELDS.yearInProgram(),
        FULL_FIELDS.graduationDate(),
        FULL_FIELDS.priorCoursework(),
        FULL_FIELDS.topicProficiencies(),
        FULL_FIELDS.prevExperience(),
        FULL_FIELDS.comments(),
        FULL_FIELDS.firstChoiceCourse(),
        FULL_FIELDS.secondChoiceCourse(),
        FULL_FIELDS.availableForLecturesFirstChoice(),
        FULL_FIELDS.availableForLecturesSecondChoice(),
        FULL_FIELDS.availableForDiscussionFirstChoice(),
        FULL_FIELDS.availableForDiscussionSecondChoice(),
        FULL_FIELDS.availabilityCommentsFirstChoice(),
        FULL_FIELDS.availabilityCommentsSecondChoice(),
        FULL_FIELDS.courseInterests(),
        FULL_FIELDS.residencyStatus(),
        FULL_FIELDS.languageExam(),
        FULL_FIELDS.languageExamDatePassed(),
        FULL_FIELDS.classLevel(),
        FULL_FIELDS.videoLink(),
        FULL_FIELDS.previousServiceAsUla(),
        noticeVersionId);
  }

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
          COURSES,
          Map.of("Java", 5, "React", 3),
          "TA for CS 24",
          "Happy to help with either",
          "CMPSC   156",
          "CMPSC   130A",
          true,
          true,
          true,
          true,
          "Free T R afternoons",
          "Any section but Friday",
          Map.of(
              "CMPSC     8",
              CourseInterest.ENTHUSIASTIC,
              "CMPSC    16",
              CourseInterest.WOULD_CONSIDER),
          ResidencyStatus.F1_STUDENT_VISA,
          LanguageExamStatus.PASSED,
          LocalDate.of(2025, 9, 1),
          ClassLevel.PHD,
          "https://example.org/video",
          2,
          NOTICE_ID);

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
          FULL_FIELDS.priorCoursework(),
          FULL_FIELDS.topicProficiencies(),
          FULL_FIELDS.prevExperience(),
          FULL_FIELDS.comments(),
          FULL_FIELDS.firstChoiceCourse(),
          FULL_FIELDS.secondChoiceCourse(),
          false,
          false,
          false,
          false,
          FULL_FIELDS.availabilityCommentsFirstChoice(),
          FULL_FIELDS.availabilityCommentsSecondChoice(),
          FULL_FIELDS.courseInterests(),
          FULL_FIELDS.residencyStatus(),
          FULL_FIELDS.languageExam(),
          FULL_FIELDS.languageExamDatePassed(),
          FULL_FIELDS.classLevel(),
          FULL_FIELDS.videoLink(),
          FULL_FIELDS.previousServiceAsUla(),
          FULL_FIELDS.noticeVersionId());

  /** The full application with a different set of course interest answers. */
  private static ApplicationFields withInterests(Map<String, CourseInterest> interests) {
    return new ApplicationFields(
        FULL_FIELDS.firstName(),
        FULL_FIELDS.middleName(),
        FULL_FIELDS.lastName(),
        FULL_FIELDS.major(),
        FULL_FIELDS.gpaMajor(),
        FULL_FIELDS.gpaOverall(),
        FULL_FIELDS.yearInProgram(),
        FULL_FIELDS.graduationDate(),
        FULL_FIELDS.priorCoursework(),
        FULL_FIELDS.topicProficiencies(),
        FULL_FIELDS.prevExperience(),
        FULL_FIELDS.comments(),
        FULL_FIELDS.firstChoiceCourse(),
        FULL_FIELDS.secondChoiceCourse(),
        FULL_FIELDS.availableForLecturesFirstChoice(),
        FULL_FIELDS.availableForLecturesSecondChoice(),
        FULL_FIELDS.availableForDiscussionFirstChoice(),
        FULL_FIELDS.availableForDiscussionSecondChoice(),
        FULL_FIELDS.availabilityCommentsFirstChoice(),
        FULL_FIELDS.availabilityCommentsSecondChoice(),
        interests,
        FULL_FIELDS.residencyStatus(),
        FULL_FIELDS.languageExam(),
        FULL_FIELDS.languageExamDatePassed(),
        FULL_FIELDS.classLevel(),
        FULL_FIELDS.videoLink(),
        FULL_FIELDS.previousServiceAsUla(),
        FULL_FIELDS.noticeVersionId());
  }

  /** The full application with a different set of topic ratings. */
  private static ApplicationFields withProficiencies(Map<String, Integer> proficiencies) {
    return new ApplicationFields(
        FULL_FIELDS.firstName(),
        FULL_FIELDS.middleName(),
        FULL_FIELDS.lastName(),
        FULL_FIELDS.major(),
        FULL_FIELDS.gpaMajor(),
        FULL_FIELDS.gpaOverall(),
        FULL_FIELDS.yearInProgram(),
        FULL_FIELDS.graduationDate(),
        FULL_FIELDS.priorCoursework(),
        proficiencies,
        FULL_FIELDS.prevExperience(),
        FULL_FIELDS.comments(),
        FULL_FIELDS.firstChoiceCourse(),
        FULL_FIELDS.secondChoiceCourse(),
        FULL_FIELDS.availableForLecturesFirstChoice(),
        FULL_FIELDS.availableForLecturesSecondChoice(),
        FULL_FIELDS.availableForDiscussionFirstChoice(),
        FULL_FIELDS.availableForDiscussionSecondChoice(),
        FULL_FIELDS.availabilityCommentsFirstChoice(),
        FULL_FIELDS.availabilityCommentsSecondChoice(),
        FULL_FIELDS.courseInterests(),
        FULL_FIELDS.residencyStatus(),
        FULL_FIELDS.languageExam(),
        FULL_FIELDS.languageExamDatePassed(),
        FULL_FIELDS.classLevel(),
        FULL_FIELDS.videoLink(),
        FULL_FIELDS.previousServiceAsUla(),
        FULL_FIELDS.noticeVersionId());
  }

  /** The full application with a different prior coursework list. */
  private static ApplicationFields withCourses(List<PriorCourseworkFields> courses) {
    return withNoticeAndCourses(FULL_FIELDS.noticeVersionId(), courses);
  }

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
        .priorCoursework(new ArrayList<>(EXPECTED_COURSES))
        .topicProficiencies(new TreeMap<>(Map.of("Java", 5, "React", 3)))
        .prevExperience("TA for CS 24")
        .comments("Happy to help with either")
        .firstChoiceCourse("CMPSC   156")
        .secondChoiceCourse("CMPSC   130A")
        .availableForLecturesFirstChoice(true)
        .availableForLecturesSecondChoice(true)
        .availableForDiscussionFirstChoice(true)
        .availableForDiscussionSecondChoice(true)
        .availabilityCommentsFirstChoice("Free T R afternoons")
        .availabilityCommentsSecondChoice("Any section but Friday")
        .courseInterests(
            new HashMap<>(
                Map.of(
                    "CMPSC     8",
                    CourseInterest.ENTHUSIASTIC,
                    "CMPSC    16",
                    CourseInterest.WOULD_CONSIDER)))
        .residencyStatus(ResidencyStatus.F1_STUDENT_VISA)
        .languageExam(LanguageExamStatus.PASSED)
        .languageExamDatePassed(LocalDate.of(2025, 9, 1))
        .classLevel(ClassLevel.PHD)
        .videoLink("https://example.org/video")
        .previousServiceAsUla(2)
        .noticeVersionId(NOTICE_ID)
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
    mockMvc
        .perform(
            post("/api/applications/test?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
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
    mockMvc
        .perform(
            post("/api/applications/test?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}")
                .with(csrf()))
        .andExpect(status().is(403));
  }

  /**
   * An admin can look at their own (empty) list, but is not an applicant and cannot write real
   * applications; test applications go through /test, covered below.
   */
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
                .content(mapper.writeValueAsString(withNotice(41L)))
                .with(csrf()))
        .andExpect(status().isOk());

    Application expected = expectedFrom(null, 2L, ULA_EMAIL, null);
    expected.setNoticeVersionId(41L);
    assertEquals(expected, saved());
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

  // ---- course interests ----

  /**
   * The stored map holds only answers that say something. NOT_INTERESTED is the default, and the
   * first and second choice are recorded in their own fields, so all three are dropped whatever the
   * client sent.
   */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void course_interests_keep_only_the_answers_that_say_something() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    Map<String, CourseInterest> sent = new HashMap<>();
    sent.put("CMPSC     8", CourseInterest.ENTHUSIASTIC);
    sent.put("CMPSC    24", CourseInterest.NOT_INTERESTED);
    sent.put("CMPSC   156", CourseInterest.ENTHUSIASTIC); // the first choice
    sent.put("CMPSC   130A", CourseInterest.WOULD_CONSIDER); // the second choice

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withInterests(sent)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("CMPSC     8", CourseInterest.ENTHUSIASTIC), saved().getCourseInterests());
  }

  /** An older client, or a test via Swagger, may leave the map out altogether. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_missing_course_interest_map_is_stored_as_empty() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withInterests(null)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of(), saved().getCourseInterests());
  }

  /** Editing replaces the earlier answers rather than merging with them. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_replaces_the_course_interests() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    existing.getCourseInterests().put("CMPSC    16", CourseInterest.ENTHUSIASTIC);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsString(
                        withInterests(Map.of("CMPSC     8", CourseInterest.WOULD_CONSIDER))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(
        Map.of("CMPSC     8", CourseInterest.WOULD_CONSIDER), saved().getCourseInterests());
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

  // ---- POST /test (admin preview) ----

  /** Test applications are an admin tool; applicants have the real thing. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT", "UNDERGRAD"})
  @Test
  public void applicants_cannot_enter_test_applications() throws Exception {
    mockMvc
        .perform(
            post("/api/applications/test?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().is(403));
    verify(applicationRepository, never()).save(any());
  }

  /**
   * Neither the type rule nor the open/closed rule applies: the point is to test before opening.
   */
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void an_admin_can_enter_a_test_application_for_a_closed_recruitment() throws Exception {
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 3L))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/test?recruitmentId=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    Application expected = expectedFrom(null, 3L, ADMIN_EMAIL, null);
    expected.setTestApplication(true);
    assertEquals(expected, saved());
    assertTrue(saved().isTestApplication());
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  /** Submitting the test form twice replaces the earlier answers rather than being refused. */
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void a_second_test_application_overwrites_the_first() throws Exception {
    Application earlier = application(7L, 2L, ADMIN_EMAIL);
    earlier.setTestApplication(true);
    earlier.setPostApplicationComments("kept");
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 2L))
        .thenReturn(Optional.of(earlier));

    mockMvc
        .perform(
            post("/api/applications/test?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withNotice(41L)))
                .with(csrf()))
        .andExpect(status().isOk());

    // Same row (same id), still a test application, with the new answers.
    Application expected = expectedFrom(7L, 2L, ADMIN_EMAIL, "kept");
    expected.setTestApplication(true);
    expected.setNoticeVersionId(41L);
    assertEquals(expected, saved());
  }

  /** An admin who is also an applicant must not have a real application turned into a test one. */
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void a_real_application_is_never_converted_into_a_test_application() throws Exception {
    Application real = application(8L, 1L, ADMIN_EMAIL);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 1L))
        .thenReturn(Optional.of(real));

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/test?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "You already have a real application for this recruitment",
        responseToJson(response).get("message"));
    assertFalse(real.isTestApplication());
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void a_test_application_for_a_missing_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/test?recruitmentId=99")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("Recruitment with id 99 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  // ---- topic proficiencies ----

  /** Only rated topics are stored, and a rating must be on the 1 to 5 scale. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void topic_ratings_are_stored_and_unrated_topics_are_skipped() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    Map<String, Integer> sent = new HashMap<>();
    sent.put("Python", 1);
    sent.put("Java", 5);
    sent.put("Compilers", null); // shown but never answered

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withProficiencies(sent)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("Python", 1, "Java", 5), saved().getTopicProficiencies());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_missing_topic_rating_map_is_stored_as_empty() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withProficiencies(null)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of(), saved().getTopicProficiencies());
  }

  /** The radio buttons offer 1 to 5; anything else did not come from the form. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @ParameterizedTest
  @ValueSource(ints = {0, 6, -1})
  public void a_topic_rating_off_the_scale_is_refused(int level) throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(withProficiencies(Map.of("Java", level))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Proficiency in Java must be between 1 and 5", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** The boundary values are both fine. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void topic_ratings_of_1_and_5_are_accepted() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withProficiencies(Map.of("Java", 1, "C", 5))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("Java", 1, "C", 5), saved().getTopicProficiencies());
  }

  /** Editing replaces the earlier ratings rather than merging with them. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_replaces_the_topic_ratings() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    existing.getTopicProficiencies().put("Haskell", 2);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withProficiencies(Map.of("Java", 4))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("Java", 4), saved().getTopicProficiencies());
  }

  // ---- the agreement rule ----

  /** Once a notice exists, an application that did not agree to one is refused. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void applying_without_agreeing_to_the_notice_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(withNotice(null)))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "You must agree to the Notices, Terms and Conditions to submit this application",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** Before any notice has been written for the type, there is nothing to agree to. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void with_no_notice_written_yet_no_agreement_is_needed() throws Exception {
    when(noticeVersionRepository.findFirstByTypeOrderByIdDesc(RecruitmentType.TA))
        .thenReturn(Optional.empty());
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withNotice(null)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(null, saved().getNoticeVersionId());
  }

  /** An older version is fine: the applicant agreed to what they were shown. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void agreeing_to_an_earlier_version_of_the_notice_is_accepted() throws Exception {
    NoticeVersion older =
        NoticeVersion.builder()
            .id(39L)
            .type(RecruitmentType.TA)
            .content("Old text")
            .createdAt(LocalDateTime.of(2025, 1, 1, 0, 0))
            .build();
    when(noticeVersionRepository.findById(39L)).thenReturn(Optional.of(older));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withNotice(39L)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(39L, saved().getNoticeVersionId());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void agreeing_to_a_notice_version_that_does_not_exist_is_a_404() throws Exception {
    when(noticeVersionRepository.findById(99L)).thenReturn(Optional.empty());
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(withNotice(99L)))
                    .with(csrf()))
            .andExpect(status().is(404))
            .andReturn();

    assertEquals("NoticeVersion with id 99 not found", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** A grad student cannot satisfy the TA rule with the ULA notice. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void agreeing_to_the_other_forms_notice_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(withNotice(41L)))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals("Notice version 41 is not a TA notice", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** Editing re-checks the rule, and records the version agreed to on the edit. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_also_requires_agreement() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withNotice(null)))
                .with(csrf()))
        .andExpect(status().is(400));
    verify(applicationRepository, never()).save(any());

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().isOk());
    assertEquals(NOTICE_ID, saved().getNoticeVersionId());
  }

  /** The admin preview is held to the same rule, so the preview matches what applicants see. */
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void a_test_application_also_requires_agreement() throws Exception {
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 3L))
        .thenReturn(Optional.empty());

    mockMvc
        .perform(
            post("/api/applications/test?recruitmentId=3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withNotice(null)))
                .with(csrf()))
        .andExpect(status().is(400));
    verify(applicationRepository, never()).save(any());
  }

  // ---- prior coursework ----

  private static PriorCourseworkFields course(String number) {
    return new PriorCourseworkFields(true, null, number, null, null, null);
  }

  /** FULL_FIELDS agrees to the TA notice; the ULA tests need the ULA one and their own courses. */
  private static ApplicationFields withNoticeAndCourses(
      Long noticeVersionId, List<PriorCourseworkFields> courses) {
    ApplicationFields f = withNotice(noticeVersionId);
    return new ApplicationFields(
        f.firstName(),
        f.middleName(),
        f.lastName(),
        f.major(),
        f.gpaMajor(),
        f.gpaOverall(),
        f.yearInProgram(),
        f.graduationDate(),
        courses,
        f.topicProficiencies(),
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        f.videoLink(),
        f.previousServiceAsUla(),
        f.noticeVersionId());
  }

  /** A TA application needs three courses; two is refused before anything is saved. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_ta_application_with_fewer_than_three_courses_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsString(
                            withCourses(List.of(course("CMPSC 8"), course("CMPSC 16")))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "A TA application must list at least 3 prior courses",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** A ULA application needs one; none (or a missing list) is refused. */
  @WithMockUser(
      username = "ula",
      roles = {"UNDERGRAD"})
  @Test
  public void a_ula_application_with_no_courses_is_refused() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);

    for (List<PriorCourseworkFields> courses :
        java.util.Arrays.<List<PriorCourseworkFields>>asList(List.of(), null)) {
      MvcResult response =
          mockMvc
              .perform(
                  post("/api/applications/post?recruitmentId=2")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(mapper.writeValueAsString(withNoticeAndCourses(41L, courses)))
                      .with(csrf()))
              .andExpect(status().is(400))
              .andReturn();
      assertEquals(
          "A ULA application must list at least 1 prior course",
          responseToJson(response).get("message"));
    }
    verify(applicationRepository, never()).save(any());
  }

  /** One course is enough for a ULA application. */
  @WithMockUser(
      username = "ula",
      roles = {"UNDERGRAD"})
  @Test
  public void a_ula_application_with_one_course_is_accepted() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsString(
                        withNoticeAndCourses(41L, List.of(course("CMPSC 16")))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(1, saved().getPriorCoursework().size());
    assertEquals("CMPSC 16", saved().getPriorCoursework().get(0).getCourseNumber());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_course_without_a_number_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    for (String number : java.util.Arrays.asList("   ", null)) {
      MvcResult response =
          mockMvc
              .perform(
                  post("/api/applications/post?recruitmentId=1")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(
                          mapper.writeValueAsString(
                              withCourses(
                                  List.of(course("CMPSC 8"), course("CMPSC 16"), course(number)))))
                      .with(csrf()))
              .andExpect(status().is(400))
              .andReturn();
      assertEquals(
          "Every prior course needs a course number", responseToJson(response).get("message"));
    }
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void a_course_taken_elsewhere_needs_its_school() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    for (String school : java.util.Arrays.asList("  ", null)) {
      MvcResult response =
          mockMvc
              .perform(
                  post("/api/applications/post?recruitmentId=1")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(
                          mapper.writeValueAsString(
                              withCourses(
                                  List.of(
                                      course("CMPSC 8"),
                                      course("CMPSC 16"),
                                      new PriorCourseworkFields(
                                          false, school, "CS 101", null, null, null)))))
                      .with(csrf()))
              .andExpect(status().is(400))
              .andReturn();
      assertEquals(
          "Prior course CS 101 needs the school it was taken at",
          responseToJson(response).get("message"));
    }
    verify(applicationRepository, never()).save(any());
  }

  /** Values are trimmed, blanks become null, and a UCSB course drops any school that was sent. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void prior_courses_are_stored_tidy_and_in_order() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    List<PriorCourseworkFields> sent =
        List.of(
            new PriorCourseworkFields(true, "Stale school", " CMPSC 8 ", " Intro ", " ", ""),
            new PriorCourseworkFields(false, "  UCLA  ", "CS 31", null, "Fall 2024", " B+ "),
            course("CMPSC 16"));

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withCourses(sent)))
                .with(csrf()))
        .andExpect(status().isOk());

    List<PriorCoursework> rows = saved().getPriorCoursework();
    assertEquals(3, rows.size());
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(true)
            .courseNumber("CMPSC 8")
            .courseTitle("Intro")
            .build(),
        rows.get(0));
    assertEquals(
        PriorCoursework.builder()
            .ucsbCourse(false)
            .otherSchool("UCLA")
            .courseNumber("CS 31")
            .term("Fall 2024")
            .grade("B+")
            .build(),
        rows.get(1));
    assertEquals("CMPSC 16", rows.get(2).getCourseNumber());
  }

  /** Editing replaces the whole list; rows from the earlier save do not linger. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_replaces_the_prior_coursework() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    existing
        .getPriorCoursework()
        .add(PriorCoursework.builder().id(77L).courseNumber("OLD 1").build());
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(EXPECTED_COURSES, saved().getPriorCoursework());
  }

  /** The minimum is checked on an edit too, so courses cannot be removed below it afterwards. */
  @WithMockUser(
      username = "grad",
      roles = {"GRAD_STUDENT"})
  @Test
  public void editing_down_to_too_few_courses_is_refused() throws Exception {
    Application existing = application(5L, 1L, GRAD_EMAIL);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications?id=5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(withCourses(List.of(course("CMPSC 8")))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "A TA application must list at least 3 prior courses",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** The admin preview is held to the same rule, so it previews what applicants face. */
  @WithMockUser(
      username = "admin",
      roles = {"ADMIN"})
  @Test
  public void a_test_application_with_too_few_courses_is_refused() throws Exception {
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 3L))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/test?recruitmentId=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(withCourses(List.of())))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "A TA application must list at least 3 prior courses",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @Test
  public void the_minimums_are_three_for_ta_and_one_for_ula() {
    assertEquals(3, ApplicationsController.minimumCourses(RecruitmentType.TA));
    assertEquals(1, ApplicationsController.minimumCourses(RecruitmentType.ULA));
  }
}
