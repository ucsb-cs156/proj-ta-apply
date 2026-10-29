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
 * applicant editing after the deadline. Any signed-in user may apply to any recruitment, TA or ULA,
 * so there is no rule here about who applies to what.
 */
@Service
public class ApplicationAccessService {

  /** Applications may only be created against an open recruitment. */
  public boolean acceptingApplications(Recruitment recruitment) {
    return recruitment.getApplicationStatus() == ApplicationStatus.OPEN;
  }

  /**
   * Whether the whole application may still be edited: the recruitment is open and the primary
   * consideration date has not passed. On the date itself editing is still allowed; it closes the
   * day after.
   */
  public boolean editable(Recruitment recruitment, LocalDate today) {
    if (!acceptingApplications(recruitment)) {
      return false;
    }
    LocalDate deadline = recruitment.getPrimaryConsiderationDate();
    return deadline == null || !today.isAfter(deadline);
  }

  /**
   * Whether post-application comments may still be changed. They outlive the deadline, which is the
   * point of keeping them separate, but not the recruitment closing.
   */
  public boolean commentable(Recruitment recruitment) {
    return acceptingApplications(recruitment);
  }
}
