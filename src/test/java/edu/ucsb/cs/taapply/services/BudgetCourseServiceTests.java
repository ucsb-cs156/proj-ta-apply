package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.BudgetCourse;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.EnrollmentEstimateSource;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.BudgetCourseRepository;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** The quarter's one row per section (issue #363): its lifecycle, its cache and its estimate. */
@SpringBootTest(classes = {BudgetCourseService.class})
@ActiveProfiles("test")
public class BudgetCourseServiceTests {

  @Autowired BudgetCourseService service;
  @MockitoBean BudgetCourseRepository budgetCourseRepository;
  @MockitoBean BudgetRepository budgetRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;

  private static final String Q = "20264";

  private static RecruitmentCourse row(long id, String enrollCode, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId("CMPSC " + id)
        .section("0100")
        .enrollCode(enrollCode)
        .removed(removed)
        .build();
  }

  private static BudgetCourse figures(
      long id, String enrollCode, Integer enrollment, Integer max, Integer estimate) {
    return BudgetCourse.builder()
        .id(id)
        .quarter(Q)
        .enrollCode(enrollCode)
        .enrollment(enrollment)
        .maxEnroll(max)
        .enrollmentEstimate(estimate)
        .build();
  }

  private static UcsbSection section(String enrollCode, Integer enrolled, Integer max) {
    return UcsbSection.builder()
        .enrollCode(enrollCode)
        .section("0100")
        .enrolledTotal(enrolled)
        .maxEnroll(max)
        .build();
  }

  @BeforeEach
  public void savesReturnTheirArgument() {
    when(budgetCourseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(budgetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    when(budgetCourseRepository.findByQuarterAndEnrollCode(any(), any()))
        .thenReturn(Optional.empty());
    when(recruitmentRepository.findByQuarterAndType(any(), any())).thenReturn(Optional.empty());
  }

  // ---- byEnrollCode and attach ----

  @Test
  public void the_quarters_rows_are_keyed_by_enroll_code() {
    BudgetCourse a = figures(1L, "07492", 100, 150, 120);
    BudgetCourse b = figures(2L, "07500", 60, 80, null);
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of(a, b));

    Map<String, BudgetCourse> byCode = service.byEnrollCode(Q);

    assertEquals(2, byCode.size());
    assertSame(a, byCode.get("07492"));
    assertSame(b, byCode.get("07500"));
  }

  @Test
  public void attach_fills_every_rows_figures_with_one_read_and_blanks_a_row_without_any() {
    when(budgetCourseRepository.findByQuarter(Q))
        .thenReturn(List.of(figures(1L, "07492", 100, 150, 120)));
    RecruitmentCourse known = row(1L, "07492", false);
    RecruitmentCourse unknown = row(2L, "09999", false);
    unknown.setEnrollmentEstimate(5);

    service.attach(Q, List.of(known, unknown));

    assertEquals(100, known.getEnrollment());
    assertEquals(150, known.getMaxEnroll());
    assertEquals(120, known.getEnrollmentEstimate());
    assertNull(unknown.getEnrollment());
    assertNull(unknown.getMaxEnroll());
    assertNull(unknown.getEnrollmentEstimate());
    verify(budgetCourseRepository, times(1)).findByQuarter(Q);
  }

  @Test
  public void attach_of_one_row_reads_its_own_figures() {
    when(budgetCourseRepository.findByQuarterAndEnrollCode(Q, "07492"))
        .thenReturn(Optional.of(figures(1L, "07492", 100, 150, 120)));
    RecruitmentCourse known = row(1L, "07492", false);
    RecruitmentCourse unknown = row(2L, "09999", false);
    unknown.setMaxEnroll(9);

    service.attach(Q, known);
    service.attach(Q, unknown);

    assertEquals(120, known.getEnrollmentEstimate());
    assertEquals(100, known.getEnrollment());
    assertNull(unknown.getMaxEnroll());
  }

  // ---- ensure ----

  @Test
  public void ensure_returns_the_row_on_file_without_writing() {
    BudgetCourse onFile = figures(1L, "07492", 100, 150, 120);
    when(budgetCourseRepository.findByQuarterAndEnrollCode(Q, "07492"))
        .thenReturn(Optional.of(onFile));

    assertSame(onFile, service.ensure(Q, row(1L, "07492", false)));

    verify(budgetCourseRepository, never()).save(any());
    verify(budgetRepository, never()).save(any());
  }

  @Test
  public void ensure_creates_the_row_and_the_quarters_budget_when_both_are_missing() {
    when(budgetRepository.findById(Q)).thenReturn(Optional.empty());

    BudgetCourse created = service.ensure(Q, row(1L, "07492", false));

    assertEquals(Q, created.getQuarter());
    assertEquals("07492", created.getEnrollCode());
    assertEquals("CMPSC 1", created.getCourseId());
    assertEquals("0100", created.getSection());
    assertNull(created.getEnrollment());
    assertNull(created.getMaxEnroll());
    assertNull(created.getEnrollmentRefreshedAt());
    assertNull(created.getEnrollmentEstimate());
    assertNull(created.getEnrollmentEstimateSource());
    verify(budgetCourseRepository).save(created);
    ArgumentCaptor<Budget> budget = ArgumentCaptor.forClass(Budget.class);
    verify(budgetRepository).save(budget.capture());
    assertEquals(Q, budget.getValue().getQuarter());
  }

  @Test
  public void ensure_leaves_a_budget_on_file_alone() {
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(Budget.builder().quarter(Q).build()));

    service.ensure(Q, row(1L, "07492", false));

    verify(budgetCourseRepository).save(any());
    verify(budgetRepository, never()).save(any());
  }

