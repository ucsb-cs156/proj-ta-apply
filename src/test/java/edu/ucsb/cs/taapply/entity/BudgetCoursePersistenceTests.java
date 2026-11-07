package edu.ucsb.cs.taapply.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.enums.EnrollmentEstimateSource;
import edu.ucsb.cs.taapply.repository.BudgetCourseRepository;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

/** The budget_courses table round-trips through the Liquibase schema (issue #363). */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class BudgetCoursePersistenceTests {
  @Autowired BudgetRepository budgets;
  @Autowired BudgetCourseRepository budgetCourses;
  @Autowired TestEntityManager entityManager;

  @BeforeEach
  void theQuarterHasABudget() {
    budgets.save(Budget.builder().quarter("20264").build());
  }

  @Test
  void a_row_keeps_every_column() {
    LocalDateTime checked = LocalDateTime.of(2026, 11, 6, 3, 0, 0);
    budgetCourses.save(
        BudgetCourse.builder()
            .quarter("20264")
            .enrollCode("07492")
            .courseId("CMPSC   156")
            .section("0100")
            .enrollment(118)
            .maxEnroll(150)
            .enrollmentRefreshedAt(checked)
            .enrollmentEstimate(140)
            .enrollmentEstimateSource(EnrollmentEstimateSource.ACTUAL)
            .build());
    entityManager.flush();
    entityManager.clear();

    BudgetCourse found = budgetCourses.findByQuarterAndEnrollCode("20264", "07492").orElseThrow();
    assertEquals("CMPSC   156", found.getCourseId());
    assertEquals("0100", found.getSection());
    assertEquals(118, found.getEnrollment());
    assertEquals(150, found.getMaxEnroll());
    assertEquals(checked, found.getEnrollmentRefreshedAt());
    assertEquals(140, found.getEnrollmentEstimate());
    assertEquals(EnrollmentEstimateSource.ACTUAL, found.getEnrollmentEstimateSource());
    assertEquals(1, budgetCourses.findByQuarter("20264").size());
    assertTrue(budgetCourses.findByQuarter("20271").isEmpty());
  }

  @Test
  void a_new_row_has_no_figures_no_estimate_and_no_source() {
    budgetCourses.save(BudgetCourse.builder().quarter("20264").enrollCode("07492").build());
    entityManager.flush();
    entityManager.clear();

    BudgetCourse found = budgetCourses.findByQuarterAndEnrollCode("20264", "07492").orElseThrow();
    assertNull(found.getEnrollment());
    assertNull(found.getMaxEnroll());
    assertNull(found.getEnrollmentRefreshedAt());
    assertNull(found.getEnrollmentEstimate());
    assertNull(found.getEnrollmentEstimateSource());
  }

  @Test
  void a_section_has_one_row_per_quarter() {
    budgetCourses.save(BudgetCourse.builder().quarter("20264").enrollCode("07492").build());
    entityManager.flush();

    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          budgetCourses.save(BudgetCourse.builder().quarter("20264").enrollCode("07492").build());
          entityManager.flush();
        });
  }

  @Test
  void the_rows_belong_to_the_quarters_budget() {
    // No budget for 20271: the foreign key refuses the row.
    assertThrows(
        DataIntegrityViolationException.class,
        () -> {
          budgetCourses.save(BudgetCourse.builder().quarter("20271").enrollCode("07492").build());
          entityManager.flush();
        });
  }

  @Test
  void deleting_the_budget_takes_its_rows_with_it() {
    budgetCourses.save(BudgetCourse.builder().quarter("20264").enrollCode("07492").build());
    entityManager.flush();

    entityManager
        .getEntityManager()
        .createNativeQuery("DELETE FROM budgets WHERE quarter = '20264'")
        .executeUpdate();
    entityManager.clear();

    assertTrue(budgetCourses.findByQuarter("20264").isEmpty());
  }
}
