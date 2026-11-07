package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
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
 * Changeset 064 (issue #366) run by Liquibase itself over the real schema, with rows in it, the way
 * the QA deployments will meet it: a recruitment whose allocation visibility is ALL_COURSES, the
 * value the dialog no longer offers, becomes OWN_COURSES, and the other two values are left alone.
 * It is a one-way change, so rolling it back changes nothing.
 */
public class AllocationVisibilityChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET =
      "064-all-courses-allocation-visibility-becomes-own-courses";

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

  /** Each recruitment's allocation visibility, by quarter. */
  private Map<String, String> visibilities() throws SQLException {
    Map<String, String> result = new TreeMap<>();
    try (Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery("SELECT quarter, allocation_visibility FROM recruitments")) {
      while (rs.next()) {
        result.put(rs.getString(1), rs.getString(2));
      }
    }
    return result;
  }

  /** Applies every changeset before 064, so there is a schema to put rows in. */
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

  private void insertRecruitment(String quarter, String visibility) throws SQLException {
    sql(
        "INSERT INTO recruitments (quarter, type, allocation_visibility) VALUES ('"
            + quarter
            + "', 'TA', '"
            + visibility
            + "')");
  }

  @Test
  public void all_courses_becomes_own_courses_and_the_other_values_are_left_alone()
      throws Exception {
    upToTheChangeset();
    insertRecruitment("20261", "ADMINS_ONLY");
    insertRecruitment("20262", "OWN_COURSES");
    insertRecruitment("20263", "ALL_COURSES");
    insertRecruitment("20264", "ALL_COURSES");

    liquibase.update(1, "");

    assertEquals(
        Map.of(
            "20261", "ADMINS_ONLY",
            "20262", "OWN_COURSES",
            "20263", "OWN_COURSES",
            "20264", "OWN_COURSES"),
        visibilities());
  }

  @Test
  public void it_is_one_way_so_rolling_it_back_changes_nothing() throws Exception {
    upToTheChangeset();
    insertRecruitment("20263", "ALL_COURSES");

    liquibase.update(1, "");
    assertEquals(Map.of("20263", "OWN_COURSES"), visibilities());

    liquibase.rollback(1, "");
    assertEquals(Map.of("20263", "OWN_COURSES"), visibilities());

    // and it can be applied again after the rollback
    liquibase.update(1, "");
    assertEquals(Map.of("20263", "OWN_COURSES"), visibilities());
  }

  @Test
  public void a_database_with_no_recruitments_runs_the_changeset_and_the_rest_of_the_changelog()
      throws Exception {
    upToTheChangeset();
    liquibase.update("");
    assertEquals(Map.of(), visibilities());
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }
}
