package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {AllocationService.class})
@ActiveProfiles("test")
public class AllocationServiceTests {

  @Autowired AllocationService service;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;

  private static Recruitment recruitment(int target) {
    return Recruitment.builder()
        .id(7L)
        .quarter("20261")
        .type(RecruitmentType.TA)
        .totalHiringTarget(target)
        .build();
  }

  private static RecruitmentCourse row(
      long id, String courseId, String section, Integer estimate, int allocation) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId(courseId)
        .section(section)
        .enrollCode("EC" + id)
        .enrollmentEstimate(estimate)
        .allocation(allocation)
        .build();
  }

  private static List<Integer> allocations(List<RecruitmentCourse> rows) {
    return rows.stream().map(RecruitmentCourse::getAllocation).toList();
  }

  private static List<Double> shares(List<RecruitmentCourse> rows) {
    return rows.stream().map(RecruitmentCourse::getUnroundedAllocation).toList();
  }

  // ---- recompute ----

  @Test
  public void recompute_shares_the_target_by_estimate_in_page_order() {
    RecruitmentCourse b = row(2L, "CMPSC   156", "0200", 100, 0);
    RecruitmentCourse a = row(1L, "CMPSC   156", "0100", 300, 0);
    RecruitmentCourse c = row(3L, "CMPSC     8", "0100", 400, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(b, a, c));

    List<RecruitmentCourse> result = service.recompute(recruitment(8));

    // Course id first, then section.
    assertEquals(List.of(c, a, b), result);
    assertEquals(List.of(4.0, 3.0, 1.0), shares(result));
    verify(recruitmentCourseRepository, times(1)).save(a);
    verify(recruitmentCourseRepository, times(1)).save(b);
    verify(recruitmentCourseRepository, times(1)).save(c);
  }

  @Test
  public void recompute_keeps_fractions() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 100, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 200, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b));

    service.recompute(recruitment(1));

    assertEquals(1.0 / 3.0, a.getUnroundedAllocation(), 1e-9);
    assertEquals(2.0 / 3.0, b.getUnroundedAllocation(), 1e-9);
  }

  /** A section with no estimate is 0 students; a removed one is not there at all. */
  @Test
  public void recompute_treats_a_missing_estimate_as_zero_and_leaves_removed_rows_out() {
    RecruitmentCourse none = row(1L, "CMPSC     8", "0100", null, 0);
    RecruitmentCourse some = row(2L, "CMPSC    16", "0100", 50, 0);
    RecruitmentCourse removed = row(3L, "CMPSC    24", "0100", 950, 0);
    removed.setRemoved(true);
    removed.setUnroundedAllocation(9.5);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(none, some, removed));

    List<RecruitmentCourse> result = service.recompute(recruitment(5));

    assertEquals(List.of(none, some), result);
    assertEquals(0.0, none.getUnroundedAllocation());
    assertEquals(5.0, some.getUnroundedAllocation());
    assertEquals(9.5, removed.getUnroundedAllocation());
    verify(recruitmentCourseRepository, never()).save(removed);
  }

  @Test
  public void recompute_gives_everyone_zero_when_the_estimates_add_up_to_nothing() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", null, 2);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 0, 1);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b));

    service.recompute(recruitment(5));

    assertEquals(0.0, a.getUnroundedAllocation());
    assertEquals(0.0, b.getUnroundedAllocation());
    // Allocations are the admin's; recompute never touches them.
    assertEquals(2, a.getAllocation());
    assertEquals(1, b.getAllocation());
  }

  @Test
  public void recompute_with_no_rows_does_nothing() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    assertTrue(service.recompute(recruitment(5)).isEmpty());
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @Test
  public void a_null_section_sorts_before_a_numbered_one() {
    RecruitmentCourse numbered = row(1L, "CMPSC     8", "0100", 10, 0);
    RecruitmentCourse unnumbered = row(2L, "CMPSC     8", null, 10, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(numbered, unnumbered));

    assertEquals(List.of(unnumbered, numbered), service.recompute(recruitment(2)));
  }

  // ---- autoAllocate ----

  @Test
  public void auto_allocate_rounds_when_the_rounded_shares_already_add_up() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 300, 9);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 9);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 400, 9);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c));

    List<RecruitmentCourse> result = service.autoAllocate(recruitment(8));

    assertEquals(List.of(a, b, c), result);
    assertEquals(List.of(3.0, 1.0, 4.0), shares(result));
    assertEquals(List.of(3, 1, 4), allocations(result));
    // Saved once by recompute and once with the allocation.
    verify(recruitmentCourseRepository, times(2)).save(a);
    verify(recruitmentCourseRepository, times(2)).save(b);
    verify(recruitmentCourseRepository, times(2)).save(c);
  }

  /** Shares 2.5, 2.5, 2.5, 2.5 of 10: half rounds up to 3 each (12), so two must give one back. */
  @Test
  public void auto_allocate_rounds_half_up_then_takes_from_the_sections_furthest_over() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 100, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    RecruitmentCourse d = row(4L, "CMPSC    32", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c, d));

    List<RecruitmentCourse> result = service.autoAllocate(recruitment(10));

    // All tied at +0.5 over; ties go to the first in page order, each time.
    assertEquals(List.of(2, 2, 3, 3), allocations(result));
  }

  /** Shares 1.4, 1.4, 1.4, 1.4, 1.4 of 7 round down to 5, so two must be topped up. */
  @Test
  public void auto_allocate_rounds_down_then_gives_to_the_sections_furthest_under() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 100, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    RecruitmentCourse d = row(4L, "CMPSC    32", "0100", 100, 0);
    RecruitmentCourse e = row(5L, "CMPSC    40", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c, d, e));

    List<RecruitmentCourse> result = service.autoAllocate(recruitment(7));

    // All tied at -0.4 under; the first two in page order gain one.
    assertEquals(List.of(2, 2, 1, 1, 1), allocations(result));
  }

  /** The section most over its share gives first, even when it is not the first section. */
  @Test
  public void auto_allocate_takes_from_the_most_over_first() {
    // Shares of 9 by 50, 100, 100, 100 over 350: 1.29, 2.57, 2.57, 2.57 -> rounded 1, 3, 3, 3
    // = 10. The first section is under its share (-0.29); the second (+0.43, first of the tie)
    // gives one back.
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 50, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    RecruitmentCourse d = row(4L, "CMPSC    32", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c, d));

    assertEquals(List.of(1, 2, 3, 3), allocations(service.autoAllocate(recruitment(9))));
  }

  /** The section most under its share gains first, even when it is not the first section. */
  @Test
  public void auto_allocate_gives_to_the_most_under_first() {
    // Shares of 10 by 140, 100, 100, 100 over 440: 3.18, 2.27, 2.27, 2.27 -> rounded 3, 2, 2, 2
    // = 9. The first section is the least under (-0.18); the second (-0.27, first of the tie)
    // gains one.
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 140, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    RecruitmentCourse d = row(4L, "CMPSC    32", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c, d));

    assertEquals(List.of(3, 3, 2, 2), allocations(service.autoAllocate(recruitment(10))));
  }

  /** Two sections give in turn: after the first gives, it is no longer the most over. */
  @Test
  public void auto_allocate_takes_from_a_different_section_each_time_as_the_excesses_change() {
    // Shares of 11 by 100, 100, 240 over 440: 2.5, 2.5, 6.0 -> 3, 3, 6 = 12; the first (tied
    // most over) gives one: 2, 3, 6.
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 100, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 240, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c));
    assertEquals(List.of(2, 3, 6), allocations(service.autoAllocate(recruitment(11))));

    // Shares of 13: 2.95, 2.95, 7.09 -> 3, 3, 7 = 13 exactly; nothing to adjust.
    assertEquals(List.of(3, 3, 7), allocations(service.autoAllocate(recruitment(13))));
  }

  /**
   * Every share is 0.0 when no section has an estimate, so the target is handed out one at a time
   * to the least over section: the first, then the second (the first is now +1), and so on.
   */
  @Test
  public void auto_allocate_with_no_estimates_deals_the_target_out_in_order() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 0, 5);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", null, 5);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 0, 5);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c));

    assertEquals(List.of(2, 2, 1), allocations(service.autoAllocate(recruitment(5))));
  }

  /** A section with no estimate rounds to 0 and stays there: it is never the most over. */
  @Test
  public void auto_allocate_never_takes_a_section_below_zero() {
    // Shares of 3 by 0, 100, 100 over 200: 0.0, 1.5, 1.5 -> 0, 2, 2 = 4 > 3. The second (+0.5,
    // first of the tie) gives; the first, at 0.0, is untouched.
    RecruitmentCourse zero = row(1L, "CMPSC     8", "0100", 0, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(zero, b, c));

    assertEquals(List.of(0, 1, 2), allocations(service.autoAllocate(recruitment(3))));
  }

  @Test
  public void auto_allocate_overwrites_whatever_was_there_and_skips_removed_rows() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 100, 7);
    RecruitmentCourse removed = row(2L, "CMPSC    16", "0100", 100, 7);
    removed.setRemoved(true);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, removed));

    List<RecruitmentCourse> result = service.autoAllocate(recruitment(4));

    assertEquals(List.of(a), result);
    assertEquals(4, a.getAllocation());
    assertEquals(4.0, a.getUnroundedAllocation());
    assertEquals(7, removed.getAllocation());
    assertNull(removed.getUnroundedAllocation());
    verify(recruitmentCourseRepository, never()).save(removed);
  }

  @Test
  public void auto_allocate_with_no_rows_does_nothing() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    assertTrue(service.autoAllocate(recruitment(5)).isEmpty());
    verify(recruitmentCourseRepository, never()).save(any());
  }
}
