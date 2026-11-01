package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import java.util.List;

/**
 * The one rule for which applications count (issue #219). An application from a real applicant
 * always counts. Test applications entered by an admin and fake ones made by Developer Mode count
 * only while Developer Mode is on, so that every feature of the app can be tried on test data; with
 * it off, which is the only state production can be in, they are left out of every count, ranking,
 * assignment and export, as test applications always were.
 */
public final class ApplicationVisibility {

  private ApplicationVisibility() {}

  /** Whether the application counts as a real one, ignoring whether it was cancelled. */
  public static boolean isReal(Application application, boolean developerModeOn) {
    return application.getOrigin() == ApplicationOrigin.APPLICANT || developerModeOn;
  }

  /** The applications that count and that the applicant has not cancelled. */
  public static List<Application> real(List<Application> applications, boolean developerModeOn) {
    return applications.stream()
        .filter(a -> isReal(a, developerModeOn))
        .filter(a -> a.getStatus() != ApplicationReviewStatus.CANCELLED)
        .toList();
  }

  /** The applications that count and that the applicant cancelled. */
  public static List<Application> cancelled(
      List<Application> applications, boolean developerModeOn) {
    return applications.stream()
        .filter(a -> isReal(a, developerModeOn))
        .filter(a -> a.getStatus() == ApplicationReviewStatus.CANCELLED)
        .toList();
  }
}
