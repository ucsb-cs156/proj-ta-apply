package edu.ucsb.cs.taapply.testconfig;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import java.util.Collection;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;

public class MockCurrentUserServiceImpl extends CurrentUserService {

  public User getMockUser(SecurityContext securityContext, Authentication authentication) {
    Object principal = authentication.getPrincipal();

    String googleSub = "fakeUser";
    String email = "user@example.org";
    String pictureUrl = "https://example.org/fake.jpg";
    String fullName = "Fake User";
    String givenName = "Fake";
    String familyName = "User";

    if (principal instanceof org.springframework.security.core.userdetails.User u) {
      googleSub = "fake_" + u.getUsername();
      email = u.getUsername() + "@example.org";
      pictureUrl = "https://example.org/" + u.getUsername() + ".jpg";
      fullName = "Fake " + u.getUsername();
      familyName = u.getUsername();
    } else if (principal instanceof OAuth2User oAuth2User) {
      googleSub = oAuth2User.getAttribute("sub");
      email = oAuth2User.getAttribute("email");
      pictureUrl = oAuth2User.getAttribute("picture");
      fullName = oAuth2User.getAttribute("name");
      givenName = oAuth2User.getAttribute("givenname");
      familyName = oAuth2User.getAttribute("familyname");
    }

    return User.builder()
        .googleSub(googleSub)
        .email(email)
        .pictureUrl(pictureUrl)
        .fullName(fullName)
        .givenName(givenName)
        .familyName(familyName)
        .id(1L)
        .build();
  }

  @Override
  public User getUser() {
    SecurityContext securityContext = SecurityContextHolder.getContext();
    Authentication authentication = securityContext.getAuthentication();
    if (authentication != null) {
      return getMockUser(securityContext, authentication);
    }
    return null;
  }

  @Override
  public CurrentUser getCurrentUser() {
    return CurrentUser.builder().user(this.getUser()).roles(this.getRoles()).build();
  }

  @Override
  public Collection<? extends GrantedAuthority> getRoles() {
    SecurityContext securityContext = SecurityContextHolder.getContext();
    Authentication authentication = securityContext.getAuthentication();
    return authentication.getAuthorities();
  }
}
