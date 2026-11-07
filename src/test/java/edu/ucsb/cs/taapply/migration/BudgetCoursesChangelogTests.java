package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.changelog.ChangeSet;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Changeset 063 (issue #363) run by Liquibase over the schema as it was, with rows in it, the way
 * production will meet it: one budget course per quarter and enroll code, the higher of two
 * estimates kept, removed rows left out, the three columns dropped; and its rollback.
 */
public class BudgetCoursesChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET = "063-create-budget-courses";

  private Connection connection;
  private Liquibase liquibase;

  @BeforeEach
  public void open() throws Exception {
    connection =
        DriverManager.getConnection(
            "jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;MODE=PostgreSQL");
    Database database =
        DatabaseFactory.getInstance()
            .findCorrectDatabaseImplementation(new JdbcConnection(connection));
    liquibase = new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), database);
  }

  @AfterEach
  public void close() throws Exception {
    liquibase.close();
  }

  private void sql(String text) throws SQLException {
    try (Statement statement = connection.createStatement()) {
      statement.execute(text);
    }
    connection.commit();
  }

  private List<Object[]> rows(String query) throws SQLException {
    List<Object[]> result = new ArrayList<>();
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery(query)) {
      int columns = rs.getMetaData().getColumnCount();
      while (rs.next()) {
        Object[] row = new Object[columns];
        for (int i = 0; i < columns; i++) {
          row[i] = rs.getObject(i + 1);
        }
        result.add(row);
      }
    }
    return result;
  }

  private Object one(String query) throws SQLException {
    List<Object[]> found = rows(query);
    assertEquals(1, found.size(), query);
    return found.get(0)[0];
  }

  /** Applies every changeset before 063, so there is the old schema to put rows in. */
  private void upToTheChangeset() throws Exception {
    List<ChangeSet> unrun = liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression());
    int at = -1;
    for (int i = 0; i < unrun.size(); i++) {
      if (unrun.get(i).getId().equals(CHANGESET)) {
        at = i;
      }
    }
    assertTrue(at > 0, "the changeset is in the changelog");
    liquibase.update(at, "");
  }

  private long recruitment(String quarter, String type, String lastPopulated) throws SQLException {
    sql(
        "INSERT INTO recruitments (quarter, type, tentative_opening_date, primary_consideration_date,"
            + " created_at, last_populated_at) VALUES ('"
            + quarter
            + "', '"
            + type
            + "', DATE '2026-09-01', DATE '2026-09-15', TIMESTAMP '2026-08-01 10:00:00', "
            + (lastPopulated == null ? "NULL" : "TIMESTAMP '" + lastPopulated + "'")
            + ")");
    return ((Number)
            one(
                "SELECT id FROM recruitments WHERE quarter = '"
                    + quarter
                    + "' AND type = '"
                    + type
                    + "'"))
        .longValue();
  }

  private void course(
      long recruitmentId,
      String enrollCode,
      Integer enrollment,
      Integer maxEnroll,
      Integer estimate,
      boolean removed)
      throws SQLException {
    sql(
        "INSERT INTO recruitment_courses (recruitment_id, course_id, enroll_code, section,"
            + " enrollment, max_enroll, enrollment_estimate, removed) VALUES ("
            + recruitmentId
            + ", 'CMPSC   156', '"
            + enrollCode
            + "', '0100', "
            + enrollment
            + ", "
            + maxEnroll
            + ", "
            + estimate
            + ", "
            + removed
            + ")");
  }

  private Object budgetCourse(String column, String quarter, String enrollCode)
      throws SQLException {
    return one(
        "SELECT "
            + column
            + " FROM budget_courses WHERE quarter = '"
            + quarter
            + "' AND enroll_code = '"
            + enrollCode
            + "'");
  }

  @Test
  public void the_rows_are_copied_in_one_per_section_per_quarter_and_the_columns_dropped()
      throws Exception {
    upToTheChangeset();
    long ta = recruitment("20264", "TA", "2026-11-05 03:00:00");
    long ula = recruitment("20264", "ULA", "2026-11-06 03:00:00");
    long nextTa = recruitment("20271", "TA", null);
    // The quarter 20264 already has a budget; 20271 does not.
    sql("INSERT INTO budgets (quarter, unrestricted_budget) VALUES ('20264', 500)");
    // In both recruitments, estimates disagree: the higher is kept.
    course(ta, "07492", 100, 150, 120, false);
    course(ula, "07492", 100, 150, 140, false);
    // In both, only one estimate set: that one is kept.
    course(ta, "07500", 60, 80, null, false);
    course(ula, "07500", 60, 80, 70, false);
    // Only in the TA recruitment.
    course(ta, "07600", 30, 40, 35, false);
    // Removed from TA (with an estimate) but live in ULA (without): the removed row does not count.
    course(ta, "07700", 10, 20, 999, true);
    course(ula, "07700", 10, 20, null, false);
    // Removed from the only recruitment that had it: no row.
    course(ta, "07800", 5, 5, 5, true);
    // Another quarter.
    course(nextTa, "08000", 1, 2, 3, false);

    liquibase.update(1, "");

    assertEquals(5L, ((Number) one("SELECT COUNT(*) FROM budget_courses")).longValue());
    assertEquals(140, budgetCourse("enrollment_estimate", "20264", "07492"));
    assertEquals(70, budgetCourse("enrollment_estimate", "20264", "07500"));
    assertEquals(35, budgetCourse("enrollment_estimate", "20264", "07600"));
    assertNull(budgetCourse("enrollment_estimate", "20264", "07700"));
    assertEquals(3, budgetCourse("enrollment_estimate", "20271", "08000"));
    assertEquals(
        0L,
        ((Number) one("SELECT COUNT(*) FROM budget_courses WHERE enroll_code = '07800'"))
            .longValue());
    assertEquals(100, budgetCourse("enrollment", "20264", "07492"));
    assertEquals(150, budgetCourse("max_enroll", "20264", "07492"));
    assertEquals("CMPSC   156", budgetCourse("course_id", "20264", "07492"));
    assertEquals("0100", budgetCourse("section", "20264", "07492"));
    assertNull(budgetCourse("enrollment_estimate_source", "20264", "07492"));
    // Checked as of the latest Populate of the recruitments that have it; null when never.
    assertEquals(
        LocalDateTime.of(2026, 11, 6, 3, 0),
        ((java.sql.Timestamp) budgetCourse("enrollment_refreshed_at", "20264", "07492"))
            .toLocalDateTime());
    assertEquals(
        LocalDateTime.of(2026, 11, 5, 3, 0),
        ((java.sql.Timestamp) budgetCourse("enrollment_refreshed_at", "20264", "07600"))
            .toLocalDateTime());
    assertNull(budgetCourse("enrollment_refreshed_at", "20271", "08000"));
    // The budget 20264 is as it was; 20271 got one at zero with the default factor.
    assertEquals(2L, ((Number) one("SELECT COUNT(*) FROM budgets")).longValue());
    assertEquals(
        0,
        ((Number) one("SELECT unrestricted_budget FROM budgets WHERE quarter = '20271'"))
            .intValue());
    assertEquals(
        500,
        ((Number) one("SELECT unrestricted_budget FROM budgets WHERE quarter = '20264'"))
            .intValue());
    assertEquals(
        3.0,
        ((Number) one("SELECT conversion_ta_to_ula FROM budgets WHERE quarter = '20271'"))
            .doubleValue());
    // The three columns are gone from recruitment_courses, and the rest is untouched.
    assertThrows(SQLException.class, () -> rows("SELECT enrollment FROM recruitment_courses"));
    assertThrows(SQLException.class, () -> rows("SELECT max_enroll FROM recruitment_courses"));
    assertThrows(
        SQLException.class, () -> rows("SELECT enrollment_estimate FROM recruitment_courses"));
    assertEquals(9L, ((Number) one("SELECT COUNT(*) FROM recruitment_courses")).longValue());
    // Only the lib-jobs changesets after it are left to run.
    assertTrue(
        liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).stream()
            .noneMatch(changeSet -> changeSet.getId().equals(CHANGESET)));
  }

  @Test
  public void the_rollback_brings_the_columns_back_with_the_quarters_values_and_drops_the_table()
      throws Exception {
    upToTheChangeset();
    long ta = recruitment("20264", "TA", null);
    long ula = recruitment("20264", "ULA", null);
    course(ta, "07492", 100, 150, 120, false);
    course(ula, "07492", 100, 150, 140, false);
    course(ta, "07800", 5, 5, 5, true);
    liquibase.update(1, "");

    liquibase.rollback(1, "");

    // Both rows of the shared section now agree on the kept estimate.
    assertEquals(
        List.of(140, 140),
        rows("SELECT enrollment_estimate FROM recruitment_courses WHERE enroll_code = '07492'")
            .stream()
            .map(row -> row[0])
            .toList());
    assertEquals(
        100,
        one(
            "SELECT enrollment FROM recruitment_courses WHERE enroll_code = '07492' AND"
                + " recruitment_id = "
                + ta));
    assertEquals(
        150,
        one(
            "SELECT max_enroll FROM recruitment_courses WHERE enroll_code = '07492' AND"
                + " recruitment_id = "
                + ula));
    // The removed-only section had no quarter row, so it comes back empty.
    assertNull(
        one("SELECT enrollment_estimate FROM recruitment_courses WHERE enroll_code = '07800'"));
    assertThrows(SQLException.class, () -> rows("SELECT COUNT(*) FROM budget_courses"));

    // And it can be applied again after a rollback.
    liquibase.update(1, "");
    assertEquals(140, budgetCourse("enrollment_estimate", "20264", "07492"));
    assertFalse(rows("SELECT id FROM budget_courses").isEmpty());
  }

  @Test
  public void a_new_database_runs_the_whole_changelog() throws Exception {
    liquibase.update("");

    sql(
        "INSERT INTO budgets (quarter) VALUES ('20264');"
            + " INSERT INTO budget_courses (quarter, enroll_code) VALUES ('20264', '07492')");
    assertEquals(1L, ((Number) one("SELECT COUNT(*) FROM budget_courses")).longValue());
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }
}
