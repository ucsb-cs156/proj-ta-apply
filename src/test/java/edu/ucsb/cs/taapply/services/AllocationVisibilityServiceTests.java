package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {AllocationVisibilityService.class})
@ActiveProfiles("test")
public class AllocationVisibilityServiceTests {

  @Autowired AllocationVisibilityService service;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentAuditService recruitmentAuditService;

  private static Recruitment recruitment(AllocationVisibility visibility) {
    return Recruitment.builder()
        .id(1L)
        .quarter("20261")
        .type(RecruitmentType.TA)
        .allocationVisibility(visibility)
        .build();
  }

  /** Each change is saved and then recorded in the audit trail, in that order. */
  private void assertChange(AllocationVisibility from, AllocationVisibility to) {
    Recruitment r = recruitment(from);
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("allocationVisibility", from.name()));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    assertSame(r, service.change(r, to));

    assertEquals(to, r.getAllocationVisibility());
    InOrder inOrder = inOrder(recruitmentAuditService, recruitmentRepository);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentRepository).save(r);
    inOrder.verify(recruitmentAuditService).recordChanges(before, r);
  }

  @Test
  public void releasing_to_each_faculty_member_is_saved_and_audited() {
    assertChange(AllocationVisibility.ADMINS_ONLY, AllocationVisibility.OWN_COURSES);
  }

  @Test
  public void showing_every_course_to_every_faculty_member_is_saved_and_audited() {
    assertChange(AllocationVisibility.OWN_COURSES, AllocationVisibility.ALL_COURSES);
  }

  @Test
  public void withdrawing_is_saved_and_audited() {
    assertChange(AllocationVisibility.ALL_COURSES, AllocationVisibility.ADMINS_ONLY);
  }

  @Test
  public void the_first_release_is_stamped() {
    Recruitment r = recruitment(AllocationVisibility.ADMINS_ONLY);
    assertNull(r.getAllocationsReleasedAt());
    LocalDateTime before = LocalDateTime.now();

    service.change(r, AllocationVisibility.OWN_COURSES);

    assertNotNull(r.getAllocationsReleasedAt());
    assertEquals(false, r.getAllocationsReleasedAt().isBefore(before));
  }

  @Test
  public void a_later_release_keeps_the_first_stamp() {
    Recruitment r = recruitment(AllocationVisibility.ADMINS_ONLY);
    LocalDateTime first = LocalDateTime.of(2026, 1, 2, 3, 4);
    r.setAllocationsReleasedAt(first);

    service.change(r, AllocationVisibility.ALL_COURSES);

    assertEquals(first, r.getAllocationsReleasedAt());
  }

  @Test
  public void withdrawing_does_not_stamp_a_release() {
    Recruitment r = recruitment(AllocationVisibility.OWN_COURSES);

    service.change(r, AllocationVisibility.ADMINS_ONLY);

    assertNull(r.getAllocationsReleasedAt());
  }

  @Test
  public void choosing_the_visibility_it_already_has_neither_saves_nor_audits() {
    Recruitment r = recruitment(AllocationVisibility.OWN_COURSES);

    assertSame(r, service.change(r, AllocationVisibility.OWN_COURSES));

    assertEquals(AllocationVisibility.OWN_COURSES, r.getAllocationVisibility());
    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
  }
}
