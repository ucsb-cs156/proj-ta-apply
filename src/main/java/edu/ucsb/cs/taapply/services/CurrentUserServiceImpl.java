package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.Collection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class CurrentUserServiceImpl extends CurrentUserService {

  @Autowired private UserRepository userRepository;
  @Autowired private GrantedAuthoritiesService grantedAuthoritiesService;

  @Autowired private GoogleSignInService googleSignInService;

  @Override
  public CurrentUser getCurrentUser() {
    log.info("getCurrentUser called");
    User user = getUser();
    log.info("getCurrentUser: user is {}", user);
    CurrentUser cu = CurrentUser.builder().user(user).roles(getRoles()).build();
    log.info("getCurrentUser returns {}", cu);
    return cu;
  }

  @Override
  public User getUser() {
    SecurityContext securityContext = SecurityContextHolder.getContext();
    Authentication authentication = securityContext.getAuthentication();
    log.info("getUser: authentication is {}", authentication);
    if (authentication instanceof OAuth2AuthenticationToken) {
      OidcUser oAuthUser = (OidcUser) authentication.getPrincipal();
      log.info("getUser: oAuthUser is {}", oAuthUser);
      User user = userRepository.findByEmail(oAuthUser.getEmail()).orElse(null);
      if (user != null) {
        log.info("getUser: user found in repository: {}", user);
        return user;
      }
      googleSignInService.signInUser((OidcUser) oAuthUser);
      user = userRepository.findByEmail(oAuthUser.getEmail()).orElse(null);
      log.info("getUser: user after processSignIn is {}", user);
      return user;
    }
    log.info("getUser: authentication is not OAuth2AuthenticationToken, returning null");
    log.info("getUser: authentication class is {}", authentication.getClass().getName());
    return null;
  }

  @Override
  public Collection<? extends GrantedAuthority> getRoles() {
    // With independent roles there is no RoleHierarchy to expand: every role a user holds
    // (including ROLE_USER) is granted explicitly at sign-in and on each request, so the
    // authorities already on the security context are the complete set.
    return grantedAuthoritiesService.getGrantedAuthorities();
  }
}
