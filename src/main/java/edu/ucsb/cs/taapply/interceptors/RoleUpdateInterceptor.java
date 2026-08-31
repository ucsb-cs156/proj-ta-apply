package edu.ucsb.cs.taapply.interceptors;

import edu.ucsb.cs.taapply.services.RoleAssignmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Recomputes a user's roles on each request, so a role added or removed in the database takes
 * effect without requiring re-login.
 *
 * <p>The roles themselves are decided by {@link RoleAssignmentService}, shared with the sign-in
 * path so the two cannot drift. Here we only strip the roles that service owns and replace them,
 * leaving any other authorities (OIDC scopes, for instance) untouched.
 */
@Component
public class RoleUpdateInterceptor implements HandlerInterceptor {

  @Autowired private RoleAssignmentService roleAssignmentService;

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
          .filter(a -> !RoleAssignmentService.MANAGED_ROLES.contains(a.getAuthority()))
          .forEach(newAuthorities::add);

      newAuthorities.addAll(roleAssignmentService.authoritiesFor(email));

      Authentication newAuth =
          new OAuth2AuthenticationToken(
              oidcUser, newAuthorities, oauthToken.getAuthorizedClientRegistrationId());
      SecurityContextHolder.getContext().setAuthentication(newAuth);
    }

    return true;
  }
}
