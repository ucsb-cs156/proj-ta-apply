package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.DraftAdminCommentRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The writes that keep a student from having both a draft and a finalized application to the same
 * recruitment (issue #417). A finalized application is one that is not CANCELLED: one who cancelled
 * may start again (issue #318), with a new draft.
 *
 * <p>Each method is one database transaction. Submitting saves the application and deletes the
 * draft (and the admin's comments on it) together, so a failure part way leaves neither the new
 * application nor a missing draft behind. Opening or saving a draft checks, in the same transaction
 * as the write, that the student has no application yet.
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

  /** Why a submission, or a draft, is refused once there is an application. */
  public static final String ALREADY_APPLIED =
      "You already have an application for this recruitment";

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
}
