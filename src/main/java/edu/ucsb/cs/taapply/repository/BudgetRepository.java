package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Budget;
import java.util.Optional;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/** Budgets are keyed on the quarter (YYYYQ), one per quarter. */
@Repository
public interface BudgetRepository extends CrudRepository<Budget, String> {

  /**
   * The budget of the most recent quarter before the given one (issue #384): the one with the
   * largest YYYYQ smaller than {@code quarter}, which the fixed width of YYYYQ makes a plain string
   * comparison. Empty when no earlier quarter has a budget.
   */
  Optional<Budget> findFirstByQuarterLessThanOrderByQuarterDesc(String quarter);
}
