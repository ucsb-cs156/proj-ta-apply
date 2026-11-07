package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The one place a quarter's {@link Budget} row is created (issue #384). Two paths need the row:
 * {@link BudgetService#budgetFor} when the Budget page is first opened, and {@link
 * BudgetCourseService} when a recruitment of the quarter first gets a course (Populate, add by
 * enroll code, un-remove), which usually happens first, so both go through {@link #findOrCreate}.
 *
 * <p>A new row starts as a copy of the most recent earlier quarter's budget: the one with the
 * largest YYYYQ smaller than the new quarter's. Copied are the three fund lines, the four cost and
 * fund figures of issue #388 and the TA to ULA conversion factor; the two version counters are not,
 * so the new row starts at zero like any other. With no earlier budget on file the row has the
 * defaults, as it did before the issue. (The hiring targets live on the recruitments and are copied
 * when a recruitment is created; see {@code RecruitmentsController}.)
 *
 * <p>Its own class, rather than a method of {@link BudgetService}, because {@link BudgetService}
 * depends on {@link BudgetCourseService} and the two could not both depend on each other.
 */
@Service
@Slf4j
public class BudgetCreationService {

  @Autowired BudgetRepository budgetRepository;

  /**
   * The quarter's budget row, created as described above if this is the first time it is asked for.
   */
  public Budget findOrCreate(String quarter) {
    return budgetRepository
        .findById(quarter)
        .orElseGet(() -> budgetRepository.save(startingBudget(quarter)));
  }

  /**
   * What a quarter's budget is before anyone edits it: a copy of the most recent earlier quarter's
   * planning figures, or the defaults when there is none. Not saved.
   */
  Budget startingBudget(String quarter) {
    Budget.BudgetBuilder budget = Budget.builder().quarter(quarter);
    Optional<Budget> previous =
        budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc(quarter);
    previous.ifPresent(
        from -> {
          log.info(
              "The budget for {} starts as a copy of the one for {}", quarter, from.getQuarter());
          budget
              .unrestrictedBudget(from.getUnrestrictedBudget())
              .tasOnlyBudget(from.getTasOnlyBudget())
              .ulasOnlyBudget(from.getUlasOnlyBudget())
              .taCostPerQuarter(from.getTaCostPerQuarter())
              .ulaRateDollarsPerHour(from.getUlaRateDollarsPerHour())
              .estimatedHoursPerULAPerQuarter(from.getEstimatedHoursPerULAPerQuarter())
              .giftFundsForASEs(from.getGiftFundsForASEs())
              .conversionTAtoULA(from.getConversionTAtoULA());
        });
    return budget.build();
  }
}
