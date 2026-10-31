package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.services.BudgetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Budget for Quarter page (issue #177): the quarters to choose from, and for one quarter the
 * budget lines and everything derived from them. Planning figures, so none of it is audited.
 */
@Tag(name = "Budget")
@RequestMapping("/api/admin/budget")
@RestController
public class BudgetController extends ApiController {

  @Autowired BudgetService budgetService;
  @Autowired BudgetRepository budgetRepository;

  @Operation(
      summary = "The quarters that have a recruitment, most recent first",
      description = "Each says whether it has a TA recruitment and whether it has a ULA one.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/quarters")
  public List<BudgetService.QuarterSummary> quarters() {
    return budgetService.quarters();
  }

  @Operation(
      summary = "One quarter's budget and the figures derived from it",
      description =
          "The budget row (created at zero on first read), each recruitment's hiring target, cost"
              + " per position, allocation and enrollment totals, and the anticipated expenses,"
              + " funds and bottom line. 404 when the quarter has no recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public BudgetService.Summary summary(
      @Parameter(name = "quarter", description = "YYYYQ, e.g. 20264") @RequestParam
          String quarter) {
    return budgetService.summary(quarter);
  }

  @Operation(
      summary = "Set one or more of a quarter's budget lines",
      description =
          "Any of the three may be given; the others keep their values. Amounts are dollars and"
              + " cents and must not be negative. Returns the quarter's summary with the new"
              + " figures.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("")
  public BudgetService.Summary update(
      @Parameter(name = "quarter") @RequestParam String quarter,
      @Parameter(name = "unrestrictedBudget") @RequestParam(required = false)
          BigDecimal unrestrictedBudget,
      @Parameter(name = "tasOnlyBudget") @RequestParam(required = false) BigDecimal tasOnlyBudget,
      @Parameter(name = "ulasOnlyBudget") @RequestParam(required = false)
          BigDecimal ulasOnlyBudget) {
    requireNotNegative("unrestrictedBudget", unrestrictedBudget);
    requireNotNegative("tasOnlyBudget", tasOnlyBudget);
    requireNotNegative("ulasOnlyBudget", ulasOnlyBudget);

    Budget budget = budgetService.budgetFor(quarter);
    if (unrestrictedBudget != null) {
      budget.setUnrestrictedBudget(BudgetService.money(unrestrictedBudget));
    }
    if (tasOnlyBudget != null) {
      budget.setTasOnlyBudget(BudgetService.money(tasOnlyBudget));
    }
    if (ulasOnlyBudget != null) {
      budget.setUlasOnlyBudget(BudgetService.money(ulasOnlyBudget));
    }
    budgetRepository.save(budget);
    return budgetService.summary(quarter);
  }

  private static void requireNotNegative(String name, BigDecimal amount) {
    if (amount != null && amount.signum() < 0) {
      throw new IllegalArgumentException("%s must not be negative".formatted(name));
    }
  }
}
