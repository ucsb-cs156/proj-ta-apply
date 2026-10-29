package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.time.Instant;
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

    // Turn away an outside address that is neither an admin nor an instructor, before creating a
    // User row for them. Throwing here fails the OAuth flow, so no session is established at all;
    // SecurityConfig sends them to /unauthorized.
    if (!RoleAssignmentService.grantsAccess(email, authorities)) {
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
      if (!Objects.equals(fullName, user.getFullName())) {
        user.setFullName(fullName);
      }
      if (!Objects.equals(givenName, user.getGivenName())) {
        user.setGivenName(givenName);
      }
      if (!Objects.equals(familyName, user.getFamilyName())) {
        user.setFamilyName(familyName);
      }
      if (!Objects.equals(pictureUrl, user.getPictureUrl())) {
        user.setPictureUrl(pictureUrl);
      }
      // Signing in is being online; LastOnlineInterceptor keeps the stamp current from here.
      user.setLastOnline(Instant.now());
      userRepository.save(user);
    } else {
      User newUser =
          User.builder()
              .googleSub(oidcUser.getSubject())
              .email(oidcUser.getEmail())
              .fullName(fullName)
              .givenName(givenName)
              .familyName(familyName)
              .pictureUrl(pictureUrl)
              .lastOnline(Instant.now())
              .build();
      userRepository.save(newUser);
    }

    authorities.addAll(oidcUser.getAuthorities());
    return new DefaultOidcUser(authorities, oidcUser.getIdToken(), oidcUser.getUserInfo());
  }
}
