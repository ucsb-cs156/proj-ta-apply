package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The one rule for which applications count (issue #219). An application from a real applicant
 * always counts. Test applications entered by an admin and fake ones made by Developer Mode count
 * only while Developer Mode is on, so that every feature of the app can be tried on test data; with
 * it off, which is the only state production can be in, they are left out of every count, ranking,
 * assignment and export, as test applications always were.
 *
 * <p>An application an admin has hidden (issue #440) still counts as one on file, but takes no part
 * in ranking or assignment: it is in neither {@link #real} nor {@link #cancelled}.
 */
public final class ApplicationVisibility {

  private ApplicationVisibility() {}

  /** Whether the application counts as a real one, ignoring whether it was cancelled. */
  public static boolean isReal(Application application, boolean developerModeOn) {
    return application.getOrigin() == ApplicationOrigin.APPLICANT || developerModeOn;
  }

  /** Whether the application counts and no admin has hidden it, cancelled or not. */
  public static boolean isShown(Application application, boolean developerModeOn) {
    return isReal(application, developerModeOn) && !application.isHidden();
  }

  /** The applications that count and that the applicant has not cancelled, hidden ones included. */
  private static List<Application> live(List<Application> applications, boolean developerModeOn) {
    return applications.stream()
        .filter(a -> isReal(a, developerModeOn))
        .filter(a -> a.getStatus() != ApplicationReviewStatus.CANCELLED)
        .toList();
  }

  /**
   * The applications that count, that the applicant has not cancelled and that no admin has hidden:
   * the ones faculty rank and admins assign.
   */
  public static List<Application> real(List<Application> applications, boolean developerModeOn) {
    return live(applications, developerModeOn).stream().filter(a -> !a.isHidden()).toList();
  }

  /**
   * The applications that count and that the applicant cancelled and has not since replaced: an
   * applicant who cancelled and then started a new application (issue #318) is on the lists of
   * people who are applying, not on the list of people who withdrew, and the cancelled application
   * stays on file for the admin's table and CSV. Hidden applications are not listed, and one whose
   * new application is hidden is still someone who is applying, so the application they cancelled
   * before it is not listed either: hiding an applicant never moves them to this list.
   */
  public static List<Application> cancelled(
      List<Application> applications, boolean developerModeOn) {
    Set<String> applying =
        live(applications, developerModeOn).stream()
            .map(Application::getEmail)
            .collect(Collectors.toSet());
    // An application that counts, whose applicant has no live one: it can only be a cancelled one.
    return applications.stream()
        .filter(a -> isShown(a, developerModeOn))
        .filter(a -> !applying.contains(a.getEmail()))
        .toList();
  }
}
