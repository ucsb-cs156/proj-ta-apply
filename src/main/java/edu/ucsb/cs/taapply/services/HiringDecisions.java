package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;

/**
 * The rules about releasing hiring decisions, i.e. publishing a recruitment's assignments (issue
 * #237; design in docs/design/AdminUserInterfaceDesign.md, "Hiring decisions and reopening"). One
 * place, so the endpoint that refuses a release, the steps endpoint and the published assignments
 * page all agree.
 */
public final class HiringDecisions {

  private HiringDecisions() {}

  public static final String CLOSE_RANKING_FIRST =
      "Close Faculty Ranking before releasing hiring decisions.";
  public static final String CLOSE_APPLICATIONS_FIRST =
      "Close Applications before releasing hiring decisions.";
  public static final String ASSIGN_FIRST =
      "Assign candidates to slots before releasing hiring decisions.";

  /**
   * The first prerequisite of releasing hiring decisions that is not met, as the message to show,
   * or null when all are: faculty ranking is closed, applications are closed, and at least one
   * candidate has been assigned.
   */
  public static String unmetPrerequisite(Recruitment recruitment, boolean anyAssigned) {
    if (!"Closed".equals(recruitment.getReviewStatus())) {
      return CLOSE_RANKING_FIRST;
    }
    if (recruitment.getApplicationStatus() == ApplicationStatus.OPEN) {
      return CLOSE_APPLICATIONS_FIRST;
    }
    return anyAssigned ? null : ASSIGN_FIRST;
  }

  /**
   * Whether the released hiring decisions are now tentative: they were released, and applications
   * or faculty ranking have been reopened since. Never "final": a later reopening is always
   * possible.
   */
  public static boolean isTentative(Recruitment recruitment) {
    return Boolean.TRUE.equals(recruitment.getAssignmentsPublished())
        && (recruitment.getApplicationStatus() == ApplicationStatus.OPEN
            || "Open".equals(recruitment.getReviewStatus()));
  }
}
