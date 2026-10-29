package edu.ucsb.cs.taapply.services;

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

  // ---- the three phases ----

  @Test
  public void an_application_is_editable_before_the_deadline() {
    Recruitment r = recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20));
    assertTrue(service.editable(r, LocalDate.of(2026, 1, 19)));
  }

  /** The deadline day itself still counts as open; it closes the day after. */
  @Test
  public void an_application_is_editable_on_the_deadline_itself() {
    Recruitment r = recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20));
    assertTrue(service.editable(r, LocalDate.of(2026, 1, 20)));
  }

  @Test
  public void an_application_is_not_editable_after_the_deadline() {
    Recruitment r = recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20));
    assertFalse(service.editable(r, LocalDate.of(2026, 1, 21)));
  }

  @Test
  public void a_closed_recruitment_is_never_editable_even_before_the_deadline() {
    Recruitment r = recruitment(ApplicationStatus.CLOSED, LocalDate.of(2026, 1, 20));
    assertFalse(service.editable(r, LocalDate.of(2026, 1, 1)));
  }

  @Test
  public void a_recruitment_without_a_deadline_stays_editable_while_open() {
    Recruitment r = recruitment(ApplicationStatus.OPEN, null);
    assertTrue(service.editable(r, LocalDate.of(2030, 1, 1)));
  }

  /** Comments outlive the deadline, which is the point of keeping them separate. */
  @Test
  public void comments_survive_the_deadline_but_not_the_closing() {
    Recruitment open = recruitment(ApplicationStatus.OPEN, LocalDate.of(2026, 1, 20));
    Recruitment closed = recruitment(ApplicationStatus.CLOSED, LocalDate.of(2026, 1, 20));

    assertFalse(service.editable(open, LocalDate.of(2026, 2, 1)));
    assertTrue(service.commentable(open));
    assertFalse(service.commentable(closed));
  }
}
