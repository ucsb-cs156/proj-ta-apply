package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import java.time.LocalDate;
import org.springframework.stereotype.Service;

/**
 * The rules about who may apply to what, and when an application may still be changed.
 *
 * <p>Kept in one place because the same questions are asked by several endpoints and by the
 * frontend, and because getting them wrong is the worst failure this iteration could ship: an
 * applicant editing after applications have closed. Any signed-in user may apply to any
 * recruitment, TA or ULA, so there is no rule here about who applies to what.
 */
@Service
public class ApplicationAccessService {

  /** How long after closing a recruitment still counts as recent, for comments (issue #107). */
  public static final int RECENT_MONTHS = 6;

  /** Applications may only be created against an open recruitment. */
  public boolean acceptingApplications(Recruitment recruitment) {
    return recruitment.getApplicationStatus() == ApplicationStatus.OPEN;
  }

  /**
   * Whether the whole application may still be edited: for as long as the admin keeps applications
   * open (issue #98). The primary consideration date is a promise about review, not a deadline for
   * changes, so it plays no part here.
   */
  public boolean editable(Recruitment recruitment) {
    return acceptingApplications(recruitment);
  }

  /**
   * Whether a closed recruitment closed recently: within the last {@link #RECENT_MONTHS}, counting
   * the day six months on as still recent. A recruitment that is open, or that has no recorded
   * closing date, is not "recently closed".
   */
  public boolean recentlyClosed(Recruitment recruitment, LocalDate today) {
    if (acceptingApplications(recruitment) || recruitment.getActualClosingDate() == null) {
      return false;
    }
    return !today.isAfter(recruitment.getActualClosingDate().plusMonths(RECENT_MONTHS));
  }

  /**
   * Whether post-application comments may still be changed: while the recruitment is open, and for
   * six months after it closes (issue #107), as the place for what has changed since applying.
   */
  public boolean commentable(Recruitment recruitment, LocalDate today) {
    return acceptingApplications(recruitment) || recentlyClosed(recruitment, today);
  }
}
