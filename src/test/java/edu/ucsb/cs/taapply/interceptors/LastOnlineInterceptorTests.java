package edu.ucsb.cs.taapply.interceptors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;

/**
 * WebConfig registers the interceptor for /api/** only, which the test DummyController is not
 * under, so preHandle is called directly against a real security context.
 */
@ExtendWith(MockitoExtension.class)
public class LastOnlineInterceptorTests {

  @Mock UserRepository userRepository;
  @InjectMocks LastOnlineInterceptor interceptor;

  private static final List<GrantedAuthority> USER_ROLE =
      List.of(new SimpleGrantedAuthority("ROLE_USER"));

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  private static void signInWithGoogle(String email) {
    OidcIdToken idToken =
        new OidcIdToken(
            "token",
            Instant.now(),
            Instant.now().plusSeconds(60),
            Map.of("sub", "123", "email", email));
    DefaultOidcUser oidcUser = new DefaultOidcUser(USER_ROLE, idToken);
    SecurityContextHolder.getContext()
        .setAuthentication(new OAuth2AuthenticationToken(oidcUser, USER_ROLE, "google"));
  }

  private static User user(Instant lastOnline) {
    return User.builder()
        .id(5L)
        .email("user@ucsb.edu")
        .givenName("Chris")
        .familyName("Gaucho")
        .lastOnline(lastOnline)
        .build();
  }

  private boolean request() {
    return interceptor.preHandle(
        new MockHttpServletRequest("GET", "/api/currentUser"),
        new MockHttpServletResponse(),
        new Object());
  }

  @Test
  public void a_user_with_no_stamp_yet_is_stamped_now() {
    signInWithGoogle("user@ucsb.edu");
    User user = user(null);
    when(userRepository.findByEmail("user@ucsb.edu")).thenReturn(Optional.of(user));
    Instant before = Instant.now();

    assertTrue(request());

    assertNotNull(user.getLastOnline());
    assertFalse(user.getLastOnline().isBefore(before));
    assertFalse(user.getLastOnline().isAfter(Instant.now()));
    verify(userRepository, times(1)).save(user);
  }

  @Test
  public void a_stale_stamp_is_refreshed() {
    signInWithGoogle("user@ucsb.edu");
    Instant twoMinutesAgo = Instant.now().minus(Duration.ofMinutes(2));
    User user = user(twoMinutesAgo);
    when(userRepository.findByEmail("user@ucsb.edu")).thenReturn(Optional.of(user));

    assertTrue(request());

    assertTrue(user.getLastOnline().isAfter(twoMinutesAgo));
    verify(userRepository, times(1)).save(user);
  }

  /** A page load makes several requests at once; they must not each write the row. */
  @Test
  public void a_fresh_stamp_is_left_alone() {
    signInWithGoogle("user@ucsb.edu");
    Instant tenSecondsAgo = Instant.now().minus(Duration.ofSeconds(10));
    User user = user(tenSecondsAgo);
    when(userRepository.findByEmail("user@ucsb.edu")).thenReturn(Optional.of(user));

    assertTrue(request());

    assertEquals(tenSecondsAgo, user.getLastOnline());
    verify(userRepository, never()).save(any());
  }

  @Test
  public void a_signed_in_user_with_no_row_is_left_alone() {
    signInWithGoogle("new@ucsb.edu");
    when(userRepository.findByEmail("new@ucsb.edu")).thenReturn(Optional.empty());

    assertTrue(request());

    verify(userRepository, times(1)).findByEmail("new@ucsb.edu");
    verify(userRepository, never()).save(any());
  }

  @Test
  public void a_non_oauth_login_is_not_looked_up() {
    SecurityContextHolder.getContext()
        .setAuthentication(new UsernamePasswordAuthenticationToken("user", "pw", USER_ROLE));

    assertTrue(request());

    verify(userRepository, never()).findByEmail(any());
  }

  @Test
  public void an_oauth2_login_that_is_not_oidc_is_not_looked_up() {
    Authentication oauth2 =
        new OAuth2AuthenticationToken(
            new DefaultOAuth2User(USER_ROLE, Map.of("sub", "123"), "sub"), USER_ROLE, "github");
    SecurityContextHolder.getContext().setAuthentication(oauth2);

    assertTrue(request());

    verify(userRepository, never()).findByEmail(any());
  }

  @Test
  public void a_logged_out_request_is_not_looked_up() {
    SecurityContextHolder.clearContext();

    assertTrue(request());

    verify(userRepository, never()).findByEmail(any());
  }

  /** The boundary: exactly a minute old is not yet stale; a moment older is. */
  @Test
  public void isStale_is_strictly_more_than_the_refresh_interval() {
    Instant now = Instant.parse("2026-04-01T10:00:00Z");
    assertTrue(LastOnlineInterceptor.isStale(null, now));
    assertFalse(LastOnlineInterceptor.isStale(now, now));
    assertFalse(LastOnlineInterceptor.isStale(now.minus(Duration.ofMinutes(1)), now));
    assertTrue(LastOnlineInterceptor.isStale(now.minus(Duration.ofMinutes(1).plusMillis(1)), now));
    assertEquals(Duration.ofMinutes(1), LastOnlineInterceptor.REFRESH_AFTER);
  }
}
