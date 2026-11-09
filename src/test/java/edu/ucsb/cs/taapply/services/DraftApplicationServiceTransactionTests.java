package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.CourseInterest;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.DraftAdminCommentRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue #417: submitting an application and deleting the draft it grew from are one database
 * transaction, and a draft is opened or saved only after checking, in its own transaction, that the
 * student has no application. These run against the real repositories and the Liquibase-built
 * schema, outside any test-managed transaction, so what they check is what is left in the database
 * after the service returns or throws.
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=none")
@ActiveProfiles("test")
@Import({DraftApplicationService.class, ApplicationAccessService.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class DraftApplicationServiceTransactionTests {

  private static final String EMAIL = "ada@ucsb.edu";

  @Autowired DraftApplicationService service;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired AuditTrailRepository auditTrailRepository;
  @MockitoSpyBean ApplicationRepository applicationRepository;
  @MockitoSpyBean CandidateRankingRepository candidateRankingRepository;
  @MockitoSpyBean DraftApplicationRepository draftApplicationRepository;
  @MockitoSpyBean DraftAdminCommentRepository draftAdminCommentRepository;

  private Long recruitmentId;
  private Long draftId;

  /** Ada has a draft to the recruitment, which is open, with an admin's comment on it. */
  @BeforeEach
  public void a_draft_is_on_file() {
    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter("20261")
                .type(RecruitmentType.TA)
                .applicationStatus(ApplicationStatus.OPEN)
                .build());
    recruitmentId = recruitment.getId();
    draftId =
        draftApplicationRepository
            .save(
                DraftApplication.builder()
                    .recruitmentId(recruitmentId)
                    .email(EMAIL)
                    .firstName("Ada")
                    .build())
            .getId();
    draftAdminCommentRepository.save(new DraftAdminComment(draftId, "Promising"));
  }

  /** Each test commits for real, so each cleans up after itself. */
  @AfterEach
  public void nothing_is_left_behind() {
    auditTrailRepository.deleteAll();
    candidateRankingRepository.deleteAll();
    draftAdminCommentRepository.deleteAll();
    draftApplicationRepository.deleteAll();
    applicationRepository.deleteAll();
    recruitmentCourseRepository.deleteAll();
    recruitmentRepository.deleteAll();
  }

  private Application newApplication() {
    return Application.builder()
        .recruitmentId(recruitmentId)
        .email(EMAIL)
        .firstName("Ada")
        .lastName("Lovelace")
        .build();
  }

  private void anApplicationWithStatus(ApplicationReviewStatus status) {
    applicationRepository.save(newApplication().toBuilder().status(status).build());
  }

  // ---- submitting ----

  @Test
  public void submitting_saves_the_application_and_deletes_the_draft_and_its_comment() {
    Application application = newApplication();

    service.submit(application);

    Application stored = applicationRepository.findById(application.getId()).orElseThrow();
    assertEquals("Promising", stored.getAdminComments());
    assertEquals(0, draftApplicationRepository.count());
    assertEquals(0, draftAdminCommentRepository.count());
  }

  /** The draft cannot be deleted, so the application must not be in the database either. */
  @Test
  public void when_the_draft_cannot_be_deleted_the_application_is_rolled_back() {
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(draftApplicationRepository)
        .delete(any());

    assertThrows(DataAccessResourceFailureException.class, () -> service.submit(newApplication()));

    assertEquals(0, applicationRepository.count());
    assertTrue(draftApplicationRepository.findById(draftId).isPresent());
    assertEquals(
        "Promising", draftAdminCommentRepository.findById(draftId).orElseThrow().getComments());
  }

  /** The comment cannot be deleted: the same, and the draft is not deleted after it. */
  @Test
  public void when_the_draft_s_comment_cannot_be_deleted_nothing_is_kept() {
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(draftAdminCommentRepository)
        .deleteById(any());

    assertThrows(DataAccessResourceFailureException.class, () -> service.submit(newApplication()));

    assertEquals(0, applicationRepository.count());
    assertTrue(draftApplicationRepository.findById(draftId).isPresent());
    assertTrue(draftAdminCommentRepository.findById(draftId).isPresent());
  }

  // ---- opening and saving a draft ----

  @Test
  public void a_draft_is_not_opened_once_there_is_an_application() {
    draftApplicationRepository.deleteAll();
    anApplicationWithStatus(ApplicationReviewStatus.PENDING);

    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> service.open(EMAIL, recruitmentId));

    assertEquals(DraftApplicationService.ALREADY_APPLIED, e.getMessage());
    assertEquals(0, draftApplicationRepository.count());
  }

  /** Issue #318: one who cancelled may start again, with a new draft. */
  @Test
  public void a_draft_is_opened_after_a_cancelled_application() {
    draftApplicationRepository.deleteAll();
    anApplicationWithStatus(ApplicationReviewStatus.CANCELLED);

    DraftApplication opened = service.open(EMAIL, recruitmentId);

    assertEquals(
        EMAIL, draftApplicationRepository.findById(opened.getId()).orElseThrow().getEmail());
  }

  @Test
  public void opening_returns_the_draft_already_on_file() {
    assertEquals(draftId, service.open(EMAIL, recruitmentId).getId());
    assertEquals(1, draftApplicationRepository.count());
  }

  @Test
  public void a_draft_is_not_saved_once_there_is_an_application() {
    anApplicationWithStatus(ApplicationReviewStatus.PENDING);
    DraftApplication draft = draftApplicationRepository.findById(draftId).orElseThrow();
    draft.setFirstName("Grace");

    IllegalArgumentException e =
        assertThrows(IllegalArgumentException.class, () -> service.save(draft));

    assertEquals(DraftApplicationService.ALREADY_APPLIED, e.getMessage());
    assertEquals("Ada", draftApplicationRepository.findById(draftId).orElseThrow().getFirstName());
  }

  @Test
  public void a_draft_is_saved_beside_a_cancelled_application() {
    anApplicationWithStatus(ApplicationReviewStatus.CANCELLED);
    DraftApplication draft = draftApplicationRepository.findById(draftId).orElseThrow();
    draft.setFirstName("Grace");

    assertEquals("Grace", service.save(draft).getFirstName());
    assertEquals(
        "Grace", draftApplicationRepository.findById(draftId).orElseThrow().getFirstName());
  }

  // ---- turning a cancelled application back into a draft (issue #420) ----

  private Long rankingId;
  private Long auditId;

  /**
   * Instead of the draft, Ada has a cancelled application (attempt {@code attempt}) with answers,
   * an admin's comment, a faculty ranking and an audit trail entry. Returns its id.
   */
  private Long aCancelledApplication(int attempt) {
    draftAdminCommentRepository.deleteAll();
    draftApplicationRepository.deleteAll();
    Application cancelled =
        applicationRepository.save(
            newApplication().toBuilder()
                .attemptNumber(attempt)
                .status(ApplicationReviewStatus.CANCELLED)
                .cancellationReason("Took an internship")
                .cancelledAt(LocalDateTime.of(2026, 11, 1, 9, 30))
                .adminComments("Strong in 156")
                .courseInterests(new HashMap<>(Map.of("CMPSC   8", CourseInterest.ENTHUSIASTIC)))
                .priorCoursework(
                    new ArrayList<>(
                        List.of(
                            PriorCoursework.builder()
                                .courseNumber("CMPSC 130A")
                                .term("F25")
                                .grade("A")
                                .build())))
                .build());
    RecruitmentCourse course =
        recruitmentCourseRepository.save(
            RecruitmentCourse.builder()
                .recruitmentId(recruitmentId)
                .courseId("CMPSC   156")
                .section("0100")
                .enrollCode("12345" + attempt)
                .build());
    rankingId =
        candidateRankingRepository
            .save(
                CandidateRanking.builder()
                    .recruitmentCourseId(course.getId())
                    .applicationId(cancelled.getId())
                    .rank(1)
                    .build())
            .getId();
    auditId =
        auditTrailRepository
            .save(
                AuditTrail.builder()
                    .taApplicationId(cancelled.getId())
                    .fieldName("gpaMajor")
                    .oldValue("3.5")
                    .newValue("3.6")
                    .build())
            .getId();
    return cancelled.getId();
  }

  @Test
  public void resuming_turns_the_cancelled_application_into_a_draft() {
    Long applicationId = aCancelledApplication(1);

    DraftApplication draft = service.resumeCancelled(EMAIL, applicationId);

    assertTrue(applicationRepository.findById(applicationId).isEmpty());
    assertTrue(candidateRankingRepository.findById(rankingId).isEmpty());
    DraftApplication stored = draftApplicationRepository.findById(draft.getId()).orElseThrow();
    assertEquals(EMAIL, stored.getEmail());
    assertEquals(recruitmentId, stored.getRecruitmentId());
    assertEquals("Lovelace", stored.getLastName());
    assertEquals(Map.of("CMPSC   8", CourseInterest.ENTHUSIASTIC), stored.getCourseInterests());
    assertEquals("CMPSC 130A", stored.getPriorCoursework().get(0).getCourseNumber());
    assertEquals(
        "Strong in 156",
        draftAdminCommentRepository.findById(draft.getId()).orElseThrow().getComments());
    // History survives: the audit trail has no foreign key to the application.
    assertEquals(
        applicationId, auditTrailRepository.findById(auditId).orElseThrow().getTaApplicationId());
  }

  /** The application cannot be deleted, so there must be no draft either. */
  @Test
  public void when_the_application_cannot_be_deleted_nothing_is_kept() {
    Long applicationId = aCancelledApplication(1);
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(applicationRepository)
        .delete(any());

    assertThrows(
        DataAccessResourceFailureException.class,
        () -> service.resumeCancelled(EMAIL, applicationId));

    Application kept = applicationRepository.findById(applicationId).orElseThrow();
    assertEquals(ApplicationReviewStatus.CANCELLED, kept.getStatus());
    assertEquals("Took an internship", kept.getCancellationReason());
    assertEquals("Strong in 156", kept.getAdminComments());
    assertTrue(candidateRankingRepository.findById(rankingId).isPresent());
    assertEquals(0, draftApplicationRepository.count());
    assertEquals(0, draftAdminCommentRepository.count());
  }

  /** The same when the rankings cannot be deleted. */
  @Test
  public void when_the_rankings_cannot_be_deleted_nothing_is_kept() {
    Long applicationId = aCancelledApplication(1);
    doThrow(new DataAccessResourceFailureException("connection lost"))
        .when(candidateRankingRepository)
        .deleteByApplicationId(any());

    assertThrows(
        DataAccessResourceFailureException.class,
        () -> service.resumeCancelled(EMAIL, applicationId));

    assertTrue(applicationRepository.findById(applicationId).isPresent());
    assertTrue(candidateRankingRepository.findById(rankingId).isPresent());
    assertEquals(0, draftApplicationRepository.count());
    assertEquals(0, draftAdminCommentRepository.count());
  }

  /**
   * Two cancelled applications; Ada turns the older one (attempt 1) back into a draft, so attempt 2
   * is the only row left. Submitting the draft as the next attempt (one more than the highest, 3)
   * fits beside it; one more than the count (2) would not.
   */
  @Test
  public void submitting_after_resuming_an_older_cancelled_application_does_not_collide() {
    Long older = aCancelledApplication(1);
    Long newer = aCancelledApplication(2);
    assertEquals(2, applicationRepository.count());

    DraftApplication draft = service.resumeCancelled(EMAIL, older);
    int next = applicationRepository.maxAttemptNumber(EMAIL, recruitmentId) + 1;
    assertEquals(3, next);
    Application resubmitted = newApplication().toBuilder().attemptNumber(next).build();
    service.submit(resubmitted);

    assertTrue(applicationRepository.findById(newer).isPresent());
    Application stored = applicationRepository.findById(resubmitted.getId()).orElseThrow();
    assertEquals(3, stored.getAttemptNumber());
    assertEquals("Strong in 156", stored.getAdminComments());
    assertTrue(draftApplicationRepository.findById(draft.getId()).isEmpty());
    assertEquals(2, applicationRepository.count());
  }
}
