package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
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
 * Changeset 067 (issue #388) run by Liquibase over the schema as it was, with rows in it, the way
 * production will meet it: the budget row gets the three new columns, empty, and nothing else
 * changes (the recruitments' stored costs per position are left as they are); and its rollback
 * drops the columns.
 */
public class UlaRateHoursGiftFundsChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET = "067-add-ula-rate-hours-and-gift-funds-to-budgets";

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

  /** Applies every changeset before 067, so there is the old schema to put rows in. */
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

  private void recruitment(String quarter, String type, String avgCost) throws SQLException {
    sql(
        "INSERT INTO recruitments (quarter, type, tentative_opening_date, primary_consideration_date,"
            + " created_at, avg_cost_per_position) VALUES ('"
            + quarter
            + "', '"
            + type
            + "', DATE '2026-09-01', DATE '2026-09-15', TIMESTAMP '2026-08-01 10:00:00', "
            + (avgCost == null ? "NULL" : avgCost)
            + ")");
  }

  private Object cost(String quarter, String type) throws SQLException {
    return one(
        "SELECT avg_cost_per_position FROM recruitments WHERE quarter = '"
            + quarter
            + "' AND type = '"
            + type
            + "'");
  }

  private Object budget(String column) throws SQLException {
    return one("SELECT " + column + " FROM budgets WHERE quarter = '20264'");
  }

  @Test
  public void the_budget_gets_the_three_columns_empty_and_the_rest_is_as_it_was() throws Exception {
    upToTheChangeset();
    sql(
        "INSERT INTO budgets (quarter, unrestricted_budget, tas_only_budget, ulas_only_budget,"
            + " conversion_ta_to_ula, version, conversion_version)"
            + " VALUES ('20264', 699315, 0, 166667, 2.5, 4, 1)");
    recruitment("20264", "TA", "13110.00");
    recruitment("20264", "ULA", "2500.50");
    recruitment("20262", "ULA", "2400.00");
    recruitment("20261", "TA", null);
    // The columns are not there yet.
    assertThrows(SQLException.class, () -> rows("SELECT ula_rate_dollars_per_hour FROM budgets"));

    liquibase.update(1, "");

    assertNull(budget("ula_rate_dollars_per_hour"));
    assertNull(budget("estimated_hours_per_ula_per_quarter"));
    assertNull(budget("gift_funds_for_ases"));
    // The rest of the row is as it was.
    assertEquals(699315, ((Number) budget("unrestricted_budget")).intValue());
    assertEquals(166667, ((Number) budget("ulas_only_budget")).intValue());
    assertEquals(2.5, ((Number) budget("conversion_ta_to_ula")).doubleValue());
    assertEquals(4, ((Number) budget("version")).intValue());
    assertEquals(1, ((Number) budget("conversion_version")).intValue());
    // The recruitments' stored costs are untouched: the one on a ULA recruitment is simply no
    // longer read (the backend computes the cost per ULA from the budget's rate and hours).
    assertEquals(2500.5, ((Number) cost("20264", "ULA")).doubleValue());
    assertEquals(2400, ((Number) cost("20262", "ULA")).intValue());
    assertEquals(13110, ((Number) cost("20264", "TA")).intValue());
    assertNull(cost("20261", "TA"));
    assertEquals(4L, ((Number) one("SELECT COUNT(*) FROM recruitments")).longValue());
    // The columns take dollars and cents.
    sql(
        "UPDATE budgets SET ula_rate_dollars_per_hour = 29.38,"
            + " estimated_hours_per_ula_per_quarter = 110, gift_funds_for_ases = 32200.01"
            + " WHERE quarter = '20264'");
    assertEquals(29.38, ((Number) budget("ula_rate_dollars_per_hour")).doubleValue());
    assertEquals(110, ((Number) budget("estimated_hours_per_ula_per_quarter")).intValue());
    assertEquals(32200.01, ((Number) budget("gift_funds_for_ases")).doubleValue());
    // Only the lib-jobs changesets after it are left to run.
    assertTrue(
        liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).stream()
            .noneMatch(changeSet -> changeSet.getId().equals(CHANGESET)));
  }

  @Test
  public void the_rollback_drops_the_three_columns_and_the_changeset_can_run_again()
      throws Exception {
    upToTheChangeset();
    sql("INSERT INTO budgets (quarter, unrestricted_budget) VALUES ('20264', 500)");
    recruitment("20264", "ULA", "2500.50");
    liquibase.update(1, "");
    sql("UPDATE budgets SET gift_funds_for_ases = 32200 WHERE quarter = '20264'");

    liquibase.rollback(1, "");

    assertThrows(SQLException.class, () -> rows("SELECT ula_rate_dollars_per_hour FROM budgets"));
    assertThrows(
        SQLException.class, () -> rows("SELECT estimated_hours_per_ula_per_quarter FROM budgets"));
    assertThrows(SQLException.class, () -> rows("SELECT gift_funds_for_ases FROM budgets"));
    assertEquals(500, ((Number) budget("unrestricted_budget")).intValue());
    assertEquals(2500.5, ((Number) cost("20264", "ULA")).doubleValue());

    liquibase.update(1, "");
    assertNull(budget("gift_funds_for_ases"));
  }

  @Test
  public void a_new_database_runs_the_whole_changelog() throws Exception {
    liquibase.update("");

    sql(
        "INSERT INTO budgets (quarter, ula_rate_dollars_per_hour,"
            + " estimated_hours_per_ula_per_quarter, gift_funds_for_ases)"
            + " VALUES ('20264', 29.38, 110, 32200)");
    assertEquals(29.38, ((Number) budget("ula_rate_dollars_per_hour")).doubleValue());
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }
}
