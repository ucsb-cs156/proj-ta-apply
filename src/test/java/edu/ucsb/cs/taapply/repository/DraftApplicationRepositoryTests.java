package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.LanguageExamStatus;
import edu.ucsb.cs.taapply.enums.OtherCampusJob;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.enums.ResidencyStatus;
import edu.ucsb.cs.taapply.enums.StudentStatus;
import edu.ucsb.cs.taapply.enums.TrainingCommitment;
import edu.ucsb.cs.taapply.models.DraftConflict;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;

/**
 * Draft applications against the real Liquibase-built schema (issue #270), so the columns the
 * entity names and the ones the changeset creates cannot drift apart, and the JSON columns are
 * proved to survive a trip through the database.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class DraftApplicationRepositoryTests {

  @Autowired private TestEntityManager entityManager;
  @Autowired private DraftApplicationRepository draftApplicationRepository;
  @Autowired private RecruitmentRepository recruitmentRepository;
  @Autowired private ApplicationRepository applicationRepository;

  @BeforeEach
  void clean() {
    draftApplicationRepository.deleteAll();
    applicationRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private Recruitment recruitment(String quarter) {
    return recruitmentRepository.save(
        Recruitment.builder()
            .quarter(quarter)
            .type(RecruitmentType.TA)
            .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
            .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
            .build());
  }

  private void flushAndForget() {
    entityManager.flush();
    entityManager.clear();
  }

  @Test
  public void an_empty_draft_needs_only_a_person_and_a_recruitment() {
    Recruitment r = recruitment("20261");

    DraftApplication saved =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    flushAndForget();

    DraftApplication found = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    assertEquals(r.getId(), found.getRecruitmentId());
    assertEquals("grad@ucsb.edu", found.getEmail());
    assertNotNull(found.getUpdatedAt());
    assertNull(found.getFirstName());
    assertNull(found.getGpaMajor());
    assertNull(found.getBsMsStudent());
    assertNull(found.getAvailableForLecturesFirstChoice());
    assertTrue(found.getPriorCoursework().isEmpty());
    assertTrue(found.getTopicProficiencies().isEmpty());
    assertTrue(found.getInterests().isEmpty());
    assertTrue(found.getCourseInterests().isEmpty());
  }

  @Test
  public void every_column_round_trips() {
    Recruitment r = recruitment("20261");

    DraftApplication saved =
        draftApplicationRepository.save(
            DraftApplication.builder()
                .recruitmentId(r.getId())
                .email("grad@ucsb.edu")
                .noticeVersionId(7L)
                .firstName("Chris")
                .middleName("Q")
                .lastName("Gaucho")
                .major("Computer Science")
                .gpaMajor(3.8)
                .gpaOverall(3.7)
                .yearInProgram("2")
                .graduationDate("S27")
                .prevExperience("Grader")
                .comments("Hello")
                .firstChoiceCourse("CMPSC 156")
                .secondChoiceCourse("CMPSC 130A")
                .availableForLecturesFirstChoice(true)
                .availableForLecturesSecondChoice(false)
                .availableForDiscussionFirstChoice(true)
                .availableForDiscussionSecondChoice(false)
                .availabilityCommentsFirstChoice("Mornings")
                .availabilityCommentsSecondChoice("Afternoons")
                .courseInterests(Map.of("CMPSC 8", CourseInterest.ENTHUSIASTIC))
                .topicProficiencies(Map.of("Java", 4, "Python", 5))
                .interests(Map.of("Research", 3))
                .priorCoursework(
                    new ArrayList<>(
                        List.of(
                            PriorCoursework.builder()
                                .ucsbCourse(true)
                                .courseNumber("CMPSC 156")
                                .courseTitle("Advanced App Programming")
                                .term("W26")
                                .grade("A")
                                .build(),
                            PriorCoursework.builder()
                                .ucsbCourse(false)
                                .otherSchool("De Anza")
                                .courseNumber("CIS 22A")
                                .build())))
                .residencyStatus(ResidencyStatus.US_CITIZEN)
                .languageExam(LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT)
                .languageExamDatePassed("F25")
                .classLevel(ClassLevel.PHD)
                .videoLink("https://example.org/video")
                .previousServiceAsUla(2)
                .permNumber("A1B2C3D")
                .bsMsStudent(true)
                .studentStatusNextQuarter(StudentStatus.UNDERGRADUATE)
                .wantsTaEligibility(true)
                .otherCampusJob(OtherCampusJob.NO)
                .priorUcsbEmployment(true)
                .employeeId("1234567")
                .i9Appointment(true)
                .trainingCommitment(TrainingCommitment.UNSURE)
                .trainingCommitmentExplanation("Because")
                .changingMajor(false)
                .build());
    flushAndForget();

    DraftApplication found = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    assertEquals("Chris", found.getFirstName());
    assertEquals(3.8, found.getGpaMajor());
    assertEquals(Boolean.TRUE, found.getAvailableForLecturesFirstChoice());
    assertEquals(Boolean.FALSE, found.getAvailableForLecturesSecondChoice());
    assertEquals(Map.of("CMPSC 8", CourseInterest.ENTHUSIASTIC), found.getCourseInterests());
    assertEquals(Map.of("Java", 4, "Python", 5), found.getTopicProficiencies());
    assertEquals(Map.of("Research", 3), found.getInterests());
    assertEquals(2, found.getPriorCoursework().size());
    assertEquals("Advanced App Programming", found.getPriorCoursework().get(0).getCourseTitle());
    assertTrue(found.getPriorCoursework().get(0).isUcsbCourse());
    assertFalse(found.getPriorCoursework().get(1).isUcsbCourse());
    assertEquals("De Anza", found.getPriorCoursework().get(1).getOtherSchool());
    assertEquals(ClassLevel.PHD, found.getClassLevel());
    assertEquals(LanguageExamStatus.PASSED_US_PERMANENT_RESIDENT, found.getLanguageExam());
    assertEquals(TrainingCommitment.UNSURE, found.getTrainingCommitment());
    assertEquals(Boolean.TRUE, found.getI9Appointment());
    assertEquals(7L, found.getNoticeVersionId());
  }

  @Test
  public void changing_a_collection_is_saved() {
    Recruitment r = recruitment("20261");
    DraftApplication saved =
        draftApplicationRepository.save(
            DraftApplication.builder()
                .recruitmentId(r.getId())
                .email("grad@ucsb.edu")
                .topicProficiencies(Map.of("Java", 4))
                .build());
    flushAndForget();

    DraftApplication found = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    found.setTopicProficiencies(Map.of("Java", 5, "Go", 2));
    found.setPriorCoursework(List.of(PriorCoursework.builder().courseNumber("CMPSC 8").build()));
    draftApplicationRepository.save(found);
    flushAndForget();

    DraftApplication again = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    assertEquals(Map.of("Java", 5, "Go", 2), again.getTopicProficiencies());
    assertEquals(1, again.getPriorCoursework().size());
  }

  @Test
  public void the_version_starts_at_zero_and_counts_the_saves() {
    Recruitment r = recruitment("20261");
    DraftApplication saved =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    flushAndForget();
    assertEquals(0, draftApplicationRepository.findById(saved.getId()).orElseThrow().getVersion());

    DraftApplication first = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    first.setComments("one");
    DraftApplication afterFirst = draftApplicationRepository.save(first);
    flushAndForget();
    assertEquals(1, afterFirst.getVersion());

    DraftApplication second = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    second.setComments("two");
    DraftApplication afterSecond = draftApplicationRepository.save(second);
    flushAndForget();
    assertEquals(2, afterSecond.getVersion());
    assertEquals(2, draftApplicationRepository.findById(saved.getId()).orElseThrow().getVersion());
  }

  @Test
  public void a_save_made_from_an_older_version_is_refused_and_changes_nothing() {
    Recruitment r = recruitment("20261");
    DraftApplication saved =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    flushAndForget();

    // Two tabs both read version 0.
    DraftApplication tabOne = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    entityManager.detach(tabOne);
    DraftApplication tabTwo = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    entityManager.detach(tabTwo);

    tabOne.setComments("from tab one");
    draftApplicationRepository.save(tabOne);
    flushAndForget();

    tabTwo.setComments("from tab two");
    assertThrows(
        ObjectOptimisticLockingFailureException.class,
        () -> {
          draftApplicationRepository.save(tabTwo);
          entityManager.flush();
        });
    entityManager.clear();

    DraftApplication found = draftApplicationRepository.findById(saved.getId()).orElseThrow();
    assertEquals("from tab one", found.getComments());
    assertEquals(1, found.getVersion());
  }

  @Test
  public void a_person_has_at_most_one_draft_per_recruitment() {
    Recruitment r = recruitment("20261");
    Recruitment other = recruitment("20262");
    draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    flushAndForget();

    // The same person may have drafts for other recruitments, and others for this one.
    draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(other.getId()).email("grad@ucsb.edu").build());
    draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(r.getId()).email("other@ucsb.edu").build());
    flushAndForget();

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          draftApplicationRepository.save(
              DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
          entityManager.flush();
        });
  }

  @Test
  public void finders_use_the_person_and_the_recruitment() {
    Recruitment r = recruitment("20261");
    Recruitment other = recruitment("20262");
    DraftApplication first =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    DraftApplication second =
        draftApplicationRepository.save(
            DraftApplication.builder().recruitmentId(other.getId()).email("grad@ucsb.edu").build());
    draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(r.getId()).email("other@ucsb.edu").build());
    flushAndForget();

    assertEquals(
        first.getId(),
        draftApplicationRepository
            .findByEmailAndRecruitmentId("grad@ucsb.edu", r.getId())
            .orElseThrow()
            .getId());
    assertTrue(
        draftApplicationRepository
            .findByEmailAndRecruitmentId("nobody@ucsb.edu", r.getId())
            .isEmpty());
    // Newest first.
    assertEquals(
        List.of(second.getId(), first.getId()),
        draftApplicationRepository.findByEmailOrderByIdDesc("grad@ucsb.edu").stream()
            .map(DraftApplication::getId)
            .toList());
  }

  @Test
  public void deleting_a_recruitment_deletes_its_drafts() {
    Recruitment r = recruitment("20261");
    draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(r.getId()).email("grad@ucsb.edu").build());
    flushAndForget();
    assertEquals(1, draftApplicationRepository.count());

    recruitmentRepository.deleteById(r.getId());
    flushAndForget();

    assertEquals(0, draftApplicationRepository.count());
  }

  // ---- issue #417: students with both a draft and an application ----

  private DraftApplication draftFor(Recruitment r, String email) {
    return draftApplicationRepository.save(
        DraftApplication.builder().recruitmentId(r.getId()).email(email).build());
  }

  private Application applicationFor(
      Recruitment r,
      String email,
      int attempt,
      ApplicationReviewStatus status,
      ApplicationOrigin origin) {
    return applicationRepository.save(
        Application.builder()
            .recruitmentId(r.getId())
            .email(email)
            .attemptNumber(attempt)
            .status(status)
            .origin(origin)
            .build());
  }

  private List<DraftConflict> conflicts(Recruitment r) {
    flushAndForget();
    return draftApplicationRepository.findConflictsWithApplications(
        r.getId(), ApplicationReviewStatus.CANCELLED);
  }

  @Test
  public void a_draft_beside_an_application_is_a_conflict_and_nothing_else_is() {
    Recruitment r = recruitment("20261");
    Recruitment other = recruitment("20262");
    // Bob: a draft and a pending application, the case the warning is for.
    DraftApplication bobDraft = draftFor(r, "bob@ucsb.edu");
    Application bobApplication =
        applicationFor(
            r, "bob@ucsb.edu", 1, ApplicationReviewStatus.PENDING, ApplicationOrigin.APPLICANT);
    // Ada: an admin's test application counts like any other, as the Applications page lists it.
    DraftApplication adaDraft = draftFor(r, "ada@ucsb.edu");
    Application adaApplication =
        applicationFor(
            r, "ada@ucsb.edu", 1, ApplicationReviewStatus.HIRED, ApplicationOrigin.ADMIN_TEST);
    // Cy cancelled and started again (issue #318): the cancelled one is history, not a conflict.
    draftFor(r, "cy@ucsb.edu");
    applicationFor(
        r, "cy@ucsb.edu", 1, ApplicationReviewStatus.CANCELLED, ApplicationOrigin.APPLICANT);
    // Dee has only an application, Eve only a draft.
    applicationFor(
        r, "dee@ucsb.edu", 1, ApplicationReviewStatus.PENDING, ApplicationOrigin.APPLICANT);
    draftFor(r, "eve@ucsb.edu");
    // Fay's draft and application are to different recruitments.
    draftFor(r, "fay@ucsb.edu");
    applicationFor(
        other, "fay@ucsb.edu", 1, ApplicationReviewStatus.PENDING, ApplicationOrigin.APPLICANT);

    // By email.
    assertEquals(
        List.of(
            new DraftConflict("ada@ucsb.edu", adaDraft.getId(), adaApplication.getId()),
            new DraftConflict("bob@ucsb.edu", bobDraft.getId(), bobApplication.getId())),
        conflicts(r));
    // Each recruitment by itself: the other one has no drafts.
    assertEquals(List.of(), conflicts(other));
  }

  /** Several applications beside one draft (cancelled and started again, say) are one row each. */
  @Test
  public void each_application_beside_a_draft_is_its_own_row_by_application_id() {
    Recruitment r = recruitment("20261");
    DraftApplication draft = draftFor(r, "bob@ucsb.edu");
    Application first =
        applicationFor(
            r, "bob@ucsb.edu", 1, ApplicationReviewStatus.PENDING, ApplicationOrigin.APPLICANT);
    Application second =
        applicationFor(
            r, "bob@ucsb.edu", 2, ApplicationReviewStatus.PENDING, ApplicationOrigin.APPLICANT);

    assertEquals(
        List.of(
            new DraftConflict("bob@ucsb.edu", draft.getId(), first.getId()),
            new DraftConflict("bob@ucsb.edu", draft.getId(), second.getId())),
        conflicts(r));
  }
}
