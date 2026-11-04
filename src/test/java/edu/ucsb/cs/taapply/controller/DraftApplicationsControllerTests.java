package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.OtherClient;
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.controller.ApplicationsController.PriorCourseworkFields;
import edu.ucsb.cs.taapply.entity.DraftApplication;
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
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = DraftApplicationsController.class)
@Import({
  edu.ucsb.cs.taapply.testconfig.TestConfig.class,
  ApplicationAccessService.class,
  DraftApplicationsControllerTests.DetectorConfig.class
})
public class DraftApplicationsControllerTests extends ControllerTestCase {

  @MockitoBean DraftApplicationRepository draftApplicationRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;
  @org.springframework.beans.factory.annotation.Autowired ResettableDetector detector;

  /**
   * The application's detector, but one that can be emptied. The detector is one bean for the whole
   * test class, and a mutation tester runs the tests again and again in one JVM, so what one run
   * recorded would otherwise be there for the next.
   */
  static class ResettableDetector implements ClientActivityDetector {
    private volatile ClientActivityDetector delegate = fresh();

    private static ClientActivityDetector fresh() {
      return new edu.ucsb.cs.taapply.config.ConcurrencyConfig().clientActivityDetector("5", "3");
    }

    void reset() {
      delegate = fresh();
    }

    @Override
    public void record(String resourceKey, String clientId, ClientIdentity identity) {
      delegate.record(resourceKey, clientId, identity);
    }

    @Override
    public List<OtherClient> othersActive(String resourceKey, String clientId) {
      return delegate.othersActive(resourceKey, clientId);
    }

    @Override
    public void leave(String resourceKey, String clientId) {
      delegate.leave(resourceKey, clientId);
    }

    @Override
    public edu.ucsb.cs.taapply.concurrency.Arrival arrival(String resourceKey, String clientId) {
      return delegate.arrival(resourceKey, clientId);
    }

    @Override
    public java.time.Duration window() {
      return delegate.window();
    }

    @Override
    public java.time.Duration heartbeatInterval() {
      return delegate.heartbeatInterval();
    }
  }

  @org.springframework.boot.test.context.TestConfiguration
  static class DetectorConfig {
    @org.springframework.context.annotation.Bean
    ResettableDetector clientActivityDetector() {
      return new ResettableDetector();
    }
  }

  @org.junit.jupiter.api.BeforeEach
  public void forgetWhoWasThere() {
    detector.reset();
  }

  /** MockCurrentUserServiceImpl derives the email from the mock user's name. */
  private static final String EMAIL = "grad@example.org";

  private static Recruitment recruitment(long id, ApplicationStatus status) {
    return Recruitment.builder()
        .id(id)
        .quarter("20254")
        .type(RecruitmentType.TA)
        .applicationStatus(status)
        .build();
  }

  private static DraftApplication draft(long id, String email) {
    return DraftApplication.builder().id(id).recruitmentId(1L).email(email).version(3).build();
  }

  /** Everything the form can send, all of it filled in, to see every field carried across. */
  private static final ApplicationFields FULL =
      new ApplicationFields(
          "Ada",
          "B",
          "Lovelace",
          "Computer Science",
          3.5,
          3.25,
          "Third",
          "S27",
          List.of(
              new PriorCourseworkFields(true, null, "CMPSC 130A", "Data Structures", "F25", "A"),
              new PriorCourseworkFields(false, "De Anza", "CIS 22A", null, null, null)),
          new TreeMap<>(Map.of("Java", 4, "Python", 5)),
          new TreeMap<>(Map.of("Research", 3)),
          "Some experience",
          "Some comments",
          "CMPSC   156",
          "CMPSC   130A",
          true,
          true,
          false,
          true,
          "Mornings",
          "Afternoons",
          Map.of(
              "CMPSC   8",
              CourseInterest.ENTHUSIASTIC,
              "CMPSC   16",
              CourseInterest.NOT_INTERESTED,
              "CMPSC   156",
              CourseInterest.ENTHUSIASTIC),
          ResidencyStatus.US_CITIZEN,
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
          "Because",
          false,
          7L,
          null);

