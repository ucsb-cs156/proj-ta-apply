package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;

/**
 * Whether a recruitment is hidden from students and instructors (issue #496). An admin hides a
 * recruitment with the show/hide button on its card; while hidden it is left out of the lists that
 * feed the student and instructor home pages, its application form and its instructor pages are
 * refused to them, and new applications are not accepted. Admins see it everywhere as before.
 */
public final class RecruitmentVisibility {

  /** The refusal a student or instructor gets for a hidden recruitment's pages. */
  public static final String HIDDEN = "This recruitment is not currently available.";

  private RecruitmentVisibility() {}

  /** Whether the admin has hidden the recruitment; a recruitment with no value is shown. */
  public static boolean isHidden(Recruitment recruitment) {
    return Boolean.TRUE.equals(recruitment.getHidden());
  }

  /**
   * Whether this user may see the recruitment: everyone may, unless it is hidden and they are not
   * an admin.
   */
  public static boolean visibleTo(Recruitment recruitment, boolean admin) {
    return admin || !isHidden(recruitment);
  }
}
