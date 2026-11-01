package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
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
        FULL_FIELDS.interests(),
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
        FULL_FIELDS.permNumber(),
        FULL_FIELDS.bsMsStudent(),
        FULL_FIELDS.studentStatusNextQuarter(),
        FULL_FIELDS.wantsTaEligibility(),
        FULL_FIELDS.otherCampusJob(),
        FULL_FIELDS.priorUcsbEmployment(),
        FULL_FIELDS.employeeId(),
        FULL_FIELDS.i9Appointment(),
        FULL_FIELDS.trainingCommitment(),
        FULL_FIELDS.trainingCommitmentExplanation(),
        FULL_FIELDS.changingMajor(),
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
          Map.of("Java", 3, "React", 2),
          Map.of("Tutoring", 5, "Grading", 1),
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
          LanguageExamStatus.PASSED_F1_OR_J1_VISA,
          "F25",
          ClassLevel.PHD,
          "https://example.org/video",
          2,
          "a1b2c3d",
          true,
          StudentStatus.UNDERGRADUATE,
          true,
          OtherCampusJob.NO,
          true,
          "1234567",
          true,
          TrainingCommitment.AGREE,
          null,
          false,
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
          FULL_FIELDS.interests(),
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
          FULL_FIELDS.permNumber(),
          FULL_FIELDS.bsMsStudent(),
          FULL_FIELDS.studentStatusNextQuarter(),
          FULL_FIELDS.wantsTaEligibility(),
          FULL_FIELDS.otherCampusJob(),
          FULL_FIELDS.priorUcsbEmployment(),
          FULL_FIELDS.employeeId(),
          FULL_FIELDS.i9Appointment(),
          FULL_FIELDS.trainingCommitment(),
          FULL_FIELDS.trainingCommitmentExplanation(),
          FULL_FIELDS.changingMajor(),
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
        FULL_FIELDS.interests(),
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
        FULL_FIELDS.permNumber(),
        FULL_FIELDS.bsMsStudent(),
        FULL_FIELDS.studentStatusNextQuarter(),
        FULL_FIELDS.wantsTaEligibility(),
        FULL_FIELDS.otherCampusJob(),
        FULL_FIELDS.priorUcsbEmployment(),
        FULL_FIELDS.employeeId(),
        FULL_FIELDS.i9Appointment(),
        FULL_FIELDS.trainingCommitment(),
        FULL_FIELDS.trainingCommitmentExplanation(),
        FULL_FIELDS.changingMajor(),
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
        FULL_FIELDS.interests(),
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
        FULL_FIELDS.permNumber(),
        FULL_FIELDS.bsMsStudent(),
        FULL_FIELDS.studentStatusNextQuarter(),
        FULL_FIELDS.wantsTaEligibility(),
        FULL_FIELDS.otherCampusJob(),
        FULL_FIELDS.priorUcsbEmployment(),
        FULL_FIELDS.employeeId(),
        FULL_FIELDS.i9Appointment(),
        FULL_FIELDS.trainingCommitment(),
        FULL_FIELDS.trainingCommitmentExplanation(),
        FULL_FIELDS.changingMajor(),
        FULL_FIELDS.noticeVersionId());
  }

  /** The full application with a different prior coursework list. */
  private static ApplicationFields withCourses(List<PriorCourseworkFields> courses) {
    return withNoticeAndCourses(FULL_FIELDS.noticeVersionId(), courses);
  }

  /** The same values, as the entity they should produce. */
  private static Application expectedFrom(
      Long id, Long recruitmentId, String email, String postApplicationComments) {
    // Recruitment 2 is the ULA one; only a ULA application keeps the availability answers (#76).
    boolean ula = recruitmentId == 2L;
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
        .topicProficiencies(new TreeMap<>(Map.of("Java", 3, "React", 2)))
        // A TA application keeps no interests, whatever was sent.
        .interests(new TreeMap<>())
        .prevExperience("TA for CS 24")
        .comments("Happy to help with either")
        .firstChoiceCourse("CMPSC   156")
        .secondChoiceCourse("CMPSC   130A")
        .availableForLecturesFirstChoice(ula)
        .availableForLecturesSecondChoice(ula)
        .availableForDiscussionFirstChoice(ula)
        .availableForDiscussionSecondChoice(ula)
        .availabilityCommentsFirstChoice(ula ? "Free T R afternoons" : null)
        .availabilityCommentsSecondChoice(ula ? "Any section but Friday" : null)
        .courseInterests(
            new HashMap<>(
                Map.of(
                    "CMPSC     8",
                    CourseInterest.ENTHUSIASTIC,
                    "CMPSC    16",
                    CourseInterest.WOULD_CONSIDER)))
        .residencyStatus(ResidencyStatus.F1_STUDENT_VISA)
        .languageExam(LanguageExamStatus.PASSED_F1_OR_J1_VISA)
        .languageExamDatePassed("F25")
        .classLevel(ClassLevel.PHD)
        .videoLink("https://example.org/video")
        .previousServiceAsUla(2)
        // The perm number is stored upper case whatever was typed.
        .permNumber("A1B2C3D")
        .bsMsStudent(true)
        .studentStatusNextQuarter(StudentStatus.UNDERGRADUATE)
        .wantsTaEligibility(true)
        .otherCampusJob(OtherCampusJob.NO)
        .priorUcsbEmployment(true)
        .employeeId("1234567")
        .i9Appointment(true)
        .trainingCommitment(TrainingCommitment.AGREE)
        .trainingCommitmentExplanation(null)
        .changingMajor(false)
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

  /** An admin is a signed-in user like any other here, so their own (empty) list is readable. */
  @WithMockUser(
      username = "admin",
      roles = {"USER", "ADMIN"})
  @Test
  public void an_admin_may_read_their_own_list() throws Exception {
    when(applicationRepository.findByEmailOrderByIdDesc("admin@example.org")).thenReturn(List.of());

    mockMvc.perform(get("/api/applications/mine")).andExpect(status().isOk());
  }

  // ---- GET /mine ----

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
  @Test
  public void prefill_returns_only_the_application_for_the_most_recent_quarter() throws Exception {
    Application newest = application(2L, 1L, GRAD_EMAIL);
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL))
        .thenReturn(List.of(newest, application(1L, 3L, GRAD_EMAIL)));
    when(recruitmentRepository.findAllById(List.of(1L, 3L)))
        .thenReturn(List.of(recruitment(1L, "20262"), recruitment(3L, "20261")));

    MvcResult response =
        mockMvc.perform(get("/api/applications/prefill")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(newest)), response.getResponse().getContentAsString());
  }

  private static Recruitment recruitment(long id, String quarter) {
    return Recruitment.builder().id(id).quarter(quarter).type(RecruitmentType.TA).build();
  }

  /**
   * An application imported from the legacy app's data gets a newer id than one the student made
   * since, yet belongs to an older quarter: the student's own, newer answers must win.
   */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void prefill_prefers_the_newest_quarter_over_the_newest_row() throws Exception {
    Application imported = application(9L, 3L, GRAD_EMAIL);
    Application own = application(2L, 1L, GRAD_EMAIL);
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL))
        .thenReturn(List.of(imported, own));
    when(recruitmentRepository.findAllById(List.of(3L, 1L)))
        .thenReturn(List.of(recruitment(3L, "20251"), recruitment(1L, "20262")));

    MvcResult response =
        mockMvc.perform(get("/api/applications/prefill")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(own)), response.getResponse().getContentAsString());
  }

  /** A recruitment that has since been deleted sorts its application last. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void prefill_sorts_an_application_whose_recruitment_is_gone_last() throws Exception {
    Application orphan = application(9L, 8L, GRAD_EMAIL);
    Application own = application(2L, 1L, GRAD_EMAIL);
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL))
        .thenReturn(List.of(orphan, own));
    when(recruitmentRepository.findAllById(List.of(8L, 1L)))
        .thenReturn(List.of(recruitment(1L, "20201")));

    MvcResult response =
        mockMvc.perform(get("/api/applications/prefill")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(own)), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void prefill_is_empty_for_a_first_time_applicant() throws Exception {
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL)).thenReturn(List.of());
    when(recruitmentRepository.findAllById(List.of())).thenReturn(List.of());

    MvcResult response =
        mockMvc.perform(get("/api/applications/prefill")).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  // ---- POST ----

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_signed_in_user_can_apply_to_an_open_ta_recruitment() throws Exception {
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
      roles = {"USER"})
  @Test
  public void a_signed_in_user_can_apply_to_an_open_ula_recruitment() throws Exception {
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
    // A ULA application keeps its interest levels, sorted by name.
    expected.setInterests(new TreeMap<>(Map.of("Grading", 1, "Tutoring", 5)));
    assertEquals(expected, saved());
  }

  /** There is no applicant type: the same user may apply to a TA and to a ULA recruitment. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void the_same_user_may_apply_to_a_ula_recruitment_too() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 2L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(withNotice(41L)))
                .with(csrf()))
        .andExpect(status().isOk());

    Application expected = expectedFrom(null, 2L, GRAD_EMAIL, null);
    expected.setNoticeVersionId(41L);
    expected.setInterests(new TreeMap<>(Map.of("Grading", 1, "Tutoring", 5)));
    assertEquals(expected, saved());
  }

  /** Being an instructor or an admin does not stop someone applying either. */
  @WithMockUser(
      username = "ula",
      roles = {"USER", "INSTRUCTOR", "ADMIN"})
  @Test
  public void an_instructor_or_admin_may_apply_as_well() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 1L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(expectedFrom(null, 1L, ULA_EMAIL, null), saved());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
  @Test
  public void editing_is_refused_once_applications_are_closed() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 3L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));

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
        "This application can no longer be edited; applications are closed",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** Issue #98: the primary consideration date no longer ends editing; only closing does. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void editing_is_still_allowed_past_the_deadline_while_open() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 4L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(4L)).thenReturn(Optional.of(PAST_DEADLINE_TA));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals("Ada", saved().getFirstName());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
  @Test
  public void comments_are_refused_once_the_recruitment_closed_long_ago() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 3L, GRAD_EMAIL)));
    Recruitment longClosed = recruitment(3L, RecruitmentType.TA, ApplicationStatus.CLOSED, PAST);
    longClosed.setActualClosingDate(LocalDate.now().minusMonths(7));
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(longClosed));

    MvcResult response =
        mockMvc
            .perform(put("/api/applications/comments?id=5&postApplicationComments=hi").with(csrf()))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals(
        "This recruitment closed more than six months ago",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** Issue #107: comments stay open for six months after a recruitment closes. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void comments_are_still_allowed_for_six_months_after_closing() throws Exception {
    Application existing = application(5L, 3L, GRAD_EMAIL);
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    Recruitment recentlyClosed =
        recruitment(3L, RecruitmentType.TA, ApplicationStatus.CLOSED, PAST);
    recentlyClosed.setActualClosingDate(LocalDate.now().minusMonths(5));
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(recentlyClosed));

    mockMvc
        .perform(put("/api/applications/comments?id=5&postApplicationComments=Since").with(csrf()))
        .andExpect(status().isOk());

    assertEquals("Since", saved().getPostApplicationComments());
  }

  /** A closed recruitment without a recorded closing date is treated as long closed. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void comments_are_refused_on_a_closed_recruitment_with_no_closing_date() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 3L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(3L)).thenReturn(Optional.of(CLOSED_TA));

    mockMvc
        .perform(put("/api/applications/comments?id=5&postApplicationComments=hi").with(csrf()))
        .andExpect(status().is(403));
    verify(applicationRepository, never()).save(any());
  }

  // ---- PUT /cancel (issue #107) ----

  private static Application cancelled(long id, long recruitmentId, String email) {
    Application a = application(id, recruitmentId, email);
    a.setStatus(ApplicationReviewStatus.CANCELLED);
    a.setCancellationReason("Found other employment");
    a.setCancelledAt(LocalDateTime.of(2026, 2, 3, 4, 5));
    return a;
  }

  @Test
  public void logged_out_users_cannot_cancel() throws Exception {
    mockMvc
        .perform(put("/api/applications/cancel?id=5&reason=x").with(csrf()))
        .andExpect(status().is(403));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void an_applicant_can_cancel_their_own_application_with_a_reason() throws Exception {
    Application existing = application(5L, 3L, GRAD_EMAIL);
    existing.setAdminComments("Strong candidate");
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications/cancel")
                    .param("id", "5")
                    .param("reason", "  Found other employment  ")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    Application stored = saved();
    assertEquals(ApplicationReviewStatus.CANCELLED, stored.getStatus());
    assertEquals("Found other employment", stored.getCancellationReason());
    assertNotNull(stored.getCancelledAt());
    assertTrue(stored.getCancelledAt().isAfter(LocalDateTime.now().minusMinutes(1)));
    // The admin's notes stay stored but are not sent back.
    assertEquals("Strong candidate", stored.getAdminComments());
    Map<String, Object> json = responseToJson(response);
    assertEquals("CANCELLED", json.get("status"));
    assertEquals("Found other employment", json.get("cancellationReason"));
    assertNull(json.get("adminComments"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void cancelling_needs_a_reason() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 3L, GRAD_EMAIL)));

    MvcResult response =
        mockMvc
            // .param, since MockMvc does not decode %20 in a URL.
            .perform(
                put("/api/applications/cancel")
                    .param("id", "5")
                    .param("reason", "   ")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "Please give a brief reason for cancelling your application",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_cancelled_application_cannot_be_cancelled_edited_or_commented_on_again()
      throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(cancelled(5L, 1L, GRAD_EMAIL)));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    MvcResult response =
        mockMvc
            .perform(put("/api/applications/cancel?id=5&reason=again").with(csrf()))
            .andExpect(status().is(403))
            .andReturn();
    assertEquals("This application was cancelled", responseToJson(response).get("message"));

    mockMvc
        .perform(
            put("/api/applications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(put("/api/applications/comments?id=5&postApplicationComments=hi").with(csrf()))
        .andExpect(status().is(403));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void an_applicant_cannot_cancel_someone_elses_application() throws Exception {
    when(applicationRepository.findById(5L))
        .thenReturn(Optional.of(application(5L, 1L, "someoneelse@example.org")));

    mockMvc
        .perform(put("/api/applications/cancel?id=5&reason=x").with(csrf()))
        .andExpect(status().is(403));
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void cancelling_an_unknown_application_is_a_404() throws Exception {
    when(applicationRepository.findById(5L)).thenReturn(Optional.empty());

    mockMvc
        .perform(put("/api/applications/cancel?id=5&reason=x").with(csrf()))
        .andExpect(status().isNotFound());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
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
      roles = {"USER"})
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
    // A ULA recruitment, so the interest levels are kept too.
    expected.setInterests(new TreeMap<>(Map.of("Grading", 1, "Tutoring", 5)));
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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

  /** The same fields rebuilt with a different set of interest levels. */
  private static ApplicationFields withInterests(
      ApplicationFields f, Map<String, Integer> topics, Map<String, Integer> interests) {
    return new ApplicationFields(
        f.firstName(),
        f.middleName(),
        f.lastName(),
        f.major(),
        f.gpaMajor(),
        f.gpaOverall(),
        f.yearInProgram(),
        f.graduationDate(),
        f.priorCoursework(),
        topics,
        interests,
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.availabilityCommentsFirstChoice(),
        f.availabilityCommentsSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        f.videoLink(),
        f.previousServiceAsUla(),
        f.permNumber(),
        f.bsMsStudent(),
        f.studentStatusNextQuarter(),
        f.wantsTaEligibility(),
        f.otherCampusJob(),
        f.priorUcsbEmployment(),
        f.employeeId(),
        f.i9Appointment(),
        f.trainingCommitment(),
        f.trainingCommitmentExplanation(),
        f.changingMajor(),
        f.noticeVersionId());
  }

  /** The full ULA application (agreeing to the ULA notice) with the given interest levels. */
  private static ApplicationFields ulaWithInterests(Map<String, Integer> interests) {
    ApplicationFields f = withNotice(41L);
    return withInterests(f, f.topicProficiencies(), interests);
  }

  /** The ULA form's radio buttons offer 1 to 3, so 4 and 5 are refused there. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @ParameterizedTest
  @ValueSource(ints = {0, 4, 5})
  public void a_ula_topic_rating_off_its_three_point_scale_is_refused(int level) throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);
    ApplicationFields f = withNotice(41L);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsString(
                            withInterests(f, Map.of("Java", level), f.interests())))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Proficiency in Java must be between 1 and 3", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** 3 is the top of the ULA scale, so it is accepted there. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_topic_rating_of_3_is_accepted() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);
    ApplicationFields f = withNotice(41L);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsString(
                        withInterests(f, Map.of("Java", 3, "Python", 1), f.interests())))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("Java", 3, "Python", 1), saved().getTopicProficiencies());
  }

  // ---- interests (ULA only) ----

  /** Only answered areas are stored, and a level must be on the 1 to 5 scale. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void interest_levels_are_stored_and_unanswered_areas_are_skipped() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);

    Map<String, Integer> sent = new HashMap<>();
    sent.put("Tutoring", 1);
    sent.put("Grading", 5);
    sent.put("Office hours", null); // shown but never answered

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(ulaWithInterests(sent)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("Tutoring", 1, "Grading", 5), saved().getInterests());
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_missing_interests_map_is_stored_as_empty() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(ulaWithInterests(null)))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of(), saved().getInterests());
  }

  /** The radio buttons offer 1 to 5; anything else did not come from the form. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @ParameterizedTest
  @ValueSource(ints = {0, 6, -1})
  public void an_interest_level_off_the_scale_is_refused(int level) throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/post?recruitmentId=2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(ulaWithInterests(Map.of("Tutoring", level))))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Interest in Tutoring must be between 1 and 5", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** A TA form has no interests section, so whatever is sent for one is dropped, not stored. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void interests_sent_with_a_ta_application_are_ignored() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    // Not even checked against the scale: an off-scale level on a TA form is simply dropped.
    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    mapper.writeValueAsString(
                        withInterests(
                            FULL_FIELDS, FULL_FIELDS.topicProficiencies(), Map.of("Tutoring", 9))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of(), saved().getInterests());
  }

  /** Editing replaces the earlier interest levels rather than merging with them. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void editing_replaces_the_interest_levels() throws Exception {
    Application existing = application(6L, 2L, ULA_EMAIL);
    existing.getInterests().put("Grading", 2);
    when(applicationRepository.findById(6L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));

    mockMvc
        .perform(
            put("/api/applications?id=6")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(ulaWithInterests(Map.of("Tutoring", 4))))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(Map.of("Tutoring", 4), saved().getInterests());
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
        f.interests(),
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.availabilityCommentsFirstChoice(),
        f.availabilityCommentsSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        f.videoLink(),
        f.previousServiceAsUla(),
        f.permNumber(),
        f.bsMsStudent(),
        f.studentStatusNextQuarter(),
        f.wantsTaEligibility(),
        f.otherCampusJob(),
        f.priorUcsbEmployment(),
        f.employeeId(),
        f.i9Appointment(),
        f.trainingCommitment(),
        f.trainingCommitmentExplanation(),
        f.changingMajor(),
        f.noticeVersionId());
  }

  /** A TA application needs three courses; two is refused before anything is saved. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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
      roles = {"USER"})
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

  // ---- the ULA questions from the Google Form (issue #72) ----

  /** FULL_FIELDS with the ULA answers replaced, for the ULA recruitment and notice. */
  private static ApplicationFields withUla(
      String permNumber,
      Boolean bsMsStudent,
      OtherCampusJob otherCampusJob,
      Boolean priorUcsbEmployment,
      Integer previousServiceAsUla,
      TrainingCommitment trainingCommitment) {
    ApplicationFields f = withNoticeAndCourses(41L, List.of(course("CMPSC 16")));
    return new ApplicationFields(
        f.firstName(),
        f.middleName(),
        f.lastName(),
        f.major(),
        f.gpaMajor(),
        f.gpaOverall(),
        f.yearInProgram(),
        f.graduationDate(),
        f.priorCoursework(),
        f.topicProficiencies(),
        f.interests(),
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.availabilityCommentsFirstChoice(),
        f.availabilityCommentsSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        f.videoLink(),
        previousServiceAsUla,
        permNumber,
        bsMsStudent,
        f.studentStatusNextQuarter(),
        f.wantsTaEligibility(),
        otherCampusJob,
        priorUcsbEmployment,
        f.employeeId(),
        f.i9Appointment(),
        trainingCommitment,
        f.trainingCommitmentExplanation(),
        f.changingMajor(),
        f.noticeVersionId());
  }

  private MvcResult postUla(ApplicationFields fields, int status) throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.existsByEmailAndRecruitmentId(ULA_EMAIL, 2L)).thenReturn(false);
    return mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=2")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(fields))
                .with(csrf()))
        .andExpect(status().is(status))
        .andReturn();
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_application_stores_its_perm_number_upper_case_and_the_other_answers()
      throws Exception {
    postUla(withUla(" a1b2c3d ", false, OtherCampusJob.NOT_SURE, false, 2, null), 200);

    Application saved = saved();
    assertEquals("A1B2C3D", saved.getPermNumber());
    assertEquals(false, saved.getBsMsStudent());
    assertEquals(StudentStatus.UNDERGRADUATE, saved.getStudentStatusNextQuarter());
    assertEquals(true, saved.getWantsTaEligibility());
    assertEquals(OtherCampusJob.NOT_SURE, saved.getOtherCampusJob());
    assertEquals(false, saved.getPriorUcsbEmployment());
    assertEquals("1234567", saved.getEmployeeId());
    assertEquals(true, saved.getI9Appointment());
    assertNull(saved.getTrainingCommitment());
    assertNull(saved.getTrainingCommitmentExplanation());
    assertEquals(false, saved.getChangingMajor());
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_application_needs_a_perm_number_of_seven_letters_or_digits() throws Exception {
    for (String missing : java.util.Arrays.asList(null, "", "   ")) {
      MvcResult response = postUla(withUla(missing, true, OtherCampusJob.NO, true, 2, null), 400);
      assertEquals(
          "A ULA application needs your perm number", responseToJson(response).get("message"));
    }
    for (String bad : List.of("123456", "12345678", "A1B2-3D", "A1B2C3 ", "1234567Z")) {
      MvcResult response = postUla(withUla(bad, true, OtherCampusJob.NO, true, 2, null), 400);
      assertEquals(
          "Perm number must be exactly 7 characters, letters and digits only",
          responseToJson(response).get("message"));
    }
    verify(applicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_application_needs_the_bs_ms_and_employment_answers() throws Exception {
    MvcResult response = postUla(withUla("1234567", null, OtherCampusJob.NO, true, 2, null), 400);
    assertEquals(
        "Please say whether you are a BS/MS student", responseToJson(response).get("message"));

    response = postUla(withUla("1234567", true, null, true, 2, null), 400);
    assertEquals(
        "Please say whether you will have another campus job this quarter",
        responseToJson(response).get("message"));

    response = postUla(withUla("1234567", true, OtherCampusJob.YES, null, 2, null), 400);
    assertEquals(
        "Please say whether you have been employed at UCSB",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  /** The training commitment is asked of first-time applicants only: previous service 0. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_first_time_ula_applicant_must_answer_the_training_commitment() throws Exception {
    MvcResult response = postUla(withUla("1234567", true, OtherCampusJob.NO, true, 0, null), 400);
    assertEquals(
        "As a first-time ULA applicant, please answer the training commitment question",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());

    postUla(withUla("1234567", true, OtherCampusJob.NO, true, 0, TrainingCommitment.UNSURE), 200);
    assertEquals(TrainingCommitment.UNSURE, saved().getTrainingCommitment());
    // Returning applicants are not asked.
    postUla(withUla("1234567", true, OtherCampusJob.NO, true, 1, null), 200);
  }

  /** withUla with the video link and the I-9 answer replaced (issue #213). */
  private static ApplicationFields withVideoAndI9(
      ApplicationFields f, String videoLink, Boolean i9Appointment) {
    return new ApplicationFields(
        f.firstName(),
        f.middleName(),
        f.lastName(),
        f.major(),
        f.gpaMajor(),
        f.gpaOverall(),
        f.yearInProgram(),
        f.graduationDate(),
        f.priorCoursework(),
        f.topicProficiencies(),
        f.interests(),
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.availabilityCommentsFirstChoice(),
        f.availabilityCommentsSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        videoLink,
        f.previousServiceAsUla(),
        f.permNumber(),
        f.bsMsStudent(),
        f.studentStatusNextQuarter(),
        f.wantsTaEligibility(),
        f.otherCampusJob(),
        f.priorUcsbEmployment(),
        f.employeeId(),
        i9Appointment,
        f.trainingCommitment(),
        f.trainingCommitmentExplanation(),
        f.changingMajor(),
        f.noticeVersionId());
  }

  /** Issue #213: a first-time applicant (previous service 0) must give a video link. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_first_time_ula_applicant_must_include_a_video_link() throws Exception {
    ApplicationFields firstTime =
        withUla("1234567", true, OtherCampusJob.NO, true, 0, TrainingCommitment.AGREE);
    for (String missing : java.util.Arrays.asList(null, "", "  ")) {
      MvcResult response = postUla(withVideoAndI9(firstTime, missing, true), 400);
      assertEquals(
          "As a first-time ULA applicant, please include a link to your video",
          responseToJson(response).get("message"));
    }
    verify(applicationRepository, never()).save(any());

    postUla(withVideoAndI9(firstTime, "https://example.org/demo", true), 200);
    assertEquals("https://example.org/demo", saved().getVideoLink());
    // A returning applicant may leave it out.
    ApplicationFields returning = withUla("1234567", true, OtherCampusJob.NO, true, 1, null);
    postUla(withVideoAndI9(returning, null, true), 200);
  }

  /** Issue #213: every ULA applicant confirms the I-9 appointment. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_applicant_must_confirm_the_i9_appointment() throws Exception {
    ApplicationFields returning = withUla("1234567", true, OtherCampusJob.NO, true, 2, null);
    for (Boolean missing : java.util.Arrays.asList(null, false)) {
      MvcResult response = postUla(withVideoAndI9(returning, null, missing), 400);
      assertEquals(
          "Please confirm that you will make an I-9 verification appointment if hired",
          responseToJson(response).get("message"));
    }
    verify(applicationRepository, never()).save(any());

    postUla(withVideoAndI9(returning, null, true), 200);
    assertEquals(true, saved().getI9Appointment());
  }

  /** A TA form asks none of this, so a TA application is saved without any of it. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_ta_application_needs_none_of_the_ula_answers() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);
    ApplicationFields f = withUla(null, null, null, null, 0, null);
    ApplicationFields ta =
        new ApplicationFields(
            f.firstName(),
            f.middleName(),
            f.lastName(),
            f.major(),
            f.gpaMajor(),
            f.gpaOverall(),
            f.yearInProgram(),
            f.graduationDate(),
            COURSES,
            f.topicProficiencies(),
            f.interests(),
            f.prevExperience(),
            f.comments(),
            f.firstChoiceCourse(),
            f.secondChoiceCourse(),
            f.availableForLecturesFirstChoice(),
            f.availableForLecturesSecondChoice(),
            f.availableForDiscussionFirstChoice(),
            f.availableForDiscussionSecondChoice(),
            f.availabilityCommentsFirstChoice(),
            f.availabilityCommentsSecondChoice(),
            f.courseInterests(),
            f.residencyStatus(),
            f.languageExam(),
            f.languageExamDatePassed(),
            f.classLevel(),
            f.videoLink(),
            f.previousServiceAsUla(),
            f.permNumber(),
            f.bsMsStudent(),
            f.studentStatusNextQuarter(),
            f.wantsTaEligibility(),
            f.otherCampusJob(),
            f.priorUcsbEmployment(),
            f.employeeId(),
            f.i9Appointment(),
            f.trainingCommitment(),
            f.trainingCommitmentExplanation(),
            f.changingMajor(),
            NOTICE_ID);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(ta))
                .with(csrf()))
        .andExpect(status().isOk());

    assertNull(saved().getPermNumber());
    assertNull(saved().getBsMsStudent());
    assertNull(saved().getOtherCampusJob());
  }

  /** The same rule guards an edit. */
  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void editing_a_ula_application_applies_the_same_rules() throws Exception {
    Application existing = application(6L, 2L, ULA_EMAIL);
    when(applicationRepository.findById(6L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/applications?id=6")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsString(
                            withUla("12-4567", true, OtherCampusJob.NO, true, 2, null)))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals(
        "Perm number must be exactly 7 characters, letters and digits only",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  @Test
  public void perm_numbers_are_trimmed_and_upper_cased_and_blank_is_none() {
    assertNull(ApplicationsController.normalizePermNumber(null));
    assertNull(ApplicationsController.normalizePermNumber("  "));
    assertEquals("A1B2C3D", ApplicationsController.normalizePermNumber(" a1b2c3d "));
    assertEquals("1234567", ApplicationsController.normalizePermNumber("1234567"));
  }

  /** The same fields with an explanation of the training answer. */
  private static ApplicationFields withExplanation(ApplicationFields f, String explanation) {
    return new ApplicationFields(
        f.firstName(),
        f.middleName(),
        f.lastName(),
        f.major(),
        f.gpaMajor(),
        f.gpaOverall(),
        f.yearInProgram(),
        f.graduationDate(),
        f.priorCoursework(),
        f.topicProficiencies(),
        f.interests(),
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.availabilityCommentsFirstChoice(),
        f.availabilityCommentsSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        f.videoLink(),
        f.previousServiceAsUla(),
        f.permNumber(),
        f.bsMsStudent(),
        f.studentStatusNextQuarter(),
        f.wantsTaEligibility(),
        f.otherCampusJob(),
        f.priorUcsbEmployment(),
        f.employeeId(),
        f.i9Appointment(),
        f.trainingCommitment(),
        explanation,
        f.changingMajor(),
        f.noticeVersionId());
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void the_training_explanation_is_kept_and_a_blank_one_is_no_answer() throws Exception {
    ApplicationFields unsure =
        withUla("1234567", true, OtherCampusJob.NO, true, 0, TrainingCommitment.UNSURE);
    postUla(withExplanation(unsure, " Might have a Friday lab "), 200);
    postUla(withExplanation(unsure, "   "), 200);

    ArgumentCaptor<Application> captor = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, times(2)).save(captor.capture());
    assertEquals(
        "Might have a Friday lab", captor.getAllValues().get(0).getTrainingCommitmentExplanation());
    assertNull(captor.getAllValues().get(1).getTrainingCommitmentExplanation());
  }

  /** An admin previewing the ULA form is held to the same ULA rules as an applicant. */
  @WithMockUser(
      username = "admin",
      roles = {"USER", "ADMIN"})
  @Test
  public void a_test_application_for_a_ula_recruitment_needs_the_ula_answers() throws Exception {
    when(recruitmentRepository.findById(2L)).thenReturn(Optional.of(OPEN_ULA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 2L))
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/test?recruitmentId=2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper.writeValueAsString(
                            withUla(null, true, OtherCampusJob.NO, true, 2, null)))
                    .with(csrf()))
            .andExpect(status().is(400))
            .andReturn();
    assertEquals(
        "A ULA application needs your perm number", responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());
  }

  // ---- the academic answers a ULA applicant must give (issue #78) ----

  /** The ULA fields with the academic answers replaced. */
  private static ApplicationFields withAcademics(
      ApplicationFields f,
      Double gpaMajor,
      Double gpaOverall,
      String yearInProgram,
      String graduationDate) {
    return new ApplicationFields(
        f.firstName(),
        f.middleName(),
        f.lastName(),
        f.major(),
        gpaMajor,
        gpaOverall,
        yearInProgram,
        graduationDate,
        f.priorCoursework(),
        f.topicProficiencies(),
        f.interests(),
        f.prevExperience(),
        f.comments(),
        f.firstChoiceCourse(),
        f.secondChoiceCourse(),
        f.availableForLecturesFirstChoice(),
        f.availableForLecturesSecondChoice(),
        f.availableForDiscussionFirstChoice(),
        f.availableForDiscussionSecondChoice(),
        f.availabilityCommentsFirstChoice(),
        f.availabilityCommentsSecondChoice(),
        f.courseInterests(),
        f.residencyStatus(),
        f.languageExam(),
        f.languageExamDatePassed(),
        f.classLevel(),
        f.videoLink(),
        f.previousServiceAsUla(),
        f.permNumber(),
        f.bsMsStudent(),
        f.studentStatusNextQuarter(),
        f.wantsTaEligibility(),
        f.otherCampusJob(),
        f.priorUcsbEmployment(),
        f.employeeId(),
        f.i9Appointment(),
        f.trainingCommitment(),
        f.trainingCommitmentExplanation(),
        f.changingMajor(),
        f.noticeVersionId());
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_application_needs_both_gpas_the_year_the_graduation_and_the_service_count()
      throws Exception {
    ApplicationFields ok = withUla("1234567", true, OtherCampusJob.NO, true, 2, null);

    MvcResult response = postUla(withAcademics(ok, null, 3.8, "2nd", "S27"), 400);
    assertEquals(
        "A ULA application needs your GPA in major", responseToJson(response).get("message"));
    response = postUla(withAcademics(ok, 3.9, null, "2nd", "S27"), 400);
    assertEquals(
        "A ULA application needs your overall GPA", responseToJson(response).get("message"));
    for (String blank : java.util.Arrays.asList(null, "  ")) {
      response = postUla(withAcademics(ok, 3.9, 3.8, blank, "S27"), 400);
      assertEquals(
          "A ULA application needs your year in program", responseToJson(response).get("message"));
      response = postUla(withAcademics(ok, 3.9, 3.8, "2nd", blank), 400);
      assertEquals(
          "A ULA application needs your expected graduation",
          responseToJson(response).get("message"));
    }
    response = postUla(withUla("1234567", true, OtherCampusJob.NO, true, null, null), 400);
    assertEquals(
        "A ULA application needs the number of quarters you have served as a ULA (0 if none)",
        responseToJson(response).get("message"));
    verify(applicationRepository, never()).save(any());

    postUla(withAcademics(ok, 3.9, 3.8, "2nd", "S27"), 200);
    verify(applicationRepository, times(1)).save(any());
  }

  /** A TA applicant may leave all of these blank, as before. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_ta_application_may_leave_the_academic_answers_blank() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);
    ApplicationFields bare = withAcademics(FULL_FIELDS, null, null, null, null);

    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(bare))
                .with(csrf()))
        .andExpect(status().isOk());

    assertNull(saved().getGpaMajor());
    assertNull(saved().getGraduationDate());
  }

  // ---- applicants never see the admin comments (issue #75) ----

  private static Application withAdminComments(Application application) {
    application.setAdminComments("Interview Tuesday; strong candidate");
    return application;
  }

  /** The stripped copy has everything else, and the stored row keeps the comments. */
  @Test
  public void forApplicant_blanks_only_the_admin_comments_on_a_copy() {
    Application stored = withAdminComments(application(5L, 1L, GRAD_EMAIL));
    stored.setComments("Happy to help");

    Application shown = ApplicationsController.forApplicant(stored);

    assertNull(shown.getAdminComments());
    assertEquals("Interview Tuesday; strong candidate", stored.getAdminComments());
    assertEquals(5L, shown.getId());
    assertEquals(GRAD_EMAIL, shown.getEmail());
    assertEquals("Happy to help", shown.getComments());
    assertEquals(stored.toBuilder().adminComments(null).build(), shown);
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void mine_and_one_and_prefill_leave_out_the_admin_comments() throws Exception {
    Application mine = withAdminComments(application(5L, 1L, GRAD_EMAIL));
    mine.setTentativeAssignmentId(20L);
    when(applicationRepository.findByEmailOrderByIdDesc(GRAD_EMAIL)).thenReturn(List.of(mine));
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(mine));
    when(recruitmentRepository.findAllById(List.of(1L)))
        .thenReturn(List.of(recruitment(1L, "20262")));
    String expected = mapper.writeValueAsString(ApplicationsController.forApplicant(mine));

    for (String url : List.of("/api/applications/mine", "/api/applications/prefill")) {
      MvcResult response = mockMvc.perform(get(url)).andExpect(status().isOk()).andReturn();
      assertEquals("[" + expected + "]", response.getResponse().getContentAsString());
      assertEquals(-1, response.getResponse().getContentAsString().indexOf("Interview"));
      // Nor the admin's tentative assignment (issue #179), which the student must not see yet.
      assertEquals(-1, response.getResponse().getContentAsString().indexOf("entativeAssignment"));
    }
    MvcResult response =
        mockMvc.perform(get("/api/applications?id=5")).andExpect(status().isOk()).andReturn();
    assertEquals(expected, response.getResponse().getContentAsString());
    assertEquals(-1, response.getResponse().getContentAsString().indexOf("Interview"));
    assertEquals(-1, response.getResponse().getContentAsString().indexOf("entativeAssignment"));
    // The row itself is untouched.
    assertEquals("Interview Tuesday; strong candidate", mine.getAdminComments());
    assertEquals(20L, mine.getTentativeAssignmentId());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void editing_and_commenting_leave_out_the_admin_comments_but_keep_them_stored()
      throws Exception {
    Application existing = withAdminComments(application(5L, 1L, GRAD_EMAIL));
    when(applicationRepository.findById(5L)).thenReturn(Optional.of(existing));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));

    MvcResult edited =
        mockMvc
            .perform(
                put("/api/applications?id=5")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();
    assertEquals(-1, edited.getResponse().getContentAsString().indexOf("Interview"));
    assertEquals(
        true, edited.getResponse().getContentAsString().contains("\"adminComments\":null"));
    assertEquals("Interview Tuesday; strong candidate", existing.getAdminComments());

    MvcResult commented =
        mockMvc
            .perform(
                put("/api/applications/comments?id=5&postApplicationComments=Took%20CS%20190J")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();
    assertEquals(-1, commented.getResponse().getContentAsString().indexOf("Interview"));
    assertEquals(
        true, commented.getResponse().getContentAsString().contains("\"adminComments\":null"));
    assertEquals("Interview Tuesday; strong candidate", existing.getAdminComments());
    verify(applicationRepository, times(2)).save(existing);
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_new_application_s_response_has_no_admin_comments() throws Exception {
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

    assertEquals(
        true, response.getResponse().getContentAsString().contains("\"adminComments\":null"));
  }

  /** The admin's preview goes through the same copy, so its response is shaped the same way. */
  @WithMockUser(
      username = "admin",
      roles = {"USER", "ADMIN"})
  @Test
  public void a_test_application_s_response_has_no_admin_comments_either() throws Exception {
    Application existing = withAdminComments(application(8L, 1L, ADMIN_EMAIL));
    existing.setTestApplication(true);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.findByEmailAndRecruitmentId(ADMIN_EMAIL, 1L))
        .thenReturn(Optional.of(existing));

    MvcResult response =
        mockMvc
            .perform(
                post("/api/applications/test?recruitmentId=1")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body())
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(-1, response.getResponse().getContentAsString().indexOf("Interview"));
    assertEquals("Interview Tuesday; strong candidate", existing.getAdminComments());
  }

  /** Only the ULA form asks about availability (issue #76); a TA application never keeps it. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_ta_application_drops_any_availability_answers_it_is_sent() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(OPEN_TA));
    when(applicationRepository.existsByEmailAndRecruitmentId(GRAD_EMAIL, 1L)).thenReturn(false);

    // FULL_FIELDS answers yes to all four and fills both comment boxes.
    mockMvc
        .perform(
            post("/api/applications/post?recruitmentId=1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body())
                .with(csrf()))
        .andExpect(status().isOk());

    Application saved = saved();
    assertEquals(false, saved.isAvailableForLecturesFirstChoice());
    assertEquals(false, saved.isAvailableForLecturesSecondChoice());
    assertEquals(false, saved.isAvailableForDiscussionFirstChoice());
    assertEquals(false, saved.isAvailableForDiscussionSecondChoice());
    assertNull(saved.getAvailabilityCommentsFirstChoice());
    assertNull(saved.getAvailabilityCommentsSecondChoice());
  }

  @WithMockUser(
      username = "ula",
      roles = {"USER"})
  @Test
  public void a_ula_application_keeps_its_availability_answers() throws Exception {
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

    Application saved = saved();
    assertEquals(true, saved.isAvailableForLecturesFirstChoice());
    assertEquals(true, saved.isAvailableForDiscussionSecondChoice());
    assertEquals("Free T R afternoons", saved.getAvailabilityCommentsFirstChoice());
    assertEquals("Any section but Friday", saved.getAvailabilityCommentsSecondChoice());
  }
}
