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
import java.time.LocalDateTime;
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
 * Changeset 072 (issue #465) run by Liquibase over the schema as it was, the way production will
 * meet it: the column is renamed with every recruitment keeping its time, and the rollback gives it
 * its old name back.
 */
public class CourseDataLastUpdatedChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET =
      "072-rename-last-populated-at-to-course-data-last-updated";
  private static final LocalDateTime STAMP = LocalDateTime.of(2026, 11, 19, 0, 0, 5);

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

  private Object one(String query) throws SQLException {
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery(query)) {
      assertTrue(rs.next(), query);
      return rs.getObject(1, LocalDateTime.class);
    }
  }

  /**
   * Applies every changeset before 072, then adds a refreshed and a never-refreshed recruitment.
   */
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
    sql(
        "INSERT INTO recruitments (quarter, type, tentative_opening_date,"
            + " primary_consideration_date, created_at, last_populated_at) VALUES ('20271', 'TA',"
            + " DATE '2026-11-09', DATE '2026-11-20', LOCALTIMESTAMP, TIMESTAMP '2026-11-19"
            + " 00:00:05')");
    sql(
        "INSERT INTO recruitments (quarter, type, tentative_opening_date,"
            + " primary_consideration_date, created_at) VALUES ('20271', 'ULA', DATE '2026-11-09',"
            + " DATE '2026-11-20', LOCALTIMESTAMP)");
  }

  @Test
  public void the_column_is_renamed_and_every_recruitment_keeps_its_time() throws Exception {
    upToTheChangeset();

    liquibase.update(1, "");

    assertEquals(STAMP, one("SELECT course_data_last_updated FROM recruitments WHERE type = 'TA'"));
    assertNull(one("SELECT course_data_last_updated FROM recruitments WHERE type = 'ULA'"));
    assertThrows(SQLException.class, () -> one("SELECT last_populated_at FROM recruitments"));
    assertTrue(
        liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).stream()
            .noneMatch(changeSet -> changeSet.getId().equals(CHANGESET)));
  }

  @Test
  public void the_rollback_restores_the_old_name_and_it_can_be_applied_again() throws Exception {
    upToTheChangeset();
    liquibase.update(1, "");

    liquibase.rollback(1, "");

    assertEquals(STAMP, one("SELECT last_populated_at FROM recruitments WHERE type = 'TA'"));
    assertThrows(
        SQLException.class, () -> one("SELECT course_data_last_updated FROM recruitments"));
    liquibase.update(1, "");
    assertEquals(STAMP, one("SELECT course_data_last_updated FROM recruitments WHERE type = 'TA'"));
  }
}
