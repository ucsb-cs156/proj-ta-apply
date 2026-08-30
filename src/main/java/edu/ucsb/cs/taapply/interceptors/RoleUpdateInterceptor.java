package edu.ucsb.cs.taapply.interceptors;

import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Reloads a user's security context on each request so that role changes (admin, instructor or grad
 * student added or removed in the database) take effect without requiring re-login.
 *
 * <p>The three roles are independent: a user may hold any combination of them. There is
 * deliberately no {@code RoleHierarchy} bean, so every authenticated user is granted {@code
 * ROLE_USER} unconditionally rather than inheriting it from a higher role.
 */
@Component
public class RoleUpdateInterceptor implements HandlerInterceptor {

  private final AdminRepository adminRepository;
  private final InstructorRepository instructorRepository;
  private final GradStudentRepository gradStudentRepository;

  @Value("#{'${app.admin.emails}'.split(',')}")
  private final List<String> adminEmails = new ArrayList<>();

  public RoleUpdateInterceptor(
      AdminRepository adminRepository,
      InstructorRepository instructorRepository,
      GradStudentRepository gradStudentRepository) {
    this.adminRepository = adminRepository;
    this.instructorRepository = instructorRepository;
    this.gradStudentRepository = gradStudentRepository;
  }

  @Override
  public boolean preHandle(
      HttpServletRequest request, HttpServletResponse response, Object handler) {
    SecurityContext securityContext = SecurityContextHolder.getContext();
    Authentication authentication = securityContext.getAuthentication();

    if (authentication instanceof OAuth2AuthenticationToken oauthToken
        && oauthToken.getPrincipal() instanceof OidcUser oidcUser) {
      String email = oidcUser.getEmail();
      Set<GrantedAuthority> newAuthorities = new HashSet<>();
      Collection<? extends GrantedAuthority> current = authentication.getAuthorities();

      current.stream()
          .filter(
              a ->
                  !a.getAuthority().equals("ROLE_ADMIN")
                      && !a.getAuthority().equals("ROLE_INSTRUCTOR")
                      && !a.getAuthority().equals("ROLE_GRAD_STUDENT"))
          .forEach(newAuthorities::add);

      // Every authenticated user is a USER; without this, and with no RoleHierarchy to fall back
      // on, an admin would have no ROLE_USER and would be denied by hasRole('ROLE_USER').
      newAuthorities.add(new SimpleGrantedAuthority("ROLE_USER"));

      if (adminEmails.contains(email) || adminRepository.existsByEmail(email)) {
        newAuthorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
      }
      if (instructorRepository.existsByEmail(email)) {
        newAuthorities.add(new SimpleGrantedAuthority("ROLE_INSTRUCTOR"));
      }
      if (gradStudentRepository.existsByEmail(email)) {
        newAuthorities.add(new SimpleGrantedAuthority("ROLE_GRAD_STUDENT"));
      }

      Authentication newAuth =
          new OAuth2AuthenticationToken(
              oidcUser, newAuthorities, oauthToken.getAuthorizedClientRegistrationId());
      SecurityContextHolder.getContext().setAuthentication(newAuth);
    }

    return true;
  }
}
