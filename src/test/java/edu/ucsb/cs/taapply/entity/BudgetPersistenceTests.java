package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

/** The budgets table and the cost column round-trip through the Liquibase schema (issue #177). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class BudgetPersistenceTests {
  @Autowired BudgetRepository budgets;
  @Autowired RecruitmentRepository recruitments;
  @Autowired TestEntityManager entityManager;

  @Test
  void a_budget_keeps_its_lines_to_the_cent_and_defaults_to_zero() {
    budgets.save(
        Budget.builder()
            .quarter("20264")
            .unrestrictedBudget(new BigDecimal("123456.78"))
            .tasOnlyBudget(new BigDecimal("0.50"))
            .build());
    entityManager.flush();
    entityManager.clear();

    Budget found = budgets.findById("20264").orElseThrow();
    assertEquals(new BigDecimal("123456.78"), found.getUnrestrictedBudget());
    assertEquals(new BigDecimal("0.50"), found.getTasOnlyBudget());
    assertEquals(new BigDecimal("0.00"), found.getUlasOnlyBudget());
  }

  @Test
  void a_recruitment_keeps_its_average_cost_per_position() {
    Recruitment saved =
        recruitments.save(
            Recruitment.builder()
                .quarter("20264")
                .type(RecruitmentType.TA)
                .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
                .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
                .avgCostPerPosition(new BigDecimal("12345.67"))
                .build());
    entityManager.flush();
    entityManager.clear();

    Recruitment found = recruitments.findById(saved.getId()).orElseThrow();
    assertEquals(new BigDecimal("12345.67"), found.getAvgCostPerPosition());
  }
}
