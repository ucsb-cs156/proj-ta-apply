package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Optional;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

/**
 * The rules about who may apply to what, and when an application may still be changed.
 *
 * <p>Kept in one place because the same questions are asked by several endpoints and by the
 * frontend, and because getting them wrong is the worst failure this iteration could ship: a grad
 * student applying to a ULA recruitment, or an applicant editing after the deadline.
 */
@Service
public class ApplicationAccessService {

  /**
   * The kind of recruitment this user may apply to, from their role. Grad students apply for TA
   * positions and undergrads for ULA positions; anyone else applies for nothing.
   */
  public Optional<RecruitmentType> applicableType(
      Collection<? extends GrantedAuthority> authorities) {
    boolean gradStudent = hasRole(authorities, RoleAssignmentService.ROLE_GRAD_STUDENT);
    boolean undergrad = hasRole(authorities, RoleAssignmentService.ROLE_UNDERGRAD);

    // A user holding both is not expected: ROLE_UNDERGRAD is only granted in the absence of the
    // other roles. If it ever happened, the grad student reading wins, since it is the explicit
    // one and TA applications ask for strictly more.
    if (gradStudent) {
      return Optional.of(RecruitmentType.TA);
    }
    return undergrad ? Optional.of(RecruitmentType.ULA) : Optional.empty();
  }

  private static boolean hasRole(Collection<? extends GrantedAuthority> authorities, String role) {
    return authorities != null && authorities.stream().anyMatch(a -> role.equals(a.getAuthority()));
  }

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
