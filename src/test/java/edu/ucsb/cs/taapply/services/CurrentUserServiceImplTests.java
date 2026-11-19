package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Outside a request, such as on the thread of the nightly scheduled refresh (issue #464), there is
 * no authentication at all. That means no user, not an error: the job service asks for the user
 * when it records a job, and an exception there kept the nightly refresh off the Jobs page.
 */
class CurrentUserServiceImplTests {

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void with_no_authentication_there_is_no_user() {
    SecurityContextHolder.clearContext();

    assertNull(new CurrentUserServiceImpl().getUser());
  }
}
