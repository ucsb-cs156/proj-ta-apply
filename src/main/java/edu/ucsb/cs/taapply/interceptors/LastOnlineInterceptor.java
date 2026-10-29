package edu.ucsb.cs.taapply.interceptors;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Keeps {@link User#getLastOnline() lastOnline} current: on each API request from a signed-in user,
 * their row is stamped with the time, if the stamp it carries is more than a minute old. The minute
 * keeps a page load, which makes several requests at once, from writing the row several times.
 *
 * <p>Registered in {@code WebConfig} for {@code /api/**}. A request that is not an OIDC login (a
 * logged-out visitor, or a test's mock user) is left alone, as is a user with no row yet.
 */
@Component
public class LastOnlineInterceptor implements HandlerInterceptor {

  /** How stale a stamp must be before a request refreshes it. */
  public static final Duration REFRESH_AFTER = Duration.ofMinutes(1);

  @Autowired private UserRepository userRepository;

  @Override
  public boolean preHandle(
      HttpServletRequest request, HttpServletResponse response, Object handler) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof OAuth2AuthenticationToken oauthToken
        && oauthToken.getPrincipal() instanceof OidcUser oidcUser) {
      Instant now = Instant.now();
      Optional<User> user = userRepository.findByEmail(oidcUser.getEmail());
      if (user.isPresent() && isStale(user.get().getLastOnline(), now)) {
        user.get().setLastOnline(now);
        userRepository.save(user.get());
      }
    }
    return true;
  }

  /** A missing stamp, or one from more than {@link #REFRESH_AFTER} ago. */
  static boolean isStale(Instant lastOnline, Instant now) {
    return lastOnline == null || lastOnline.isBefore(now.minus(REFRESH_AFTER));
  }
}
