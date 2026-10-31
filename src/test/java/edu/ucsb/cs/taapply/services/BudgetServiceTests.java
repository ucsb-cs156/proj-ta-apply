package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.BudgetService.QuarterSummary;
import edu.ucsb.cs.taapply.services.BudgetService.Side;
import edu.ucsb.cs.taapply.services.BudgetService.Summary;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {BudgetService.class})
@ActiveProfiles("test")
public class BudgetServiceTests {

  @Autowired BudgetService service;
  @MockitoBean BudgetRepository budgetRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;

  private static final String Q = "20264";

  private static Recruitment recruitment(
      long id, String quarter, RecruitmentType type, int target, String avgCost) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .totalHiringTarget(target)
        .avgCostPerPosition(avgCost == null ? null : new BigDecimal(avgCost))
        .build();
  }

  private static RecruitmentCourse row(long id, Integer estimate, int allocation, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .courseId("CMPSC " + id)
        .enrollCode("EC" + id)
        .enrollmentEstimate(estimate)
        .allocation(allocation)
        .removed(removed)
        .build();
  }

  private static Budget budget(String unrestricted, String tas, String ulas) {
    return Budget.builder()
        .quarter(Q)
        .unrestrictedBudget(new BigDecimal(unrestricted))
        .tasOnlyBudget(new BigDecimal(tas))
        .ulasOnlyBudget(new BigDecimal(ulas))
        .build();
  }

  @BeforeEach
  public void nothingOnFile() {
    when(recruitmentRepository.findByQuarterAndType(any(), any())).thenReturn(Optional.empty());
    when(budgetRepository.findById(any())).thenReturn(Optional.empty());
    when(budgetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
  }

  // ---- quarters ----

  @Test
  public void quarters_groups_recruitments_by_quarter_newest_first() {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(
            List.of(
                recruitment(5L, "20264", RecruitmentType.TA, 1, null),
                recruitment(6L, "20264", RecruitmentType.ULA, 1, null),
                recruitment(3L, "20262", RecruitmentType.ULA, 1, null),
                recruitment(1L, "20261", RecruitmentType.TA, 1, null)));

    assertEquals(
        List.of(
            new QuarterSummary("20264", true, true),
            new QuarterSummary("20262", false, true),
            new QuarterSummary("20261", true, false)),
        service.quarters());
  }

  @Test
  public void quarters_is_empty_when_there_are_no_recruitments() {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of());
    assertEquals(List.of(), service.quarters());
  }

  // ---- budgetFor ----

  @Test
  public void a_quarter_with_no_recruitment_has_no_budget() {
    EntityNotFoundException e =
        assertThrows(EntityNotFoundException.class, () -> service.budgetFor(Q));
    assertEquals("No recruitment for quarter 20264", e.getMessage());
    verify(budgetRepository, never()).save(any());
  }

  @Test
  public void a_quarter_with_only_a_ta_recruitment_gets_a_budget_created_at_zero() {
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.TA))
        .thenReturn(Optional.of(recruitment(5L, Q, RecruitmentType.TA, 1, null)));

    Budget budget = service.budgetFor(Q);

    assertEquals(Q, budget.getQuarter());
    assertEquals(BigDecimal.ZERO, budget.getUnrestrictedBudget());
    assertEquals(BigDecimal.ZERO, budget.getTasOnlyBudget());
    assertEquals(BigDecimal.ZERO, budget.getUlasOnlyBudget());
    verify(budgetRepository).save(budget);
  }

  @Test
  public void a_quarter_with_only_a_ula_recruitment_returns_the_budget_on_file() {
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.ULA))
        .thenReturn(Optional.of(recruitment(6L, Q, RecruitmentType.ULA, 1, null)));
    Budget onFile = budget("1000.00", "0", "250.50");
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(onFile));

    assertSame(onFile, service.budgetFor(Q));
    verify(budgetRepository, never()).save(any());
  }

  // ---- summary ----

  @Test
  public void summary_with_both_recruitments_adds_up_both_sides() {
    Recruitment ta = recruitment(5L, Q, RecruitmentType.TA, 8, "12000.00");
    Recruitment ula = recruitment(6L, Q, RecruitmentType.ULA, 10, "2500.50");
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.TA))
        .thenReturn(Optional.of(ta));
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.ULA))
        .thenReturn(Optional.of(ula));
    when(budgetRepository.findById(Q))
        .thenReturn(Optional.of(budget("100000", "20000.25", "5000")));
    // Removed rows and missing estimates: neither counts.
    when(recruitmentCourseRepository.findByRecruitmentId(5L))
        .thenReturn(
            List.of(
                row(1L, 300, 4, false),
                row(2L, null, 2, false),
                row(3L, 999, 9, true),
                row(4L, 100, 3, false)));
    when(recruitmentCourseRepository.findByRecruitmentId(6L))
        .thenReturn(List.of(row(7L, 250, 5, false), row(8L, 150, 2, false)));

    Summary summary = service.summary(Q);

    assertEquals(Q, summary.quarter());
    assertEquals(
        new Side(5L, 8, new BigDecimal("12000.00"), 9, 400, 1, 50.0, new BigDecimal("96000.00")),
        summary.ta());
    assertEquals(
        new Side(6L, 10, new BigDecimal("2500.50"), 7, 400, -3, 40.0, new BigDecimal("25005.00")),
        summary.ula());
    assertEquals(new BigDecimal("121005.00"), summary.totalExpenses());
    assertEquals(new BigDecimal("125000.25"), summary.totalFunds());
    assertEquals(new BigDecimal("3995.25"), summary.bottomLine());
    assertEquals(new BigDecimal("100000"), summary.budget().getUnrestrictedBudget());
  }

  @Test
  public void summary_with_only_a_ta_recruitment_has_a_null_ula_side() {
    Recruitment ta = recruitment(5L, Q, RecruitmentType.TA, 3, "1000");
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.TA))
        .thenReturn(Optional.of(ta));
    when(recruitmentCourseRepository.findByRecruitmentId(5L))
        .thenReturn(List.of(row(1L, 90, 3, false)));

    Summary summary = service.summary(Q);

    assertNull(summary.ula());
    assertEquals(
        new Side(5L, 3, new BigDecimal("1000"), 3, 90, 0, 30.0, new BigDecimal("3000.00")),
        summary.ta());
    assertEquals(new BigDecimal("3000.00"), summary.totalExpenses());
    assertEquals(new BigDecimal("0.00"), summary.totalFunds());
    assertEquals(new BigDecimal("-3000.00"), summary.bottomLine());
    // The budget was created for the first read.
    ArgumentCaptor<Budget> saved = ArgumentCaptor.forClass(Budget.class);
    verify(budgetRepository).save(saved.capture());
    assertEquals(Q, saved.getValue().getQuarter());
    assertSame(saved.getValue(), summary.budget());
  }

  @Test
  public void summary_with_only_a_ula_recruitment_and_no_cost_yet_has_zero_expenses() {
    Recruitment ula = recruitment(6L, Q, RecruitmentType.ULA, 4, null);
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.ULA))
        .thenReturn(Optional.of(ula));
    when(budgetRepository.findById(Q)).thenReturn(Optional.of(budget("10", "20.5", "30.25")));
    when(recruitmentCourseRepository.findByRecruitmentId(6L)).thenReturn(List.of());

    Summary summary = service.summary(Q);

    assertNull(summary.ta());
    // No courses: nothing allocated, no estimates, so no ratio; four positions short.
    assertEquals(new Side(6L, 4, null, 0, 0, -4, null, new BigDecimal("0.00")), summary.ula());
    assertEquals(new BigDecimal("0.00"), summary.totalExpenses());
    assertEquals(new BigDecimal("60.75"), summary.totalFunds());
    assertEquals(new BigDecimal("60.75"), summary.bottomLine());
  }

  @Test
  public void estimates_that_add_up_to_zero_give_no_ratio_while_one_student_gives_a_fraction() {
    Recruitment ta = recruitment(5L, Q, RecruitmentType.TA, 4, "0.005");
    when(recruitmentRepository.findByQuarterAndType(Q, RecruitmentType.TA))
        .thenReturn(Optional.of(ta));
    when(recruitmentCourseRepository.findByRecruitmentId(5L))
        .thenReturn(List.of(row(1L, 0, 1, false), row(2L, null, 0, false)));
    assertNull(service.summary(Q).ta().studentsPerPosition());

    when(recruitmentCourseRepository.findByRecruitmentId(5L))
        .thenReturn(List.of(row(1L, 1, 1, false)));
    Side side = service.summary(Q).ta();
    assertEquals(0.25, side.studentsPerPosition());
    // 4 × 0.005 = 0.02, kept to the cent, rounding half up.
    assertEquals(new BigDecimal("0.02"), side.anticipatedCost());
  }

  @Test
  public void summary_of_a_quarter_with_no_recruitment_is_a_404() {
    assertThrows(EntityNotFoundException.class, () -> service.summary(Q));
  }

  // ---- money ----

  @Test
  public void money_has_two_decimal_places_rounding_half_up() {
    assertEquals(new BigDecimal("1.01"), BudgetService.money(new BigDecimal("1.005")));
    assertEquals(new BigDecimal("1.00"), BudgetService.money(new BigDecimal("1.004")));
    assertEquals(new BigDecimal("7.00"), BudgetService.money(new BigDecimal("7")));
    assertEquals(new BigDecimal("2.50"), BudgetService.money(new BigDecimal("2.5")));
  }
}
