package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The figures behind the Budget for Quarter page (issue #177): which quarters have recruitments,
 * and for one quarter the budget row, each recruitment's hiring target, cost, allocation and
 * enrollment totals, the estimated cost per ULA computed from the budget's rate and hours (issue
 * #388), and the anticipated expenses, funds and bottom line. All money is in dollars and cents, as
 * {@link BigDecimal}s with two decimal places.
 */
@Service
public class BudgetService {

  @Autowired BudgetRepository budgetRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired BudgetCourseService budgetCourseService;

  /** A quarter with at least one recruitment, and which types it has. */
  public record QuarterSummary(String quarter, boolean hasTa, boolean hasUla) {}

  /**
   * One recruitment's side of the budget.
   *
   * @param avgCostPerPosition the estimated cost of one position per quarter: on the TA side the
   *     recruitment's stored cost per TA; on the ULA side the budget's {@link #estimatedCostPerUla
   *     computed cost per ULA} (issue #388); null while unknown
   * @param totalAllocation the sum of the allocations of its non-removed courses
   * @param totalEnrollmentEstimate the sum of their enrollment estimates (the quarter's, from
   *     {@code budget_courses}), a missing one counting as 0
   * @param allocationDifference totalAllocation minus totalHiringTarget; 0 when they agree
   * @param studentsPerPosition totalEnrollmentEstimate divided by totalHiringTarget, the n of the
   *     "1:n" ratio; null when there are no estimates
   * @param anticipatedCost totalHiringTarget times avgCostPerPosition; 0 while the cost is unknown
   */
  public record Side(
      Long recruitmentId,
      Integer totalHiringTarget,
      BigDecimal avgCostPerPosition,
      int totalAllocation,
      int totalEnrollmentEstimate,
      int allocationDifference,
      Double studentsPerPosition,
      BigDecimal anticipatedCost) {}

  /**
   * Everything the page shows for one quarter. {@code ta} or {@code ula} is null when the quarter
   * has no recruitment of that type.
   *
   * @param estimatedCostPerULAPerQuarter the budget's ULA hourly rate times its hours per ULA, to
   *     the cent (issue #388); null while either is not yet entered. Shown whether or not the
   *     quarter has a ULA recruitment.
   * @param totalExpenses the two anticipated costs added
   * @param totalFunds the budget's three subzero lines and its other funds for ASEs added
   * @param bottomLine totalFunds minus totalExpenses
   */
  public record Summary(
      String quarter,
      Budget budget,
      Side ta,
      Side ula,
      BigDecimal estimatedCostPerULAPerQuarter,
      BigDecimal totalExpenses,
      BigDecimal totalFunds,
      BigDecimal bottomLine) {}

  /** Every quarter with a recruitment, most recent first. */
  public List<QuarterSummary> quarters() {
    Map<String, boolean[]> byQuarter = new LinkedHashMap<>();
    for (Recruitment recruitment : recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()) {
      boolean[] types = byQuarter.computeIfAbsent(recruitment.getQuarter(), q -> new boolean[2]);
      if (recruitment.getType() == RecruitmentType.TA) {
        types[0] = true;
      } else {
        types[1] = true;
      }
    }
    List<QuarterSummary> result = new ArrayList<>();
    byQuarter.forEach(
        (quarter, types) -> result.add(new QuarterSummary(quarter, types[0], types[1])));
    return result;
  }

  /**
   * The quarter's budget row, created with every line at zero if this is the first time it is asked
   * for. Only quarters with at least one recruitment have a budget.
   *
   * @throws EntityNotFoundException when the quarter has no recruitment
   */
  public Budget budgetFor(String quarter) {
    if (recruitmentRepository.findByQuarterAndType(quarter, RecruitmentType.TA).isEmpty()
        && recruitmentRepository.findByQuarterAndType(quarter, RecruitmentType.ULA).isEmpty()) {
      throw new EntityNotFoundException("No recruitment for quarter %s".formatted(quarter));
    }
    return budgetRepository
        .findById(quarter)
        .orElseGet(() -> budgetRepository.save(Budget.builder().quarter(quarter).build()));
  }

  /**
   * The whole picture for one quarter.
   *
   * @throws EntityNotFoundException when the quarter has no recruitment
   */
  public Summary summary(String quarter) {
    Budget budget = budgetFor(quarter);
    Side ta = sideFor(quarter, RecruitmentType.TA, budget);
    Side ula = sideFor(quarter, RecruitmentType.ULA, budget);
    BigDecimal totalExpenses = costOf(ta).add(costOf(ula));
    BigDecimal totalFunds =
        money(budget.getUnrestrictedBudget())
            .add(money(budget.getTasOnlyBudget()))
            .add(money(budget.getUlasOnlyBudget()))
            .add(money(orZero(budget.getGiftFundsForASEs())));
    return new Summary(
        quarter,
        budget,
        ta,
        ula,
        estimatedCostPerUla(budget),
        totalExpenses,
        totalFunds,
        totalFunds.subtract(totalExpenses));
  }

  /**
   * The estimated cost of one ULA for the quarter (issue #388): the budget's hourly rate times its
   * estimated hours per ULA, to the cent; null while either has not been entered.
   */
  public static BigDecimal estimatedCostPerUla(Budget budget) {
    BigDecimal rate = budget.getUlaRateDollarsPerHour();
    BigDecimal hours = budget.getEstimatedHoursPerULAPerQuarter();
    return rate == null || hours == null ? null : money(rate.multiply(hours));
  }

  private Side sideFor(String quarter, RecruitmentType type, Budget budget) {
    Optional<Recruitment> recruitment = recruitmentRepository.findByQuarterAndType(quarter, type);
    return recruitment.map(found -> side(found, budget)).orElse(null);
  }

  private Side side(Recruitment recruitment, Budget budget) {
    List<RecruitmentCourse> active =
        recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
            .filter(row -> !row.isRemoved())
            .toList();
    // The estimates are the quarter's (issue #363), shared with the other recruitment.
    budgetCourseService.attach(recruitment.getQuarter(), active);
    int totalAllocation = active.stream().mapToInt(RecruitmentCourse::getAllocation).sum();
    int totalEstimate = active.stream().mapToInt(BudgetService::estimateOf).sum();
    int target = recruitment.getTotalHiringTarget();
    // The cost per ULA is computed from the budget (issue #388), the cost per TA is the TA
    // recruitment's own.
    BigDecimal perPosition =
        recruitment.getType() == RecruitmentType.ULA
            ? estimatedCostPerUla(budget)
            : recruitment.getAvgCostPerPosition();
    BigDecimal cost =
        perPosition == null
            ? money(BigDecimal.ZERO)
            : money(perPosition.multiply(BigDecimal.valueOf(target)));
    return new Side(
        recruitment.getId(),
        target,
        perPosition,
        totalAllocation,
        totalEstimate,
        totalAllocation - target,
        totalEstimate == 0 ? null : (double) totalEstimate / target,
        cost);
  }

  private static BigDecimal costOf(Side side) {
    return side == null ? money(BigDecimal.ZERO) : side.anticipatedCost();
  }

  private static BigDecimal orZero(BigDecimal amount) {
    return amount == null ? BigDecimal.ZERO : amount;
  }

  private static int estimateOf(RecruitmentCourse row) {
    return row.getEnrollmentEstimate() == null ? 0 : row.getEnrollmentEstimate();
  }

  /** Dollars and cents: two decimal places, half up. */
  public static BigDecimal money(BigDecimal amount) {
    return amount.setScale(2, RoundingMode.HALF_UP);
  }
}
