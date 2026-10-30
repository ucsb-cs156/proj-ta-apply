package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
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
   * Whether post-application comments may still be changed. The same rule as editing: until the
   * recruitment closes. They stay a separate field because reviewers read them as "what changed
   * since you applied".
   */
  public boolean commentable(Recruitment recruitment) {
    return acceptingApplications(recruitment);
  }
}
