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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.controller.ApplicationsController.PriorCourseworkFields;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
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
@Import({edu.ucsb.cs.taapply.testconfig.TestConfig.class, ApplicationAccessService.class})
public class DraftApplicationsControllerTests extends ControllerTestCase {

  @MockitoBean DraftApplicationRepository draftApplicationRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UserRepository userRepository;

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
          7L);

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
    when(applicationRepository.existsByEmailAndRecruitmentId(EMAIL, 1L)).thenReturn(false);
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
    when(applicationRepository.existsByEmailAndRecruitmentId(EMAIL, 1L)).thenReturn(false);
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
    when(applicationRepository.existsByEmailAndRecruitmentId(EMAIL, 1L)).thenReturn(false);
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
    when(applicationRepository.existsByEmailAndRecruitmentId(EMAIL, 1L)).thenReturn(false);
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
    when(applicationRepository.existsByEmailAndRecruitmentId(EMAIL, 1L)).thenReturn(true);

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
}
