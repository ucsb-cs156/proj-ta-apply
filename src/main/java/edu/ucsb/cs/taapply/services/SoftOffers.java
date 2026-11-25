package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDateTime;

/**
 * The rules about soft offers (issue #483): the optional, ULA-only step after hiring decisions are
 * released in which each assigned applicant is asked whether to proceed to a formal offer. One
 * place, like {@link HiringDecisions}, so the release endpoint (issue #485), the applicant's soft
 * offer (issue #486) and the results page (issue #487) agree.
 */
public final class SoftOffers {

  private SoftOffers() {}

  public static final String ULA_ONLY = "Soft offers are a ULA feature.";
  public static final String RELEASE_HIRING_DECISIONS_FIRST =
      "Release hiring decisions before releasing soft offers.";
  public static final String DEADLINE_IN_PAST = "The soft offer deadline must be in the future.";

  /** Whether soft offers have been released for this recruitment. */
  public static boolean isReleased(Recruitment recruitment) {
    return recruitment.getSoftOffersReleasedAt() != null;
  }

  /**
   * The first prerequisite of releasing soft offers (or changing their deadline) that is not met,
   * as the message to show, or null when all are: the recruitment is a ULA one, and hiring
   * decisions have been released.
   */
  public static String unmetPrerequisite(Recruitment recruitment) {
    if (recruitment.getType() != RecruitmentType.ULA) {
      return ULA_ONLY;
    }
    if (!Boolean.TRUE.equals(recruitment.getAssignmentsPublished())) {
      return RELEASE_HIRING_DECISIONS_FIRST;
    }
    return null;
  }

  /** Why a deadline is refused, or null when it is strictly after {@code now}. */
  public static String deadlineProblem(LocalDateTime deadline, LocalDateTime now) {
    return deadline.isAfter(now) ? null : DEADLINE_IN_PAST;
  }
}
