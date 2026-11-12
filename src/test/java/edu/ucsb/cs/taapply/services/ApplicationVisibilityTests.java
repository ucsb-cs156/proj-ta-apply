package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

public class ApplicationVisibilityTests {

  private static Application app(long id, ApplicationOrigin origin) {
    return Application.builder().id(id).email("person" + id + "@ucsb.edu").origin(origin).build();
  }

  @Test
  public void applicants_always_count() {
    assertTrue(ApplicationVisibility.isReal(app(1, ApplicationOrigin.APPLICANT), false));
    assertTrue(ApplicationVisibility.isReal(app(1, ApplicationOrigin.APPLICANT), true));
  }

  @Test
  public void test_and_fake_applications_count_only_in_developer_mode() {
    assertFalse(ApplicationVisibility.isReal(app(1, ApplicationOrigin.ADMIN_TEST), false));
    assertTrue(ApplicationVisibility.isReal(app(1, ApplicationOrigin.ADMIN_TEST), true));
    assertFalse(ApplicationVisibility.isReal(app(1, ApplicationOrigin.DEVELOPER_MODE), false));
    assertTrue(ApplicationVisibility.isReal(app(1, ApplicationOrigin.DEVELOPER_MODE), true));
  }

  @Test
  public void real_and_cancelled_partition_the_visible_applications() {
    Application cancelledApplicant = app(2, ApplicationOrigin.APPLICANT);
    cancelledApplicant.setStatus(ApplicationReviewStatus.CANCELLED);
    Application cancelledFake = app(4, ApplicationOrigin.DEVELOPER_MODE);
    cancelledFake.setStatus(ApplicationReviewStatus.CANCELLED);
    List<Application> all =
        List.of(
            app(1, ApplicationOrigin.APPLICANT),
            cancelledApplicant,
            app(3, ApplicationOrigin.ADMIN_TEST),
            cancelledFake);

    assertEquals(List.of(1L), ids(ApplicationVisibility.real(all, false)));
    assertEquals(List.of(2L), ids(ApplicationVisibility.cancelled(all, false)));
    assertEquals(List.of(1L, 3L), ids(ApplicationVisibility.real(all, true)));
    assertEquals(List.of(2L, 4L), ids(ApplicationVisibility.cancelled(all, true)));
  }

  /** Issue #318: an applicant who cancelled and applied again is applying, not withdrawn. */
  @Test
  public void a_cancelled_application_replaced_by_a_new_one_is_not_listed_as_cancelled() {
    Application first = app(1, ApplicationOrigin.APPLICANT);
    first.setStatus(ApplicationReviewStatus.CANCELLED);
    Application second =
        app(2, ApplicationOrigin.APPLICANT).toBuilder().email(first.getEmail()).build();
    Application stillCancelled = app(3, ApplicationOrigin.APPLICANT);
    stillCancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    // Someone else's live application does not hide this cancellation.
    List<Application> all = List.of(first, second, stillCancelled);

    assertEquals(List.of(2L), ids(ApplicationVisibility.real(all, false)));
    assertEquals(List.of(3L), ids(ApplicationVisibility.cancelled(all, false)));
  }

  /** A replacement that does not count (a test application) does not hide the cancellation. */
  @Test
  public void a_replacement_that_does_not_count_does_not_hide_the_cancellation() {
    Application first = app(1, ApplicationOrigin.APPLICANT);
    first.setStatus(ApplicationReviewStatus.CANCELLED);
    Application test =
        app(2, ApplicationOrigin.ADMIN_TEST).toBuilder().email(first.getEmail()).build();
    List<Application> all = List.of(first, test);

    assertEquals(List.of(1L), ids(ApplicationVisibility.cancelled(all, false)));
    assertEquals(List.of(), ids(ApplicationVisibility.cancelled(all, true)));
  }

  /** Issue #440: a hidden application is neither ranked or assigned nor listed as cancelled. */
  @Test
  public void hidden_applications_are_neither_real_nor_cancelled() {
    Application hidden = app(2, ApplicationOrigin.APPLICANT);
    hidden.setHidden(true);
    Application hiddenCancelled = app(3, ApplicationOrigin.APPLICANT);
    hiddenCancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    hiddenCancelled.setHidden(true);
    Application cancelled = app(4, ApplicationOrigin.APPLICANT);
    cancelled.setStatus(ApplicationReviewStatus.CANCELLED);
    List<Application> all =
        List.of(app(1, ApplicationOrigin.APPLICANT), hidden, hiddenCancelled, cancelled);

    assertEquals(List.of(1L), ids(ApplicationVisibility.real(all, false)));
    assertEquals(List.of(4L), ids(ApplicationVisibility.cancelled(all, false)));
  }

  /**
   * Hiding the application that replaced a cancelled one does not list the applicant as withdrawn.
   */
  @Test
  public void hiding_a_replacement_does_not_list_the_application_cancelled_before_it() {
    Application first = app(1, ApplicationOrigin.APPLICANT);
    first.setStatus(ApplicationReviewStatus.CANCELLED);
    Application second =
        app(2, ApplicationOrigin.APPLICANT).toBuilder()
            .email(first.getEmail())
            .hidden(true)
            .build();
    List<Application> all = List.of(first, second);

    assertEquals(List.of(), ids(ApplicationVisibility.real(all, false)));
    assertEquals(List.of(), ids(ApplicationVisibility.cancelled(all, false)));
  }

  @Test
  public void isShown_is_isReal_for_an_application_that_is_not_hidden() {
    Application shown = app(1, ApplicationOrigin.APPLICANT);
    Application hidden = app(2, ApplicationOrigin.APPLICANT);
    hidden.setHidden(true);
    Application test = app(3, ApplicationOrigin.ADMIN_TEST);

    assertTrue(ApplicationVisibility.isShown(shown, false));
    assertFalse(ApplicationVisibility.isShown(hidden, false));
    assertFalse(ApplicationVisibility.isShown(hidden, true));
    assertFalse(ApplicationVisibility.isShown(test, false));
    assertTrue(ApplicationVisibility.isShown(test, true));
  }

  private static List<Long> ids(List<Application> applications) {
    return applications.stream().map(Application::getId).toList();
  }
}
