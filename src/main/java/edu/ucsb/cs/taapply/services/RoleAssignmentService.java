package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.utilities.CanonicalFormConverter;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

/**
 * The single place that decides which roles an email address holds.
 *
 * <p>This is deliberately shared by {@link GoogleSignInServiceImpl} (at login) and {@code
 * RoleUpdateInterceptor} (on every request). Those two must always agree, and they previously held
 * separate copies of the logic, which is a drift risk that grows with each new role.
 *
 * <p>ADMIN, INSTRUCTOR and GRAD_STUDENT are independent: a user may hold any combination. UNDERGRAD
 * is the exception, being defined by the absence of the other three.
 */
@Service
public class RoleAssignmentService {

  @Autowired private AdminRepository adminRepository;
  @Autowired private InstructorRepository instructorRepository;
  @Autowired private GradStudentRepository gradStudentRepository;

  @Value("#{'${app.admin.emails}'.split(',')}")
  private List<String> adminEmails;

  public static final String ROLE_USER = "ROLE_USER";
  public static final String ROLE_ADMIN = "ROLE_ADMIN";
  public static final String ROLE_INSTRUCTOR = "ROLE_INSTRUCTOR";
  public static final String ROLE_GRAD_STUDENT = "ROLE_GRAD_STUDENT";
  public static final String ROLE_UNDERGRAD = "ROLE_UNDERGRAD";

  public static final String UCSB_EMAIL_SUFFIX = "@ucsb.edu";

  /**
   * The roles this service owns. The interceptor strips these before recomputing, so that a role
   * removed from the database is dropped from a live session too.
   */
  public static final Set<String> MANAGED_ROLES =
      Set.of(ROLE_USER, ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_GRAD_STUDENT, ROLE_UNDERGRAD);

  /**
   * Holding at least one of these is what entitles someone to use the app at all. ROLE_USER is not
   * among them: it is granted to anyone who can complete a Google login, which is not a decision
   * this app makes.
   */
  public static final Set<String> ACCESS_ROLES =
      Set.of(ROLE_ADMIN, ROLE_INSTRUCTOR, ROLE_GRAD_STUDENT, ROLE_UNDERGRAD);

  /**
   * Whether these authorities entitle the holder to use the app. A signed-in Google user with a
   * non-UCSB address who is in none of the role tables has only ROLE_USER, and is turned away.
   */
  public static boolean grantsAccess(Collection<? extends GrantedAuthority> authorities) {
    return authorities.stream().anyMatch(a -> ACCESS_ROLES.contains(a.getAuthority()));
  }

  /**
   * Whether an address belongs to UCSB. The address is canonicalized first, so {@code
   * @umail.ucsb.edu} counts (CanonicalFormConverter maps it to {@code @ucsb.edu}) and case does not
   * matter.
   */
  public static boolean isUcsbEmail(String email) {
    if (email == null) {
      return false;
    }
    return CanonicalFormConverter.convertToValidEmail(email).endsWith(UCSB_EMAIL_SUFFIX);
  }

  /**
   * Every authority the given email should hold. ROLE_USER is always granted: there is no role
   * hierarchy, so without it an admin would fail {@code hasRole('ROLE_USER')}.
   */
  public Set<GrantedAuthority> authoritiesFor(String email) {
    // adminEmails is never null: app.admin.emails has a default in application.properties, and
    // Spring fails to start if it is missing entirely.
    boolean isAdmin = adminEmails.contains(email) || adminRepository.existsByEmail(email);
    boolean isInstructor = instructorRepository.existsByEmail(email);
    boolean isGradStudent = gradStudentRepository.existsByEmail(email);

    Set<GrantedAuthority> authorities = new HashSet<>();
    authorities.add(new SimpleGrantedAuthority(ROLE_USER));

    if (isAdmin) {
      authorities.add(new SimpleGrantedAuthority(ROLE_ADMIN));
    }
    if (isInstructor) {
      authorities.add(new SimpleGrantedAuthority(ROLE_INSTRUCTOR));
    }
    if (isGradStudent) {
      authorities.add(new SimpleGrantedAuthority(ROLE_GRAD_STUDENT));
    }
    // An undergrad is a UCSB member with none of the other roles: someone who would apply for a
    // ULA position rather than a TA position.
    if (!isAdmin && !isInstructor && !isGradStudent && isUcsbEmail(email)) {
      authorities.add(new SimpleGrantedAuthority(ROLE_UNDERGRAD));
    }

    return authorities;
  }
}
