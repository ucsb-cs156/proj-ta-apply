package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import org.junit.jupiter.api.Test;

class HiringDecisionsTests {

  private static Recruitment recruitment(
      ApplicationStatus applications, String reviews, Boolean published) {
    return Recruitment.builder()
        .id(7L)
        .applicationStatus(applications)
        .reviewStatus(reviews)
        .assignmentsPublished(published)
        .build();
  }

  @Test
  void the_messages() {
    assertEquals(
        "Close Faculty Ranking before releasing hiring decisions.",
        HiringDecisions.CLOSE_RANKING_FIRST);
    assertEquals(
        "Close Applications before releasing hiring decisions.",
        HiringDecisions.CLOSE_APPLICATIONS_FIRST);
    assertEquals(
        "Assign candidates to slots before releasing hiring decisions.",
        HiringDecisions.ASSIGN_FIRST);
  }

  @Test
  void ranking_not_closed_comes_first_whether_never_opened_or_open() {
    assertEquals(
        HiringDecisions.CLOSE_RANKING_FIRST,
        HiringDecisions.unmetPrerequisite(
            recruitment(ApplicationStatus.OPEN, "NotStarted", false), false));
    assertEquals(
        HiringDecisions.CLOSE_RANKING_FIRST,
        HiringDecisions.unmetPrerequisite(
            recruitment(ApplicationStatus.CLOSED, "Open", false), true));
  }

  @Test
  void open_applications_come_second() {
    assertEquals(
        HiringDecisions.CLOSE_APPLICATIONS_FIRST,
        HiringDecisions.unmetPrerequisite(
            recruitment(ApplicationStatus.OPEN, "Closed", false), false));
    assertEquals(
        HiringDecisions.CLOSE_APPLICATIONS_FIRST,
        HiringDecisions.unmetPrerequisite(
            recruitment(ApplicationStatus.OPEN, "Closed", false), true));
  }

  @Test
  void nobody_assigned_comes_last_and_everything_met_is_null() {
    Recruitment r = recruitment(ApplicationStatus.CLOSED, "Closed", false);
    assertEquals(HiringDecisions.ASSIGN_FIRST, HiringDecisions.unmetPrerequisite(r, false));
    assertNull(HiringDecisions.unmetPrerequisite(r, true));
  }

  @Test
  void released_decisions_are_tentative_only_while_applications_or_ranking_are_open() {
    assertFalse(HiringDecisions.isTentative(recruitment(ApplicationStatus.CLOSED, "Closed", true)));
    assertTrue(HiringDecisions.isTentative(recruitment(ApplicationStatus.OPEN, "Closed", true)));
    assertTrue(HiringDecisions.isTentative(recruitment(ApplicationStatus.CLOSED, "Open", true)));
    assertTrue(HiringDecisions.isTentative(recruitment(ApplicationStatus.OPEN, "Open", true)));
  }

  @Test
  void decisions_not_released_are_never_tentative() {
    assertFalse(HiringDecisions.isTentative(recruitment(ApplicationStatus.OPEN, "Open", false)));
    assertFalse(HiringDecisions.isTentative(recruitment(ApplicationStatus.OPEN, "Open", null)));
  }
}
