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
 * enrollment totals, and the anticipated expenses, funds and bottom line. All money is in dollars
 * and cents, as {@link BigDecimal}s with two decimal places.
 */
@Service
public class BudgetService {

  @Autowired BudgetRepository budgetRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;

  /** A quarter with at least one recruitment, and which types it has. */
  public record QuarterSummary(String quarter, boolean hasTa, boolean hasUla) {}

  /**
   * One recruitment's side of the budget.
   *
   * @param totalAllocation the sum of the allocations of its non-removed courses
   * @param totalEnrollmentEstimate the sum of their enrollment estimates, a missing one counting as
   *     0
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
   * @param totalExpenses the two anticipated costs added
   * @param totalFunds the budget's three lines added
   * @param bottomLine totalFunds minus totalExpenses
   */
  public record Summary(
      String quarter,
      Budget budget,
      Side ta,
      Side ula,
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
    Side ta = sideFor(quarter, RecruitmentType.TA);
    Side ula = sideFor(quarter, RecruitmentType.ULA);
    BigDecimal totalExpenses = costOf(ta).add(costOf(ula));
    BigDecimal totalFunds =
        money(budget.getUnrestrictedBudget())
            .add(money(budget.getTasOnlyBudget()))
            .add(money(budget.getUlasOnlyBudget()));
    return new Summary(
        quarter, budget, ta, ula, totalExpenses, totalFunds, totalFunds.subtract(totalExpenses));
  }

  private Side sideFor(String quarter, RecruitmentType type) {
    Optional<Recruitment> recruitment = recruitmentRepository.findByQuarterAndType(quarter, type);
    return recruitment.map(this::side).orElse(null);
  }

  private Side side(Recruitment recruitment) {
    List<RecruitmentCourse> active =
        recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
            .filter(row -> !row.isRemoved())
            .toList();
    int totalAllocation = active.stream().mapToInt(RecruitmentCourse::getAllocation).sum();
    int totalEstimate = active.stream().mapToInt(BudgetService::estimateOf).sum();
    int target = recruitment.getTotalHiringTarget();
    BigDecimal cost =
        recruitment.getAvgCostPerPosition() == null
            ? money(BigDecimal.ZERO)
            : money(recruitment.getAvgCostPerPosition().multiply(BigDecimal.valueOf(target)));
    return new Side(
        recruitment.getId(),
        target,
        recruitment.getAvgCostPerPosition(),
        totalAllocation,
        totalEstimate,
        totalAllocation - target,
        totalEstimate == 0 ? null : (double) totalEstimate / target,
        cost);
  }

  private static BigDecimal costOf(Side side) {
    return side == null ? money(BigDecimal.ZERO) : side.anticipatedCost();
  }

  private static int estimateOf(RecruitmentCourse row) {
    return row.getEnrollmentEstimate() == null ? 0 : row.getEnrollmentEstimate();
  }

  /** Dollars and cents: two decimal places, half up. */
  public static BigDecimal money(BigDecimal amount) {
    return amount.setScale(2, RoundingMode.HALF_UP);
  }
}
