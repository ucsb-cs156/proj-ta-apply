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

  @Test
  public void comments_follow_the_same_rule_as_editing() {
    Recruitment open = recruitment(ApplicationStatus.OPEN, LocalDate.of(2000, 1, 20));
    Recruitment closed = recruitment(ApplicationStatus.CLOSED, LocalDate.of(2099, 1, 20));

    assertTrue(service.commentable(open));
    assertFalse(service.commentable(closed));
  }
}
