package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** Issue #485: the rules about releasing soft offers. */
class SoftOffersTests {

  private static Recruitment ula(boolean published) {
    return Recruitment.builder()
        .id(1L)
        .type(RecruitmentType.ULA)
        .assignmentsPublished(published)
        .build();
  }

  @Test
  void a_ta_recruitment_cannot_release_soft_offers_even_with_hiring_decisions_released() {
    Recruitment ta =
        Recruitment.builder().type(RecruitmentType.TA).assignmentsPublished(true).build();
    assertEquals("Soft offers are a ULA feature.", SoftOffers.unmetPrerequisite(ta));
  }

  @Test
  void a_ula_recruitment_needs_hiring_decisions_released_first() {
    assertEquals(
        "Release hiring decisions before releasing soft offers.",
        SoftOffers.unmetPrerequisite(ula(false)));
    assertNull(SoftOffers.unmetPrerequisite(ula(true)));
  }

  @Test
  void released_means_the_release_moment_is_stamped() {
    Recruitment r = ula(true);
    assertFalse(SoftOffers.isReleased(r));
    r.setSoftOffersReleasedAt(LocalDateTime.of(2026, 11, 20, 9, 0));
    assertTrue(SoftOffers.isReleased(r));
  }

  @Test
  void the_deadline_must_be_strictly_after_now() {
    LocalDateTime now = LocalDateTime.of(2026, 11, 24, 12, 0);
    assertNull(SoftOffers.deadlineProblem(now.plusMinutes(1), now));
    assertEquals(
        "The soft offer deadline must be in the future.", SoftOffers.deadlineProblem(now, now));
    assertEquals(
        "The soft offer deadline must be in the future.",
        SoftOffers.deadlineProblem(now.minusDays(1), now));
  }
}
