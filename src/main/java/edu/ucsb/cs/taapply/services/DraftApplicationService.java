package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.DraftAdminComment;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.DraftAdminCommentRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The writes that keep a student from having both a draft and a finalized application to the same
 * recruitment (issue #417). A finalized application is one that is not CANCELLED: one who cancelled
 * may start again (issue #318), with a new draft, or turn the cancelled application back into a
 * draft (issue #420).
 *
 * <p>Each method is one database transaction. Submitting saves the application and deletes the
 * draft (and the admin's comments on it) together, so a failure part way leaves neither the new
 * application nor a missing draft behind. Opening or saving a draft checks, in the same transaction
 * as the write, that the student has no application yet. Turning a cancelled application back into
 * a draft creates the draft and deletes the application together.
 *
 * <p>The rule cannot be a database constraint: it spans two tables, and the only way to enforce it
 * in the database would be a trigger written twice, once for H2 and once for Postgres. The admin's
 * Applications and Draft Applications pages report any student who breaks it.
 */
@Service
public class DraftApplicationService {

  @Autowired DraftApplicationRepository draftApplicationRepository;
  @Autowired DraftAdminCommentRepository draftAdminCommentRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired CandidateRankingRepository candidateRankingRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired ApplicationAccessService applicationAccessService;

  /** Why a submission, or a draft, is refused once there is an application. */
  public static final String ALREADY_APPLIED =
      "You already have an application for this recruitment";

  /** Why an application that is not cancelled cannot be turned back into a draft (issue #420). */
  public static final String NOT_CANCELLED =
      "Only a cancelled application can be turned into a new application";

  /** Why a cancelled application cannot become a draft once applications have closed. */
  public static final String NOT_OPEN = "Applications are not currently open for this recruitment";

  /** Why a cancelled application cannot become a draft beside the draft already there. */
  public static final String ALREADY_DRAFTING =
      "You already have a draft application for this recruitment";

  /** Refuses (400) a student who already has an application to the recruitment, not cancelled. */
  public void requireNoApplication(String email, Long recruitmentId) {
    if (applicationRepository.existsByEmailAndRecruitmentIdAndStatusNot(
        email, recruitmentId, ApplicationReviewStatus.CANCELLED)) {
      throw new IllegalArgumentException(ALREADY_APPLIED);
    }
  }

  /**
   * Saves a newly submitted application and deletes the draft it grew from, in one transaction.
   * Whatever an admin wrote about the draft carries over to the application (issue #296), and is
   * deleted with the draft; if any of these writes fails, none of them is kept.
   */
  @Transactional
  public void submit(Application application) {
    Optional<DraftApplication> draft =
        draftApplicationRepository.findByEmailAndRecruitmentId(
            application.getEmail(), application.getRecruitmentId());
    draft
        .flatMap(d -> draftAdminCommentRepository.findById(d.getId()))
        .ifPresent(c -> application.setAdminComments(c.getComments()));
    applicationRepository.save(application);
    draft.ifPresent(
        d -> {
          draftAdminCommentRepository.deleteById(d.getId());
          draftApplicationRepository.delete(d);
        });
  }

  /**
   * The student's draft for the recruitment, created empty if there is none; refused if they
   * already have an application to it. If the same person's form opened twice at once, the second
   * insert breaks the unique constraint and the exception is thrown out of this transaction for the
   * caller to answer with the draft the first one made.
   */
  @Transactional
  public DraftApplication open(String email, Long recruitmentId) {
    requireNoApplication(email, recruitmentId);
    return draftApplicationRepository
        .findByEmailAndRecruitmentId(email, recruitmentId)
        .orElseGet(
            () ->
                draftApplicationRepository.save(
                    DraftApplication.builder().email(email).recruitmentId(recruitmentId).build()));
  }

  /** Saves a draft; refused if the student already has an application to its recruitment. */
  @Transactional
  public DraftApplication save(DraftApplication draft) {
    requireNoApplication(draft.getEmail(), draft.getRecruitmentId());
    return draftApplicationRepository.save(draft);
  }

  /**
   * Turns one of the student's cancelled applications back into a draft (issue #420): "Create a new
   * application". In one transaction it creates the draft from the application's answers, moves the
   * admin's comments on the application to the draft (they go back to the application on submit,
   * issue #296), deletes the faculty's rankings of the application and deletes the application. If
   * any of these fails, none is kept: the cancelled application stays and there is no draft.
   *
   * <p>Refused with 404 for an unknown application, 403 for someone else's, and 400 unless the
   * application is cancelled, its recruitment is accepting applications, and the student has
   * neither a live application nor a draft for it. Only this application is deleted: an older
   * cancelled one to the same recruitment stays, and the next submission's attempt number is one
   * more than the highest left.
   *
   * <p>The audit trail of an admin's edits to the application is kept: it is history, and it has no
   * foreign key to the application, so its rows simply name an id that no longer exists. If the
   * same person asks twice at once, the second draft insert breaks the unique constraint and the
   * exception is thrown out of this transaction, as for {@link #open}.
   */
  @Transactional
  public DraftApplication resumeCancelled(String email, Long applicationId) {
    Application application =
        applicationRepository
            .findById(applicationId)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, applicationId));
    if (!email.equals(application.getEmail())) {
      throw new ForbiddenException("That application belongs to someone else");
    }
    if (application.getStatus() != ApplicationReviewStatus.CANCELLED) {
      throw new IllegalArgumentException(NOT_CANCELLED);
    }
    Long recruitmentId = application.getRecruitmentId();
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    if (!applicationAccessService.acceptingApplications(recruitment)) {
      throw new IllegalArgumentException(NOT_OPEN);
    }
    requireNoApplication(email, recruitmentId);
    if (draftApplicationRepository.findByEmailAndRecruitmentId(email, recruitmentId).isPresent()) {
      throw new IllegalArgumentException(ALREADY_DRAFTING);
    }

    DraftApplication draft = draftApplicationRepository.save(draftFrom(application));
    if (application.getAdminComments() != null) {
      draftAdminCommentRepository.save(
          new DraftAdminComment(draft.getId(), application.getAdminComments()));
    }
    candidateRankingRepository.deleteByApplicationId(applicationId);
    applicationRepository.delete(application);
    return draft;
  }

  /**
   * A new, unsaved draft holding a submitted application's answers: every field the two share,
   * except the cancellation (reason and time). What only an application has (status, attempt
   * number, origin, submission time, post-application comments, admin comments, the tentative
   * assignment) has no place on a draft and is not copied. The first name is never null, even for
   * an application that has none, so the form takes the draft as one it has saved before and starts
   * from these answers (see {@code draftWasSaved} in the frontend).
   */
  static DraftApplication draftFrom(Application a) {
    return DraftApplication.builder()
        .recruitmentId(a.getRecruitmentId())
        .email(a.getEmail())
        .noticeVersionId(a.getNoticeVersionId())
        .firstName(Objects.requireNonNullElse(a.getFirstName(), ""))
        .middleName(a.getMiddleName())
        .lastName(a.getLastName())
        .major(a.getMajor())
        .gpaMajor(a.getGpaMajor())
        .gpaOverall(a.getGpaOverall())
        .firstQuarter(a.isFirstQuarter())
        .yearInProgram(a.getYearInProgram())
        .graduationDate(a.getGraduationDate())
        .prevExperience(a.getPrevExperience())
        .comments(a.getComments())
        .firstChoiceCourse(a.getFirstChoiceCourse())
        .secondChoiceCourse(a.getSecondChoiceCourse())
        .availableForLecturesFirstChoice(a.isAvailableForLecturesFirstChoice())
        .availableForLecturesSecondChoice(a.isAvailableForLecturesSecondChoice())
        .availableForDiscussionFirstChoice(a.isAvailableForDiscussionFirstChoice())
        .availableForDiscussionSecondChoice(a.isAvailableForDiscussionSecondChoice())
        .availabilityCommentsFirstChoice(a.getAvailabilityCommentsFirstChoice())
        .availabilityCommentsSecondChoice(a.getAvailabilityCommentsSecondChoice())
        .courseInterests(new HashMap<>(a.getCourseInterests()))
        .topicProficiencies(new HashMap<>(a.getTopicProficiencies()))
        .interests(new HashMap<>(a.getInterests()))
        .priorCoursework(
            a.getPriorCoursework().stream()
                .map(
                    row ->
                        PriorCoursework.builder()
                            .ucsbCourse(row.isUcsbCourse())
                            .otherSchool(row.getOtherSchool())
                            .courseNumber(row.getCourseNumber())
                            .courseTitle(row.getCourseTitle())
                            .term(row.getTerm())
                            .grade(row.getGrade())
                            .build())
                .collect(Collectors.toCollection(ArrayList::new)))
        .residencyStatus(a.getResidencyStatus())
        .languageExam(a.getLanguageExam())
        .languageExamDatePassed(a.getLanguageExamDatePassed())
        .classLevel(a.getClassLevel())
        .videoLink(a.getVideoLink())
        .previousServiceAsUla(a.getPreviousServiceAsUla())
        .permNumber(a.getPermNumber())
        .bsMsStudent(a.getBsMsStudent())
        .studentStatusNextQuarter(a.getStudentStatusNextQuarter())
        .wantsTaEligibility(a.getWantsTaEligibility())
        .otherCampusJob(a.getOtherCampusJob())
        .priorUcsbEmployment(a.getPriorUcsbEmployment())
        .employeeId(a.getEmployeeId())
        .i9Appointment(a.getI9Appointment())
        .trainingCommitment(a.getTrainingCommitment())
        .trainingCommitmentExplanation(a.getTrainingCommitmentExplanation())
        .changingMajor(a.getChangingMajor())
        .build();
  }
}
