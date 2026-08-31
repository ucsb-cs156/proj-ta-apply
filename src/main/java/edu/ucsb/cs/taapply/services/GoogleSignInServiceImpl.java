package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.HashSet;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
public class GoogleSignInServiceImpl extends OidcUserService implements GoogleSignInService {

  @Autowired private UserRepository userRepository;
  @Autowired private RoleAssignmentService roleAssignmentService;

  @Override
  public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
    OidcUser oidcUser = super.loadUser(userRequest);
    return processSignIn(oidcUser);
  }

  public void signInUser(OidcUser oidcUser) {
    processSignIn(oidcUser);
  }

  private OidcUser processSignIn(OidcUser oidcUser) {
    Optional<User> existing = userRepository.findByEmail(oidcUser.getEmail());
    Set<GrantedAuthority> authorities = new HashSet<>();

    String email = oidcUser.getEmail();

    // Shared with RoleUpdateInterceptor so login and per-request role refresh cannot disagree.
    authorities.addAll(roleAssignmentService.authoritiesFor(email));

    // Turn away anyone with none of the access roles, before creating a User row for them.
    // Throwing here fails the OAuth flow, so no session is established at all; SecurityConfig
    // sends them to /unauthorized.
    if (!RoleAssignmentService.grantsAccess(authorities)) {
      throw new OAuth2AuthenticationException(
          new OAuth2Error("unauthorized_user"),
          "Not authorized to access this application: " + email);
    }

    String fullName = oidcUser.getFullName();
    String givenName = oidcUser.getGivenName();
    String familyName = oidcUser.getFamilyName();
    String pictureUrl = oidcUser.getPicture();

    if (existing.isPresent()) {
      User user = existing.get();
      boolean changed = false;
      if (!Objects.equals(fullName, user.getFullName())) {
        user.setFullName(fullName);
        changed = true;
      }
      if (!Objects.equals(givenName, user.getGivenName())) {
        user.setGivenName(givenName);
        changed = true;
      }
      if (!Objects.equals(familyName, user.getFamilyName())) {
        user.setFamilyName(familyName);
        changed = true;
      }
      if (!Objects.equals(pictureUrl, user.getPictureUrl())) {
        user.setPictureUrl(pictureUrl);
        changed = true;
      }
      if (changed) {
        userRepository.save(user);
      }
    } else {
      User newUser =
          User.builder()
              .googleSub(oidcUser.getSubject())
              .email(oidcUser.getEmail())
              .fullName(fullName)
              .givenName(givenName)
              .familyName(familyName)
              .pictureUrl(pictureUrl)
              .build();
      userRepository.save(newUser);
    }

    authorities.addAll(oidcUser.getAuthorities());
    return new DefaultOidcUser(authorities, oidcUser.getIdToken(), oidcUser.getUserInfo());
  }
}
