package edu.ucsb.cs.taapply.testconfig;

import edu.ucsb.cs.taapply.services.CurrentUserService;
import edu.ucsb.cs.taapply.services.GoogleSignInService;
import edu.ucsb.cs.taapply.services.GrantedAuthoritiesService;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

@TestConfiguration
public class TestConfig {

  @Bean
  @Primary
  public CurrentUserService currentUserService() {
    return new MockCurrentUserServiceImpl();
  }

  @Bean
  public GrantedAuthoritiesService grantedAuthoritiesService() {
    return new GrantedAuthoritiesService();
  }

  @Bean
  public GoogleSignInService googleSignInService() {
    return new MockGoogleSignInService();
  }
}
