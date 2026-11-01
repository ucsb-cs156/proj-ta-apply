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
    return Application.builder().id(id).origin(origin).build();
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

  private static List<Long> ids(List<Application> applications) {
    return applications.stream().map(Application::getId).toList();
  }
}