  /** What a form with almost nothing filled in yet sends: a name, blank text, nulls and false. */
  private static final ApplicationFields NEARLY_EMPTY =
      fieldsFromJson("{\"firstName\":\"Ada\",\"lastName\":\"\"}");

  private static ApplicationFields fieldsFromJson(String json) {
    try {
      return new com.fasterxml.jackson.databind.ObjectMapper()
          .readValue(json, ApplicationFields.class);
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  // ---- GET /mine ----

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void mine_lists_only_the_current_users_drafts() throws Exception {
    List<DraftApplication> drafts = List.of(draft(2L, EMAIL), draft(1L, EMAIL));
    when(draftApplicationRepository.findByEmailOrderByIdDesc(EMAIL)).thenReturn(drafts);

    MvcResult response =
        mockMvc.perform(get("/api/draftApplications/mine")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(drafts), response.getResponse().getContentAsString());
  }

  @Test
  public void mine_needs_a_signed_in_user() throws Exception {
    mockMvc.perform(get("/api/draftApplications/mine")).andExpect(status().is(403));
  }

  // ---- POST /open ----

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void opening_creates_an_empty_draft_when_there_is_none() throws Exception {
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(applicationRepository.existsByEmailAndRecruitmentIdAndStatusNot(
            EMAIL, 1L, ApplicationReviewStatus.CANCELLED))
        .thenReturn(false);
    when(draftApplicationRepository.findByEmailAndRecruitmentId(EMAIL, 1L))
        .thenReturn(Optional.empty());
    DraftApplication created = draft(9L, EMAIL);
    when(draftApplicationRepository.save(any(DraftApplication.class))).thenReturn(created);

    MvcResult response =
        mockMvc
            .perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<DraftApplication> saved = ArgumentCaptor.forClass(DraftApplication.class);
    verify(draftApplicationRepository, times(1)).save(saved.capture());
    assertNull(saved.getValue().getId());
    assertEquals(1L, saved.getValue().getRecruitmentId());
    assertEquals(EMAIL, saved.getValue().getEmail());
    assertEquals(mapper.writeValueAsString(created), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void opening_returns_the_draft_that_already_exists() throws Exception {
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(applicationRepository.existsByEmailAndRecruitmentIdAndStatusNot(
            EMAIL, 1L, ApplicationReviewStatus.CANCELLED))
        .thenReturn(false);
    DraftApplication existing = draft(4L, EMAIL);
    existing.setFirstName("Ada");
    when(draftApplicationRepository.findByEmailAndRecruitmentId(EMAIL, 1L))
        .thenReturn(Optional.of(existing));

    MvcResult response =
        mockMvc
            .perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(draftApplicationRepository, never()).save(any());
    assertEquals(mapper.writeValueAsString(existing), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void opening_twice_at_once_returns_the_draft_the_other_request_made() throws Exception {
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(applicationRepository.existsByEmailAndRecruitmentIdAndStatusNot(
            EMAIL, 1L, ApplicationReviewStatus.CANCELLED))
        .thenReturn(false);
    DraftApplication theirs = draft(4L, EMAIL);
    when(draftApplicationRepository.findByEmailAndRecruitmentId(EMAIL, 1L))
        .thenReturn(Optional.empty(), Optional.of(theirs));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenThrow(new DataIntegrityViolationException("uk_draft_applications_email_recruitment"));

    MvcResult response =
        mockMvc
            .perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(theirs), response.getResponse().getContentAsString());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_constraint_failure_with_no_draft_to_return_is_not_hidden() throws Exception {
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(applicationRepository.existsByEmailAndRecruitmentIdAndStatusNot(
            EMAIL, 1L, ApplicationReviewStatus.CANCELLED))
        .thenReturn(false);
    when(draftApplicationRepository.findByEmailAndRecruitmentId(EMAIL, 1L))
        .thenReturn(Optional.empty());
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenThrow(new DataIntegrityViolationException("some other constraint"));

    jakarta.servlet.ServletException thrown =
        org.junit.jupiter.api.Assertions.assertThrows(
            jakarta.servlet.ServletException.class,
            () ->
                mockMvc.perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf())));
    // The failure itself, not some other error made while handling it.
    assertEquals(DataIntegrityViolationException.class, thrown.getCause().getClass());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void opening_for_a_recruitment_that_does_not_exist_is_a_404() throws Exception {
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("Recruitment with id 1 not found", responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void opening_for_a_closed_recruitment_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.CLOSED)));

    MvcResult response =
        mockMvc
            .perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "Applications are not currently open for this recruitment",
        responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void opening_when_an_application_is_already_submitted_is_refused() throws Exception {
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(applicationRepository.existsByEmailAndRecruitmentIdAndStatusNot(
            EMAIL, 1L, ApplicationReviewStatus.CANCELLED))
        .thenReturn(true);

    MvcResult response =
        mockMvc
            .perform(post("/api/draftApplications/open?recruitmentId=1").with(csrf()))
            .andExpect(status().is(400))
            .andReturn();

    assertEquals(
        "You already have an application for this recruitment",
        responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).save(any());
  }

  // ---- PUT ----

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void saving_copies_every_field_of_the_form_without_checking_any() throws Exception {
    DraftApplication stored = draft(5L, EMAIL);
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(stored));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(FULL))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    DraftApplication expected =
        DraftApplication.builder()
            .id(5L)
            .version(3)
            .recruitmentId(1L)
            .email(EMAIL)
            .noticeVersionId(7L)
            .firstName("Ada")
            .middleName("B")
            .lastName("Lovelace")
            .major("Computer Science")
            .gpaMajor(3.5)
            .gpaOverall(3.25)
            .yearInProgram("Third")
            .graduationDate("S27")
            .prevExperience("Some experience")
            .comments("Some comments")
            .firstChoiceCourse("CMPSC   156")
            .secondChoiceCourse("CMPSC   130A")
            .availableForLecturesFirstChoice(true)
            .availableForLecturesSecondChoice(true)
            .availableForDiscussionFirstChoice(false)
            .availableForDiscussionSecondChoice(true)
            .availabilityCommentsFirstChoice("Mornings")
            .availabilityCommentsSecondChoice("Afternoons")
            // Not interested is the default and the first choice has its own field: both dropped,
            // as when an application is submitted.
            .courseInterests(new HashMap<>(Map.of("CMPSC   8", CourseInterest.ENTHUSIASTIC)))
            .topicProficiencies(new TreeMap<>(Map.of("Java", 4, "Python", 5)))
            .interests(new TreeMap<>(Map.of("Research", 3)))
            // Kept as typed: unlike a submitted application, nothing is trimmed or blanked.
            .priorCoursework(
                List.of(
                    PriorCoursework.builder()
                        .ucsbCourse(true)
                        .courseNumber("CMPSC 130A")
                        .courseTitle("Data Structures")
                        .term("F25")
                        .grade("A")
                        .build(),
                    PriorCoursework.builder()
                        .ucsbCourse(false)
                        .otherSchool("De Anza")
                        .courseNumber("CIS 22A")
                        .build()))
            .residencyStatus(ResidencyStatus.US_CITIZEN)
            .languageExam(LanguageExamStatus.PASSED_F1_OR_J1_VISA)
            .languageExamDatePassed("F25")
            .classLevel(ClassLevel.PHD)
            .videoLink("https://example.org/video")
            .previousServiceAsUla(2)
            // Kept as typed too; it is upper-cased and checked when the application is submitted.
            .permNumber("a1b2c3d")
            .bsMsStudent(true)
            .studentStatusNextQuarter(StudentStatus.UNDERGRADUATE)
            .wantsTaEligibility(true)
            .otherCampusJob(OtherCampusJob.NO)
            .priorUcsbEmployment(true)
            .employeeId("1234567")
            .i9Appointment(true)
            .trainingCommitment(TrainingCommitment.AGREE)
            .trainingCommitmentExplanation("Because")
            .changingMajor(false)
            .build();
    ArgumentCaptor<DraftApplication> saved = ArgumentCaptor.forClass(DraftApplication.class);
    verify(draftApplicationRepository, times(1)).save(saved.capture());
    assertEquals(expected, saved.getValue());
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  /** Issue #292: the first quarter box is saved with the draft, so it is there after a reload. */
  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void the_first_quarter_box_is_saved_with_the_draft_and_cleared_when_unanswered()
      throws Exception {
    List<Boolean> seen = new java.util.ArrayList<>();
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(draft(5L, EMAIL)));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenAnswer(
            invocation -> {
              DraftApplication draft = invocation.getArgument(0);
              seen.add(draft.getFirstQuarter());
              return draft;
            });
    com.fasterxml.jackson.databind.node.ObjectNode ticked = mapper.valueToTree(NEARLY_EMPTY);
    ticked.put("firstQuarter", true);

    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(ticked))
                .with(csrf()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NEARLY_EMPTY))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(java.util.Arrays.asList(Boolean.TRUE, null), seen);
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void saving_an_almost_empty_form_is_allowed() throws Exception {
    DraftApplication stored = draft(5L, EMAIL);
    stored.setFirstName("Old");
    stored.setTopicProficiencies(new HashMap<>(Map.of("Java", 4)));
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(stored));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NEARLY_EMPTY))
                .with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<DraftApplication> saved = ArgumentCaptor.forClass(DraftApplication.class);
    verify(draftApplicationRepository, times(1)).save(saved.capture());
    DraftApplication result = saved.getValue();
    assertEquals("Ada", result.getFirstName());
    assertEquals("", result.getLastName());
    // What the form no longer has is dropped, not left behind from the last save.
    assertTrue(result.getTopicProficiencies().isEmpty());
    assertTrue(result.getInterests().isEmpty());
    assertTrue(result.getPriorCoursework().isEmpty());
    assertTrue(result.getCourseInterests().isEmpty());
    assertEquals(Boolean.FALSE, result.getAvailableForLecturesFirstChoice());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void saving_someone_elses_draft_is_forbidden() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, "other@example.org")));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(NEARLY_EMPTY))
                    .with(csrf()))
            .andExpect(status().isForbidden())
            .andReturn();

    assertEquals("That draft belongs to someone else", responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void saving_a_draft_that_does_not_exist_is_a_404() throws Exception {
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(NEARLY_EMPTY))
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("DraftApplication with id 5 not found", responseToJson(response).get("message"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void saving_after_applications_close_is_refused() throws Exception {
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(draft(5L, EMAIL)));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.CLOSED)));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(NEARLY_EMPTY))
                    .with(csrf()))
            .andExpect(status().isForbidden())
            .andReturn();

    assertEquals(
        "Applications are closed, so this draft can no longer be saved",
        responseToJson(response).get("message"));
    verify(draftApplicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void saving_a_draft_for_a_deleted_recruitment_is_a_404() throws Exception {
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(draft(5L, EMAIL)));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.empty());

    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NEARLY_EMPTY))
                .with(csrf()))
        .andExpect(status().isNotFound());
  }

  // ---- concurrent edits ----

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_with_the_current_version_returns_the_draft_with_its_new_version()
      throws Exception {
    DraftApplication stored = draft(5L, EMAIL);
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(stored));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenAnswer(
            invocation -> {
              DraftApplication saved = invocation.getArgument(0);
              // What Hibernate does when it writes the row.
              return saved.toBuilder().version(saved.getVersion() + 1).build();
            });

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(NEARLY_EMPTY))
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(4, responseToJson(response).get("version"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_with_an_older_version_is_refused_with_the_draft_as_it_now_stands()
      throws Exception {
    DraftApplication stored = draft(5L, EMAIL);
    stored.setComments("Typed in the other tab");
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(stored));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=2")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(NEARLY_EMPTY))
                    .with(csrf()))
            .andExpect(status().isConflict())
            .andReturn();

    var body = responseToJson(response);
    assertEquals(
        "This draft was changed in another tab or window. Reload to see the latest version.",
        body.get("message"));
    assertEquals(3, body.get("version"));
    assertEquals("Typed in the other tab", ((Map<?, ?>) body.get("draft")).get("comments"));
    assertEquals(3, ((Map<?, ?>) body.get("draft")).get("version"));
    // Nothing of the stale save was kept.
    verify(draftApplicationRepository, never()).save(any());
    assertEquals("Typed in the other tab", stored.getComments());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_newer_version_than_the_draft_has_is_also_refused() throws Exception {
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(draft(5L, EMAIL)));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));

    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=4")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NEARLY_EMPTY))
                .with(csrf()))
        .andExpect(status().isConflict());

    verify(draftApplicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_that_loses_a_race_is_refused_with_the_draft_as_it_now_stands()
      throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(
            Optional.of(draft(5L, EMAIL)),
            Optional.of(draft(5L, EMAIL).toBuilder().version(4).build()));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenThrow(new ObjectOptimisticLockingFailureException(DraftApplication.class, 5L));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/draftApplications?id=5&version=3")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(NEARLY_EMPTY))
                    .with(csrf()))
            .andExpect(status().isConflict())
            .andReturn();

    assertEquals(4, responseToJson(response).get("version"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_race_with_a_draft_that_has_since_gone_is_not_hidden() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, EMAIL)), Optional.empty());
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenThrow(new ObjectOptimisticLockingFailureException(DraftApplication.class, 5L));

    jakarta.servlet.ServletException thrown =
        org.junit.jupiter.api.Assertions.assertThrows(
            jakarta.servlet.ServletException.class,
            () ->
                mockMvc.perform(
                    put("/api/draftApplications?id=5&version=3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(NEARLY_EMPTY))
                        .with(csrf())));
    // The failure itself, not some other error made while handling it.
    assertEquals(ObjectOptimisticLockingFailureException.class, thrown.getCause().getClass());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_with_no_version_is_a_bad_request() throws Exception {
    mockMvc
        .perform(
            put("/api/draftApplications?id=5")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NEARLY_EMPTY))
                .with(csrf()))
        .andExpect(status().isBadRequest());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void someone_elses_draft_is_forbidden_whatever_the_version() throws Exception {
    when(draftApplicationRepository.findById(5L))
        .thenReturn(Optional.of(draft(5L, "other@example.org")));

    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=99")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(NEARLY_EMPTY))
                .with(csrf()))
        .andExpect(status().isForbidden());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void null_level_answers_are_left_out() throws Exception {
    ApplicationFields fields = fieldsFromJson("{\"topicProficiencies\":{\"Java\":4,\"Go\":null}}");
    when(draftApplicationRepository.findById(5L)).thenReturn(Optional.of(draft(5L, EMAIL)));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    mockMvc
        .perform(
            put("/api/draftApplications?id=5&version=3")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(fields))
                .with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<DraftApplication> saved = ArgumentCaptor.forClass(DraftApplication.class);
    verify(draftApplicationRepository, times(1)).save(saved.capture());
    assertEquals(Map.of("Java", 4), saved.getValue().getTopicProficiencies());
  }

  // ---- The multi-tab warning (issue #273) ----

  private static final String CLIENT_ID = "X-Client-Id";

  /** What the mock user "grad" is called to other people. */
  private static final String GRAD_LABEL = "grad@example.org (Fake grad)";

  /** One save, as the named client, of the draft at the version it has. */
  private org.springframework.test.web.servlet.ResultActions saveAs(
      long id, String clientId, int version) throws Exception {
    var request =
        put("/api/draftApplications?id=" + id + "&version=" + version)
            .contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(NEARLY_EMPTY))
            .with(csrf());
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  private org.springframework.test.web.servlet.ResultActions heartbeatAs(long id, String clientId)
      throws Exception {
    var request = post("/api/draftApplications/heartbeat?id=" + id).with(csrf());
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  private void draftIsOpenAndSaves(long id) {
    when(draftApplicationRepository.findById(id)).thenReturn(Optional.of(draft(id, EMAIL)));
    when(recruitmentRepository.findById(1L))
        .thenReturn(Optional.of(recruitment(1L, ApplicationStatus.OPEN)));
    when(draftApplicationRepository.save(any(DraftApplication.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_heartbeat_from_the_only_client_finds_no_one_else_and_says_how_often_to_beat()
      throws Exception {
    when(draftApplicationRepository.findById(101L)).thenReturn(Optional.of(draft(101L, EMAIL)));

    heartbeatAs(101L, "only-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.heartbeatSeconds").value(5))
        .andExpect(jsonPath("$.newest").value(true))
        .andExpect(jsonPath("$.arrivedAtMillis").isNumber());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_second_tab_of_the_same_user_is_named_as_the_same_person() throws Exception {
    when(draftApplicationRepository.findById(102L)).thenReturn(Optional.of(draft(102L, EMAIL)));

    heartbeatAs(102L, "first-tab").andExpect(jsonPath("$.others.length()").value(0));
    heartbeatAs(102L, "second-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value(GRAD_LABEL))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
    heartbeatAs(102L, "first-tab")
        .andExpect(jsonPath("$.others[0].label").value(GRAD_LABEL))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_counts_as_being_there_for_the_other_tabs_heartbeats() throws Exception {
    draftIsOpenAndSaves(103L);

    saveAs(103L, "typing-tab", 3).andExpect(status().isOk());
    heartbeatAs(103L, "idle-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_that_is_refused_as_stale_still_counts_as_being_there() throws Exception {
    draftIsOpenAndSaves(104L);

    saveAs(104L, "stale-tab", 2).andExpect(status().isConflict());
    heartbeatAs(104L, "other-tab").andExpect(jsonPath("$.others.length()").value(1));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_answers_exactly_as_before_with_no_warning_in_it() throws Exception {
    draftIsOpenAndSaves(105L);

    saveAs(105L, "named-tab", 3)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(105))
        .andExpect(jsonPath("$.others").doesNotExist());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void other_people_on_the_same_resource_are_named_with_a_label_that_may_not_be_ascii()
      throws Exception {
    when(draftApplicationRepository.findById(106L)).thenReturn(Optional.of(draft(106L, EMAIL)));
    // A resource that more than one person can use (a later use of the detector) would have people
    // other than the owner on it; here the detector is told of one directly.
    detector.record(
        "draft:106", "jose-tab", new ClientIdentity("jose@example.org", "José (José Álvarez)"));

    heartbeatAs(106L, "my-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("José (José Álvarez)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void other_people_and_my_own_other_tab_are_all_listed_once_each() throws Exception {
    when(draftApplicationRepository.findById(107L)).thenReturn(Optional.of(draft(107L, EMAIL)));
    detector.record(
        "draft:107", "ben-tab-1", new ClientIdentity("ben@example.org", "ben@example.org"));
    detector.record(
        "draft:107", "ben-tab-2", new ClientIdentity("ben@example.org", "ben@example.org"));

    heartbeatAs(107L, "my-first-tab");
    heartbeatAs(107L, "my-second-tab")
        .andExpect(jsonPath("$.others.length()").value(2))
        .andExpect(jsonPath("$.others[0].label").value("ben@example.org"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false))
        .andExpect(jsonPath("$.others[1].label").value(GRAD_LABEL))
        .andExpect(jsonPath("$.others[1].samePerson").value(true));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void the_second_tab_is_told_it_arrived_last_and_the_first_is_not() throws Exception {
    when(draftApplicationRepository.findById(118L)).thenReturn(Optional.of(draft(118L, EMAIL)));

    heartbeatAs(118L, "first-tab").andExpect(jsonPath("$.newest").value(true));
    heartbeatAs(118L, "second-tab").andExpect(jsonPath("$.newest").value(true));
    heartbeatAs(118L, "first-tab")
        .andExpect(jsonPath("$.newest").value(false))
        .andExpect(jsonPath("$.arrivedAtMillis").isNumber());
  }

  private org.springframework.test.web.servlet.ResultActions leaveAs(long id, String clientId)
      throws Exception {
    var request = post("/api/draftApplications/leave?id=" + id).with(csrf());
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_tab_that_leaves_is_forgotten_at_once_by_the_other() throws Exception {
    when(draftApplicationRepository.findById(119L)).thenReturn(Optional.of(draft(119L, EMAIL)));
    heartbeatAs(119L, "staying-tab");
    heartbeatAs(119L, "leaving-tab").andExpect(jsonPath("$.others.length()").value(1));

    leaveAs(119L, "leaving-tab").andExpect(status().isNoContent());

    heartbeatAs(119L, "staying-tab")
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.newest").value(true));
    verify(draftApplicationRepository, never()).save(any());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void leaving_without_naming_a_client_is_harmless() throws Exception {
    when(draftApplicationRepository.findById(120L)).thenReturn(Optional.of(draft(120L, EMAIL)));
    heartbeatAs(120L, "a-tab");

    leaveAs(120L, null).andExpect(status().isNoContent());

    assertEquals(1, detector.othersActive("draft:120", "observer").size());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void leaving_someone_elses_draft_is_forbidden_and_removes_nobody() throws Exception {
    when(draftApplicationRepository.findById(121L))
        .thenReturn(Optional.of(draft(121L, "someone.else@example.org")));
    detector.record(
        "draft:121",
        "owners-tab",
        new ClientIdentity("someone.else@example.org", "someone.else@example.org (The Owner)"));

    // Even naming the owner's own tab, which the intruder might have guessed.
    leaveAs(121L, "owners-tab").andExpect(status().isForbidden());

    assertEquals(
        List.of(new OtherClient("someone.else@example.org (The Owner)", false)),
        detector.othersActive("draft:121", "observer"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void leaving_a_draft_that_does_not_exist_is_not_found() throws Exception {
    when(draftApplicationRepository.findById(122L)).thenReturn(Optional.empty());

    leaveAs(122L, "lost-tab").andExpect(status().isNotFound());
  }

  @Test
  public void leaving_needs_a_signed_in_user_and_removes_nobody() throws Exception {
    detector.record("draft:123", "a-tab", new ClientIdentity(EMAIL, EMAIL));

    leaveAs(123L, "a-tab").andExpect(status().is4xxClientError());

    assertEquals(1, detector.othersActive("draft:123", "observer").size());
  }

  /** A signed-in user whose account has the given name, or none. */
  private static org.springframework.test.web.servlet.request.RequestPostProcessor signedInAs(
      String email, String name) {
    return org.springframework.security.test.web.servlet.request
        .SecurityMockMvcRequestPostProcessors.oauth2Login()
        .authorities(
            new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"))
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
  public void a_user_with_a_name_is_labelled_by_the_email_and_the_name() throws Exception {
    when(draftApplicationRepository.findById(108L))
        .thenReturn(Optional.of(draft(108L, "named@example.org")));

    mockMvc
        .perform(
            post("/api/draftApplications/heartbeat?id=108")
                .header(CLIENT_ID, "named-tab")
                .with(signedInAs("named@example.org", "  Nora Named  "))
                .with(csrf()))
        .andExpect(status().isOk());

    // The name is trimmed and put in parentheses after the email.
    assertEquals(
        List.of(new OtherClient("named@example.org (Nora Named)", false)),
        detector.othersActive("draft:108", "observer"));
  }

  @Test
  public void a_user_with_no_name_or_a_blank_one_is_labelled_by_the_email_alone() throws Exception {
    when(draftApplicationRepository.findById(116L))
        .thenReturn(Optional.of(draft(116L, "nameless@example.org")));
    when(draftApplicationRepository.findById(117L))
        .thenReturn(Optional.of(draft(117L, "blank@example.org")));

    mockMvc
        .perform(
            post("/api/draftApplications/heartbeat?id=116")
                .header(CLIENT_ID, "nameless-tab")
                .with(signedInAs("nameless@example.org", null))
                .with(csrf()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/draftApplications/heartbeat?id=117")
                .header(CLIENT_ID, "blank-tab")
                .with(signedInAs("blank@example.org", "   "))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(
        List.of(new OtherClient("nameless@example.org", false)),
        detector.othersActive("draft:116", "observer"));
    assertEquals(
        List.of(new OtherClient("blank@example.org", false)),
        detector.othersActive("draft:117", "observer"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_heartbeat_changes_nothing() throws Exception {
    DraftApplication stored = draft(109L, EMAIL);
    stored.setComments("As saved");
    when(draftApplicationRepository.findById(109L)).thenReturn(Optional.of(stored));

    heartbeatAs(109L, "beat-first").andExpect(status().isOk());
    heartbeatAs(109L, "beat-second").andExpect(status().isOk());

    // Not saved, and not changed: the draft and its version are as they were.
    verify(draftApplicationRepository, never()).save(any());
    assertEquals("As saved", stored.getComments());
    assertEquals(3, stored.getVersion());
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_heartbeat_that_names_no_client_finds_no_one_and_is_not_recorded() throws Exception {
    when(draftApplicationRepository.findById(110L)).thenReturn(Optional.of(draft(110L, EMAIL)));

    heartbeatAs(110L, null)
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    "{\"others\":[],\"heartbeatSeconds\":5,\"newest\":false,\"arrivedAtMillis\":0}",
                    true));
    heartbeatAs(110L, "   ").andExpect(jsonPath("$.others.length()").value(0));
    // Neither left a mark.
    assertEquals(List.of(), detector.othersActive("draft:110", "observer"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_that_names_no_client_is_not_recorded() throws Exception {
    draftIsOpenAndSaves(111L);

    saveAs(111L, null, 3).andExpect(status().isOk());
    assertEquals(List.of(), detector.othersActive("draft:111", "observer"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_heartbeat_for_someone_elses_draft_is_forbidden_names_no_one_and_records_nothing()
      throws Exception {
    when(draftApplicationRepository.findById(112L))
        .thenReturn(Optional.of(draft(112L, "someone.else@example.org")));
    // The owner is working on it, and the intruder must not learn that.
    detector.record(
        "draft:112",
        "owners-tab",
        new ClientIdentity("someone.else@example.org", "someone.else@example.org (The Owner)"));

    var result = heartbeatAs(112L, "intruder").andExpect(status().isForbidden()).andReturn();

    assertEquals(false, result.getResponse().getContentAsString().contains("The Owner"));
    assertEquals(false, result.getResponse().getContentAsString().contains("someone.else"));
    // And the intruder left no mark: only the owner's tab is there.
    assertEquals(
        List.of(new OtherClient("someone.else@example.org (The Owner)", false)),
        detector.othersActive("draft:112", "observer"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_save_to_someone_elses_draft_is_forbidden_and_records_nothing() throws Exception {
    when(draftApplicationRepository.findById(113L))
        .thenReturn(Optional.of(draft(113L, "someone.else@example.org")));

    saveAs(113L, "intruder", 3).andExpect(status().isForbidden());

    assertEquals(List.of(), detector.othersActive("draft:113", "observer"));
  }

  @WithMockUser(
      username = "grad",
      roles = {"USER"})
  @Test
  public void a_heartbeat_for_a_draft_that_does_not_exist_is_not_found_and_records_nothing()
      throws Exception {
    when(draftApplicationRepository.findById(114L)).thenReturn(Optional.empty());

    heartbeatAs(114L, "lost-tab").andExpect(status().isNotFound());

    assertEquals(List.of(), detector.othersActive("draft:114", "observer"));
  }

  @Test
  public void a_heartbeat_needs_a_signed_in_user_and_records_nothing() throws Exception {
    heartbeatAs(115L, "anonymous-tab").andExpect(status().is4xxClientError());

    assertEquals(List.of(), detector.othersActive("draft:115", "observer"));
  }
}
