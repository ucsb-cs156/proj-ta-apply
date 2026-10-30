package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

public class ApplicationAccessServiceTests {

  private final ApplicationAccessService service = new ApplicationAccessService();

  private static Recruitment recruitment(ApplicationStatus status, LocalDate deadline) {
    return Recruitment.builder()
        .quarter("20261")
        .type(RecruitmentType.TA)
        .applicationStatus(status)
        .primaryConsiderationDate(deadline)
        .build();
  }

  private static Recruitment closedOn(LocalDate closingDate) {
    Recruitment r = recruitment(ApplicationStatus.CLOSED, LocalDate.of(2026, 1, 20));
    r.setActualClosingDate(closingDate);
    return r;
  }

  // ---- when applications may be created ----

  @Test
  public void only_an_open_recruitment_accepts_applications() {
    assertTrue(
        service.acceptingApplications(
            recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20))));
    assertFalse(
        service.acceptingApplications(
            recruitment(ApplicationStatus.CLOSED, LocalDate.of(2026, 1, 20))));
  }

  // ---- when an application may be changed ----

  /** Issue #98: editing lasts for as long as applications are open, deadline or not. */
  @Test
  public void an_open_recruitment_is_editable_whatever_the_deadline() {
    assertTrue(service.editable(recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20))));
    assertTrue(service.editable(recruitment(ApplicationStatus.OPEN, LocalDate.of(2000, 1, 1))));
    assertTrue(service.editable(recruitment(ApplicationStatus.OPEN, null)));
  }

  @Test
  public void a_closed_recruitment_is_never_editable() {
    assertFalse(service.editable(recruitment(ApplicationStatus.CLOSED, LocalDate.of(2099, 1, 20))));
    assertFalse(service.editable(recruitment(ApplicationStatus.CLOSED, null)));
  }

  // ---- recently closed, and comments (issue #107) ----

  @Test
  public void recently_closed_means_within_six_months_of_the_closing_date() {
    assertEquals(6, ApplicationAccessService.RECENT_MONTHS);
    LocalDate closed = LocalDate.of(2026, 2, 1);
    assertTrue(service.recentlyClosed(closedOn(closed), LocalDate.of(2026, 2, 1)));
    assertTrue(service.recentlyClosed(closedOn(closed), LocalDate.of(2026, 7, 31)));
    // Six months on, to the day, still counts; the day after does not.
    assertTrue(service.recentlyClosed(closedOn(closed), LocalDate.of(2026, 8, 1)));
    assertFalse(service.recentlyClosed(closedOn(closed), LocalDate.of(2026, 8, 2)));
  }

  @Test
  public void an_open_recruitment_or_one_with_no_closing_date_is_not_recently_closed() {
    Recruitment open = recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20));
    open.setActualClosingDate(LocalDate.of(2026, 2, 1));
    assertFalse(service.recentlyClosed(open, LocalDate.of(2026, 2, 2)));
    assertFalse(service.recentlyClosed(closedOn(null), LocalDate.of(2026, 2, 2)));
  }

  @Test
  public void comments_are_allowed_while_open_and_for_six_months_after_closing() {
    Recruitment open = recruitment(ApplicationStatus.OPEN, LocalDate.of(2000, 1, 20));
    assertTrue(service.commentable(open, LocalDate.of(2026, 2, 1)));

    LocalDate closed = LocalDate.of(2026, 2, 1);
    assertTrue(service.commentable(closedOn(closed), LocalDate.of(2026, 8, 1)));
    assertFalse(service.commentable(closedOn(closed), LocalDate.of(2026, 8, 2)));
    assertFalse(service.commentable(closedOn(null), LocalDate.of(2026, 2, 2)));
  }
}
