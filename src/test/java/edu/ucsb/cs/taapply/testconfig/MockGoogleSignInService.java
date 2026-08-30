package edu.ucsb.cs.taapply.testconfig;

import edu.ucsb.cs.taapply.services.GoogleSignInService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

@Slf4j
public class MockGoogleSignInService extends OidcUserService implements GoogleSignInService {

  @Override
  public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
    return super.loadUser(userRequest);
  }

  public void signInUser(OidcUser oidcUser) {
    log.info("MockGoogleSignInService.signInUser called with oidcUser: {}", oidcUser);
  }
}
