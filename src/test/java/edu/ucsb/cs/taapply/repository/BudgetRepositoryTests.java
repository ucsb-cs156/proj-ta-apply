package edu.ucsb.cs.taapply.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import edu.ucsb.cs.taapply.entity.Budget;
import java.math.BigDecimal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * The budget's queries against the real Liquibase-built schema: in particular the "most recent
 * earlier quarter" lookup that a new quarter's budget is copied from (issue #384).
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
public class BudgetRepositoryTests {

  @Autowired private BudgetRepository budgetRepository;

  @BeforeEach
  void clean() {
    budgetRepository.deleteAll();
  }

  private Budget budget(String quarter, String unrestricted) {
    return budgetRepository.save(
        Budget.builder().quarter(quarter).unrestrictedBudget(new BigDecimal(unrestricted)).build());
  }

  @Test
  public void the_most_recent_earlier_quarter_is_the_largest_yyyyq_below_the_given_one() {
    budget("20262", "2");
    budget("20271", "4");
    budget("20264", "3");
    budget("20261", "1");

    assertEquals(
        "20264",
        budgetRepository
            .findFirstByQuarterLessThanOrderByQuarterDesc("20271")
            .orElseThrow()
            .getQuarter());
    // Fall 2026 skips the summer, which has no budget, back to spring.
    assertEquals(
        "20262",
        budgetRepository
            .findFirstByQuarterLessThanOrderByQuarterDesc("20264")
            .orElseThrow()
            .getQuarter());
    // A quarter later than every budget on file copies the latest one.
    assertEquals(
        "20271",
        budgetRepository
            .findFirstByQuarterLessThanOrderByQuarterDesc("20283")
            .orElseThrow()
            .getQuarter());
    // The quarter's own budget does not count: strictly earlier.
    assertEquals(
        "20261",
        budgetRepository
            .findFirstByQuarterLessThanOrderByQuarterDesc("20262")
            .orElseThrow()
            .getQuarter());
  }

  @Test
  public void the_earliest_quarter_has_no_earlier_budget() {
    budget("20262", "2");
    budget("20264", "3");

    assertFalse(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc("20262").isPresent());
    assertFalse(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc("20251").isPresent());
  }

  @Test
  public void with_no_budget_on_file_there_is_nothing_to_copy() {
    assertFalse(budgetRepository.findFirstByQuarterLessThanOrderByQuarterDesc("20271").isPresent());
  }
}
