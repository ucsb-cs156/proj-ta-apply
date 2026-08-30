package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.AdminRepository;
import edu.ucsb.cs.taapply.repository.GradStudentRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

@Service
public class GoogleSignInServiceImpl extends OidcUserService implements GoogleSignInService {

  @Autowired private UserRepository userRepository;
  @Autowired private AdminRepository adminRepository;
  @Autowired private InstructorRepository instructorRepository;
  @Autowired private GradStudentRepository gradStudentRepository;

  @Value("#{'${app.admin.emails}'.split(',')}")
  private List<String> adminEmails;

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

    // The three roles are independent, so these are separate ifs rather than an else-if chain.
    // ROLE_USER is granted unconditionally: there is no RoleHierarchy to back-fill it, so without
    // this an admin would fail hasRole('ROLE_USER') on /api/currentUser.
    authorities.add(new SimpleGrantedAuthority("ROLE_USER"));

    if ((adminEmails != null && adminEmails.contains(email))
        || adminRepository.existsByEmail(email)) {
      authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
    if (instructorRepository.existsByEmail(email)) {
      authorities.add(new SimpleGrantedAuthority("ROLE_INSTRUCTOR"));
    }
    if (gradStudentRepository.existsByEmail(email)) {
      authorities.add(new SimpleGrantedAuthority("ROLE_GRAD_STUDENT"));
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
