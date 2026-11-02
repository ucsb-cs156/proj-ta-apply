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
import java.util.ArrayList;
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

  // ---- autoAllocate: at least as many hires as sections (issue #257) ----

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

  /** Shares 2.5 each of 10: every section is 0.5 away either way; the extras go in page order. */
  @Test
  public void auto_allocate_splits_tied_halves_in_page_order() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(equalRows(4, 100));

    assertEquals(List.of(3, 3, 2, 2), allocations(service.autoAllocate(recruitment(10))));
  }

  /** Shares 1.4 each of 7: two sections must be topped up, the first two in page order. */
  @Test
  public void auto_allocate_tops_up_the_first_sections_when_all_are_tied() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(equalRows(5, 100));

    assertEquals(List.of(2, 2, 1, 1, 1), allocations(service.autoAllocate(recruitment(7))));
  }

  /** The first section is the best fit as it is, so the extras go to the later ones. */
  @Test
  public void auto_allocate_gives_extras_to_the_sections_furthest_under_their_share() {
    // Shares of 9 by 50, 100, 100, 100 over 350: 1.29, 2.57, 2.57, 2.57. The first stays at 1
    // (0.29 under); two of the others go up to 3 (0.43 over) and one stays at 2 (0.57 under).
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 50, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    RecruitmentCourse d = row(4L, "CMPSC    32", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c, d));

    assertEquals(List.of(1, 3, 3, 2), allocations(service.autoAllocate(recruitment(9))));
  }

  @Test
  public void auto_allocate_keeps_the_largest_gap_as_small_as_possible() {
    // Shares of 10 by 140, 100, 100, 100 over 440: 3.18, 2.27, 2.27, 2.27. Giving the first 4
    // would leave it 0.82 off; the best is 3, 3, 2, 2 with 0.73 the largest gap.
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 140, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    RecruitmentCourse d = row(4L, "CMPSC    32", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c, d));

    assertEquals(List.of(3, 3, 2, 2), allocations(service.autoAllocate(recruitment(10))));
  }

  @Test
  public void auto_allocate_rounds_shares_that_do_not_tie() {
    // Shares of 11 by 100, 100, 240 over 440: 2.5, 2.5, 6.0.
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 100, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 240, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c));
    assertEquals(List.of(3, 2, 6), allocations(service.autoAllocate(recruitment(11))));

    // Shares of 13: 2.95, 2.95, 7.09 -> 3, 3, 7 exactly.
    assertEquals(List.of(3, 3, 7), allocations(service.autoAllocate(recruitment(13))));
  }

  /** Every share is 0.0 when no section has an estimate, so the target is dealt out evenly. */
  @Test
  public void auto_allocate_with_no_estimates_deals_the_target_out_in_order() {
    RecruitmentCourse a = row(1L, "CMPSC     8", "0100", 0, 5);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", null, 5);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 0, 5);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(a, b, c));

    assertEquals(List.of(2, 2, 1), allocations(service.autoAllocate(recruitment(5))));
  }

  /** A section with no estimate would round to 0, but still gets the minimum of one. */
  @Test
  public void auto_allocate_gives_every_section_at_least_one() {
    // Shares of 3 by 0, 100, 100 over 200: 0.0, 1.5, 1.5. The only split with a one each is 1,
    // 1, 1.
    RecruitmentCourse zero = row(1L, "CMPSC     8", "0100", 0, 0);
    RecruitmentCourse b = row(2L, "CMPSC    16", "0100", 100, 0);
    RecruitmentCourse c = row(3L, "CMPSC    24", "0100", 100, 0);
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of(zero, b, c));
    assertEquals(List.of(1, 1, 1), allocations(service.autoAllocate(recruitment(3))));

    // With a fourth hire, shares are 0.0, 2.0, 2.0 and the extra goes to the first of the tied.
    assertEquals(List.of(1, 2, 1), allocations(service.autoAllocate(recruitment(4))));
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

  // ---- autoAllocate: more sections than hires ----

  /** Five sections at share 0.6 round to 1 each (5); the first two in page order give. */
  @Test
  public void auto_allocate_takes_from_the_first_sections_when_over_target() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(equalRows(5, 100));

    assertEquals(List.of(0, 0, 1, 1, 1), allocations(service.autoAllocate(recruitment(3))));
  }

  /** The first section gives, is then no longer the most over, and the next one gives. */
  @Test
  public void auto_allocate_takes_from_a_different_section_each_time_as_the_excesses_change() {
    // Six shares of 0.5 round half up to 1 each (6) against a target of 3.
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(equalRows(6, 100));

    assertEquals(List.of(0, 0, 0, 1, 1, 1), allocations(service.autoAllocate(recruitment(3))));
  }

  /** The section most over its share gives first, even when it is not the first section. */
  @Test
  public void auto_allocate_takes_from_the_most_over_first() {
    // Shares of 3 by 40, 100 x5 over 540: 0.22, 0.56 x5 -> 0, 1 x5 = 5. The first is under its
    // share (-0.22) and keeps its zero; the others are 0.44 over, and the first of them gives.
    List<RecruitmentCourse> rows = new ArrayList<>();
    rows.add(row(1L, "CMPSC     8", "0100", 40, 0));
    for (int i = 2; i <= 6; i++) {
      rows.add(row(i, "CMPSC " + (10 * i), "0100", 100, 0));
    }
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(rows);

    assertEquals(List.of(0, 0, 0, 1, 1, 1), allocations(service.autoAllocate(recruitment(3))));
  }

  /** Five shares of 0.4 round to 0, so two must be topped up, the first two in page order. */
  @Test
  public void auto_allocate_gives_to_a_different_section_each_time_as_the_excesses_change() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(equalRows(5, 100));

    assertEquals(List.of(1, 1, 0, 0, 0), allocations(service.autoAllocate(recruitment(2))));
  }

  /** The section most under its share gains first, even when it is not the first section. */
  @Test
  public void auto_allocate_gives_to_the_most_under_first() {
    // Shares of 2 by 140, 100 x4 over 540: 0.52, 0.37 x4 -> 1, 0 x4 = 1. The first is over its
    // share (+0.48); the others are 0.37 under, and the first of them gains.
    List<RecruitmentCourse> rows = new ArrayList<>();
    rows.add(row(1L, "CMPSC     8", "0100", 140, 0));
    for (int i = 2; i <= 5; i++) {
      rows.add(row(i, "CMPSC " + (10 * i), "0100", 100, 0));
    }
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(rows);

    assertEquals(List.of(1, 1, 0, 0, 0), allocations(service.autoAllocate(recruitment(2))));
  }

  /** Among sections with the same allocation, the one with the smallest share is most over. */
  @Test
  public void auto_allocate_judges_over_and_under_by_the_difference_from_the_share() {
    // Shares of 2 by 60, 50, 50, 40 over 200: 0.6, 0.5, 0.5, 0.4 -> 1, 1, 1, 0 = 3. The second
    // and third are 0.5 over, the first only 0.4: the second gives.
    List<RecruitmentCourse> over = new ArrayList<>();
    int[] estimates = {60, 50, 50, 40};
    for (int i = 0; i < estimates.length; i++) {
      over.add(row(i + 1, "CMPSC " + (10 * (i + 1)), "0100", estimates[i], 0));
    }
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(over);
    assertEquals(List.of(1, 0, 1, 0), allocations(service.autoAllocate(recruitment(2))));

    // Shares of 1 by 10, 45, 45 over 100: 0.1, 0.45, 0.45 -> 0, 0, 0 = 0. The second is the
    // first of the two furthest under their share (-0.45), so it gains, not the first (-0.1).
    List<RecruitmentCourse> under = new ArrayList<>();
    int[] smaller = {10, 45, 45};
    for (int i = 0; i < smaller.length; i++) {
      under.add(row(i + 1, "CMPSC " + (10 * (i + 1)), "0100", smaller[i], 0));
    }
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(under);
    assertEquals(List.of(0, 1, 0), allocations(service.autoAllocate(recruitment(1))));
  }

  /** With no hires at all, nothing is allocated. */
  @Test
  public void auto_allocate_with_a_zero_target_allocates_nothing() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(equalRows(2, 100));

    assertEquals(List.of(0, 0), allocations(service.autoAllocate(recruitment(0))));
  }

  private static List<RecruitmentCourse> equalRows(int count, int estimate) {
    List<RecruitmentCourse> rows = new ArrayList<>();
    for (int i = 1; i <= count; i++) {
      rows.add(row(i, "CMPSC " + (10 * i), "0100", estimate, 0));
    }
    return rows;
  }
}