  // ---- cache ----

  @Test
  public void cache_copies_the_sections_figures_onto_the_row_stamps_it_and_saves_it() {
    BudgetCourse onFile = figures(1L, "07492", 1, 2, 120);
    when(budgetCourseRepository.findByQuarterAndEnrollCode(Q, "07492"))
        .thenReturn(Optional.of(onFile));
    LocalDateTime before = AppTime.now();

    BudgetCourse cached = service.cache(Q, row(1L, "07492", false), section("07492", 100, 150));

    assertSame(onFile, cached);
    assertEquals(100, cached.getEnrollment());
    assertEquals(150, cached.getMaxEnroll());
    assertEquals(120, cached.getEnrollmentEstimate(), "the estimate is the admin's, not the API's");
    assertNotNull(cached.getEnrollmentRefreshedAt());
    assertFalse(cached.getEnrollmentRefreshedAt().isBefore(before));
    verify(budgetCourseRepository).save(onFile);
  }

  @Test
  public void cache_creates_the_row_for_a_section_the_quarter_did_not_have() {
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(Budget.builder().quarter(Q).build()));

    BudgetCourse cached = service.cache(Q, row(1L, "07492", false), section("07492", 100, 150));

    assertEquals("07492", cached.getEnrollCode());
    assertEquals(100, cached.getEnrollment());
    // Once as the empty row, once with the figures.
    verify(budgetCourseRepository, times(2)).save(cached);
  }

  // ---- refreshCache ----

  @Test
  public void refreshCache_updates_found_rows_stamps_the_rest_and_creates_the_missing_ones() {
    BudgetCourse found = figures(1L, "07492", 1, 2, 120);
    BudgetCourse gone = figures(2L, "09999", 3, 4, 50);
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of(found, gone));
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(Budget.builder().quarter(Q).build()));
    RecruitmentCourse known = row(1L, "07492", false);
    RecruitmentCourse added = row(3L, "07600", false);
    LocalDateTime before = AppTime.now();

    int cached =
        service.refreshCache(
            Q,
            List.of(known, added),
            Map.of("07492", section("07492", 100, 150), "07600", section("07600", 10, 20)));

    assertEquals(2, cached);
    assertEquals(100, found.getEnrollment());
    assertEquals(150, found.getMaxEnroll());
    assertEquals(120, found.getEnrollmentEstimate());
    assertFalse(found.getEnrollmentRefreshedAt().isBefore(before));
    // A section the API no longer lists keeps its figures but is stamped as checked.
    assertEquals(3, gone.getEnrollment());
    assertEquals(4, gone.getMaxEnroll());
    assertFalse(gone.getEnrollmentRefreshedAt().isBefore(before));
    ArgumentCaptor<BudgetCourse> saved = ArgumentCaptor.forClass(BudgetCourse.class);
    verify(budgetCourseRepository, times(3)).save(saved.capture());
    BudgetCourse created =
        saved.getAllValues().stream()
            .filter(c -> "07600".equals(c.getEnrollCode()))
            .findFirst()
            .orElseThrow();
    assertEquals(Q, created.getQuarter());
    assertEquals("CMPSC 3", created.getCourseId());
    assertEquals(10, created.getEnrollment());
    assertEquals(20, created.getMaxEnroll());
    assertFalse(created.getEnrollmentRefreshedAt().isBefore(before));
    assertTrue(saved.getAllValues().contains(found));
    assertTrue(saved.getAllValues().contains(gone));
  }

  @Test
  public void refreshCache_with_nothing_on_file_and_nothing_given_does_nothing() {
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of());

    assertEquals(0, service.refreshCache(Q, List.of(), Map.of()));

    verify(budgetCourseRepository, never()).save(any());
  }

  @Test
  public void refreshCache_does_not_create_a_second_row_for_a_section_already_on_file() {
    BudgetCourse found = figures(1L, "07492", 1, 2, 120);
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of(found));

    int cached = service.refreshCache(Q, List.of(row(1L, "07492", false)), Map.of());

    assertEquals(0, cached);
    assertEquals(1, found.getEnrollment());
    verify(budgetCourseRepository, times(1)).save(found);
    verify(budgetRepository, never()).save(any());
  }

  // ---- isFresh ----

  private BudgetCourse stamped(String enrollCode, LocalDateTime at) {
    BudgetCourse figures = figures(1L, enrollCode, 1, 2, null);
    figures.setEnrollmentRefreshedAt(at);
    return figures;
  }

  @Test
  public void the_ttl_is_24_hours() {
    assertEquals(Duration.ofHours(24), BudgetCourseService.TTL);
  }

  @Test
  public void rows_checked_within_the_ttl_are_fresh() {
    when(budgetCourseRepository.findByQuarter(Q))
        .thenReturn(
            List.of(
                stamped("07492", AppTime.now().minusHours(23)),
                stamped("07500", AppTime.now().minusMinutes(1))));

    assertTrue(service.isFresh(Q, List.of(row(1L, "07492", false), row(2L, "07500", false))));
  }

  @Test
  public void one_row_checked_before_the_ttl_makes_the_list_stale() {
    when(budgetCourseRepository.findByQuarter(Q))
        .thenReturn(
            List.of(
                stamped("07492", AppTime.now().minusMinutes(1)),
                stamped("07500", AppTime.now().minusHours(25))));

    assertFalse(service.isFresh(Q, List.of(row(1L, "07492", false), row(2L, "07500", false))));
  }

  @Test
  public void a_row_never_checked_or_without_a_quarter_row_is_stale() {
    when(budgetCourseRepository.findByQuarter(Q))
        .thenReturn(List.of(stamped("07492", AppTime.now()), stamped("07500", null)));

    assertFalse(service.isFresh(Q, List.of(row(1L, "07492", false), row(2L, "07500", false))));
    assertFalse(service.isFresh(Q, List.of(row(1L, "07492", false), row(3L, "09999", false))));
  }

  @Test
  public void a_list_with_nothing_to_check_is_fresh() {
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of());

    assertTrue(service.isFresh(Q, List.of()));
  }

  // ---- setEstimate ----

  @Test
  public void setEstimate_sets_the_value_forgets_the_source_and_saves() {
    BudgetCourse onFile = figures(1L, "07492", 100, 150, 120);
    onFile.setEnrollmentEstimateSource(EnrollmentEstimateSource.MAX);
    when(budgetCourseRepository.findByQuarterAndEnrollCode(Q, "07492"))
        .thenReturn(Optional.of(onFile));

    BudgetCourse saved = service.setEstimate(Q, row(1L, "07492", false), 140);

    assertSame(onFile, saved);
    assertEquals(140, saved.getEnrollmentEstimate());
    assertNull(saved.getEnrollmentEstimateSource());
    verify(budgetCourseRepository).save(onFile);
  }

  @Test
  public void setEstimate_with_null_clears_it_and_creates_the_row_if_need_be() {
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(Budget.builder().quarter(Q).build()));

    BudgetCourse saved = service.setEstimate(Q, row(1L, "07492", false), null);

    assertEquals("07492", saved.getEnrollCode());
    assertNull(saved.getEnrollmentEstimate());
    verify(budgetCourseRepository, times(2)).save(saved);
  }

  // ---- fillEstimates ----

  @Test
  public void fillEstimates_from_max_copies_the_maximum_and_records_the_source() {
    BudgetCourse a = figures(1L, "07492", 100, 150, 1);
    BudgetCourse noFigure = figures(2L, "07500", null, null, 42);
    BudgetCourse notAsked = figures(3L, "07600", 10, 20, 7);
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of(a, noFigure, notAsked));

    int filled =
        service.fillEstimates(
            Q,
            List.of(row(1L, "07492", false), row(2L, "07500", false), row(9L, "09999", false)),
            EnrollmentEstimateSource.MAX);

    assertEquals(1, filled);
    assertEquals(150, a.getEnrollmentEstimate());
    assertEquals(EnrollmentEstimateSource.MAX, a.getEnrollmentEstimateSource());
    // No figure: keeps its estimate. Not asked for: untouched. No row: skipped.
    assertEquals(42, noFigure.getEnrollmentEstimate());
    assertNull(noFigure.getEnrollmentEstimateSource());
    assertEquals(7, notAsked.getEnrollmentEstimate());
    verify(budgetCourseRepository, times(1)).save(a);
    verify(budgetCourseRepository, never()).save(noFigure);
    verify(budgetCourseRepository, never()).save(notAsked);
  }

  @Test
  public void fillEstimates_from_actual_copies_the_enrollment_zero_included() {
    BudgetCourse a = figures(1L, "07492", 100, 150, null);
    BudgetCourse b = figures(2L, "07500", 0, 80, 5);
    when(budgetCourseRepository.findByQuarter(Q)).thenReturn(List.of(a, b));

    int filled =
        service.fillEstimates(
            Q,
            List.of(row(1L, "07492", false), row(2L, "07500", false)),
            EnrollmentEstimateSource.ACTUAL);

    assertEquals(2, filled);
    assertEquals(100, a.getEnrollmentEstimate());
    assertEquals(0, b.getEnrollmentEstimate());
    assertEquals(EnrollmentEstimateSource.ACTUAL, b.getEnrollmentEstimateSource());
    verify(budgetCourseRepository).save(a);
    verify(budgetCourseRepository).save(b);
  }

  // ---- dropIfUnused ----

  private Recruitment recruitment(long id, RecruitmentType type) {
    Recruitment recruitment = Recruitment.builder().id(id).quarter(Q).type(type).build();
    when(recruitmentRepository.findByQuarterAndType(Q, type)).thenReturn(Optional.of(recruitment));
    return recruitment;
  }

  @Test
  public void the_row_stays_while_some_recruitment_still_has_the_section() {
    recruitment(5L, RecruitmentType.TA);
    recruitment(6L, RecruitmentType.ULA);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(5L, "07492"))
        .thenReturn(Optional.of(row(1L, "07492", true)));
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(6L, "07492"))
        .thenReturn(Optional.of(row(2L, "07492", false)));

    assertFalse(service.dropIfUnused(Q, "07492"));

    verify(budgetCourseRepository, never()).delete(any());
    verify(budgetCourseRepository, never()).findByQuarterAndEnrollCode(any(), any());
  }

  @Test
  public void the_row_stays_while_the_only_recruitment_still_has_the_section() {
    recruitment(5L, RecruitmentType.TA);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(5L, "07492"))
        .thenReturn(Optional.of(row(1L, "07492", false)));

    assertFalse(service.dropIfUnused(Q, "07492"));

    verify(budgetCourseRepository, never()).delete(any());
  }

  @Test
  public void the_row_is_deleted_once_every_recruitment_that_had_the_section_removed_it() {
    recruitment(5L, RecruitmentType.TA);
    recruitment(6L, RecruitmentType.ULA);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(5L, "07492"))
        .thenReturn(Optional.of(row(1L, "07492", true)));
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(6L, "07492"))
        .thenReturn(Optional.empty());
    BudgetCourse figures = figures(1L, "07492", 100, 150, 120);
    when(budgetCourseRepository.findByQuarterAndEnrollCode(Q, "07492"))
        .thenReturn(Optional.of(figures));

    assertTrue(service.dropIfUnused(Q, "07492"));

    verify(budgetCourseRepository).delete(figures);
  }

  @Test
  public void nothing_to_delete_is_not_a_deletion() {
    recruitment(5L, RecruitmentType.TA);
    when(recruitmentCourseRepository.findByRecruitmentIdAndEnrollCode(5L, "07492"))
        .thenReturn(Optional.of(row(1L, "07492", true)));

    assertFalse(service.dropIfUnused(Q, "07492"));

    verify(budgetCourseRepository, never()).delete(any());
  }
}
