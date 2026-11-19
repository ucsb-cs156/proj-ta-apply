package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs156.jobs.services.JobUserProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Bridge between the lib-jobs library and this app's notion of "current user"; lib-jobs uses it to
 * stamp createdById/createdByEmail on Job records. Both values are null when there is no logged-in
 * user (e.g. jobs launched from a scheduled task).
 *
 * <p>Looking the user up never fails a launch (issue #464): lib-jobs asks before it records the
 * job, so an exception here would leave no trace of the job on the Jobs page. Any failure is logged
 * and the job is recorded with no user.
 */
@Service
@Slf4j
public class JobUserProviderImpl implements JobUserProvider {

  @Autowired private CurrentUserService currentUserService;

  @Override
  public Long getCurrentUserId() {
    User user = currentUser();
    return user != null ? user.getId() : null;
  }

  @Override
  public String getCurrentUserEmail() {
    User user = currentUser();
    return user != null ? user.getEmail() : null;
  }

  private User currentUser() {
    try {
      return currentUserService.getUser();
    } catch (RuntimeException e) {
      log.warn("Could not look up the user launching a job; recording it with none", e);
      return null;
    }
  }
}
