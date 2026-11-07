package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

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
  void a_budget_keeps_its_conversion_factor_and_defaults_to_three() {
    budgets.save(Budget.builder().quarter("20264").build());
    budgets.save(Budget.builder().quarter("20271").conversionTAtoULA(2.5).build());
    entityManager.flush();
    entityManager.clear();

    assertEquals(3.0, budgets.findById("20264").orElseThrow().getConversionTAtoULA());
    assertEquals(2.5, budgets.findById("20271").orElseThrow().getConversionTAtoULA());
  }

  @Test
  void a_budget_row_that_existed_before_the_column_gets_three() {
    // The way the older code inserted a budget: without the column.
    entityManager
        .getEntityManager()
        .createNativeQuery(
            "INSERT INTO budgets (quarter, unrestricted_budget, tas_only_budget,"
                + " ulas_only_budget, version) VALUES ('20254', 1, 2, 3, 0)")
        .executeUpdate();
    entityManager.clear();

    assertEquals(3.0, budgets.findById("20254").orElseThrow().getConversionTAtoULA());
  }

  @Test
  void a_budget_keeps_both_counts_and_starts_them_at_zero() {
    budgets.save(Budget.builder().quarter("20264").build());
    budgets.save(Budget.builder().quarter("20271").version(4).conversionVersion(2).build());
    entityManager.flush();
    entityManager.clear();

    Budget fresh = budgets.findById("20264").orElseThrow();
    assertEquals(0, fresh.getVersion());
    assertEquals(0, fresh.getConversionVersion());
    Budget counted = budgets.findById("20271").orElseThrow();
    assertEquals(4, counted.getVersion());
    assertEquals(2, counted.getConversionVersion());
  }

  @Test
  void a_budget_row_that_existed_before_the_conversion_version_column_gets_zero() {
    // The way the older code inserted a budget (issue #375): without the column.
    entityManager
        .getEntityManager()
        .createNativeQuery(
            "INSERT INTO budgets (quarter, unrestricted_budget, tas_only_budget,"
                + " ulas_only_budget, conversion_ta_to_ula, version) VALUES ('20254', 1, 2, 3, 3, 7)")
        .executeUpdate();
    entityManager.clear();

    Budget found = budgets.findById("20254").orElseThrow();
    assertEquals(0, found.getConversionVersion());
    assertEquals(7, found.getVersion());
  }

  @Test
  void a_budget_keeps_its_rate_hours_and_other_funds_to_the_cent_and_starts_them_empty() {
    budgets.save(Budget.builder().quarter("20264").build());
    budgets.save(
        Budget.builder()
            .quarter("20271")
            .ulaRateDollarsPerHour(new BigDecimal("29.38"))
            .estimatedHoursPerULAPerQuarter(new BigDecimal("110.50"))
            .giftFundsForASEs(new BigDecimal("32200.01"))
            .build());
    entityManager.flush();
    entityManager.clear();

    Budget fresh = budgets.findById("20264").orElseThrow();
    assertNull(fresh.getUlaRateDollarsPerHour());
    assertNull(fresh.getEstimatedHoursPerULAPerQuarter());
    assertNull(fresh.getGiftFundsForASEs());
    Budget entered = budgets.findById("20271").orElseThrow();
    assertEquals(new BigDecimal("29.38"), entered.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("110.50"), entered.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("32200.01"), entered.getGiftFundsForASEs());
  }

  @Test
  void a_budget_row_that_existed_before_the_rate_hours_and_other_funds_columns_has_none() {
    // The way the older code inserted a budget (issue #388): without the three columns.
    entityManager
        .getEntityManager()
        .createNativeQuery(
            "INSERT INTO budgets (quarter, unrestricted_budget, tas_only_budget,"
                + " ulas_only_budget, conversion_ta_to_ula, version, conversion_version)"
                + " VALUES ('20254', 1, 2, 3, 3, 7, 1)")
        .executeUpdate();
    entityManager.clear();

    Budget found = budgets.findById("20254").orElseThrow();
    assertNull(found.getUlaRateDollarsPerHour());
    assertNull(found.getEstimatedHoursPerULAPerQuarter());
    assertNull(found.getGiftFundsForASEs());
    assertEquals(7, found.getVersion());
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
