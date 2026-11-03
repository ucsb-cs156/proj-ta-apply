package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
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
 * Changeset 050 run by Liquibase itself over the real schema, with rows in it, the way production
 * will meet it: forward converts UTC to Pacific, rollback converts back, and a fresh database (no
 * rows, and no lib-jobs tables yet) is untouched.
 */
public class PacificTimestampsChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CONVERSION = "050-convert-timestamps-from-utc-to-pacific";

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

  private LocalDateTime stamp(String table, String column) throws SQLException {
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT " + column + " FROM " + table)) {
      assertTrue(rs.next());
      return rs.getObject(1, LocalDateTime.class);
    }
  }

  /** Applies every changeset before 050, so there is a schema to put rows in. */
  private void upToTheConversion() throws Exception {
    List<ChangeSet> unrun = liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression());
    int at = -1;
    for (int i = 0; i < unrun.size(); i++) {
      if (unrun.get(i).getId().equals(CONVERSION)) {
        at = i;
      }
    }
    assertTrue(at > 0, "the conversion changeset is in the changelog");
    liquibase.update(at, "");
  }

  @Test
  public void production_rows_are_converted_forward_and_back_by_the_changeset() throws Exception {
    upToTheConversion();
    sql(
        "INSERT INTO notice_versions (type, content, created_at) "
            + "VALUES ('TA', 'text', TIMESTAMP '2026-07-01 07:00:00')");
    sql(
        "INSERT INTO recruitments (quarter, type, tentative_opening_date, primary_consideration_date, created_at, last_populated_at) "
            + "VALUES ('20264', 'TA', DATE '2026-11-09', DATE '2026-11-20', TIMESTAMP '2026-11-02 03:30:00', TIMESTAMP '2027-01-01 07:59:59')");
    sql(
        "INSERT INTO users (email, last_online) VALUES ('a@ucsb.edu', TIMESTAMP WITH TIME ZONE '2026-07-01 07:00:00+00')");

    liquibase.update(1, "");

    assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), stamp("notice_versions", "created_at"));
    assertEquals(LocalDateTime.of(2026, 11, 1, 19, 30), stamp("recruitments", "created_at"));
    assertEquals(
        LocalDateTime.of(2026, 12, 31, 23, 59, 59), stamp("recruitments", "last_populated_at"));
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT last_online FROM users")) {
      assertTrue(rs.next());
      assertEquals(
          Instant.parse("2026-07-01T07:00:00Z"), rs.getObject(1, OffsetDateTime.class).toInstant());
    }

    liquibase.rollback(1, "");

    assertEquals(LocalDateTime.of(2026, 7, 1, 7, 0), stamp("notice_versions", "created_at"));
    assertEquals(LocalDateTime.of(2026, 11, 2, 3, 30), stamp("recruitments", "created_at"));
    assertEquals(
        LocalDateTime.of(2027, 1, 1, 7, 59, 59), stamp("recruitments", "last_populated_at"));

    // and it can be applied again after a rollback
    liquibase.update(1, "");
    assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), stamp("notice_versions", "created_at"));
  }

  @Test
  public void a_new_database_runs_the_whole_changelog_including_the_jobs_tables_after_it()
      throws Exception {
    liquibase.update("");

    sql("INSERT INTO jobs (id, status) VALUES (1, 'complete')");
    sql("SELECT created_at FROM jobs");
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }
}
