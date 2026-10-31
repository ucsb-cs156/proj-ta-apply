package edu.ucsb.cs.taapply.repository;

import edu.ucsb.cs.taapply.entity.Budget;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

/** Budgets are keyed on the quarter (YYYYQ), one per quarter. */
@Repository
public interface BudgetRepository extends CrudRepository<Budget, String> {}
