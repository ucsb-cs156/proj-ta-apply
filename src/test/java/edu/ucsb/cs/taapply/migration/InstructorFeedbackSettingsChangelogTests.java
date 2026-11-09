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
import java.sql.Timestamp;
import java.time.Duration;
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
 * Changeset 069 (issue #429) run by Liquibase over the schema as it was, the way production will
 * meet it: the instructor_feedback_settings table, the first version it inserts (with its ${field}s
 * left alone by Liquibase), and its rollback.
 */
public class InstructorFeedbackSettingsChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET = "069-create-instructor-feedback-settings";

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
      return rs.getObject(1);
    }
  }

  private String text(String query) throws SQLException {
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery(query)) {
      assertTrue(rs.next(), query);
      return rs.getString(1);
    }
  }

  /** Applies every changeset before 069. */
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

  @Test
  public void the_table_is_created_with_the_first_version_in_it() throws Exception {
    upToTheChangeset();
    LocalDateTime before = LocalDateTime.now();

    liquibase.update(1, "");

    assertEquals(
        1L, ((Number) one("SELECT COUNT(*) FROM instructor_feedback_settings")).longValue());
    assertEquals(1L, ((Number) one("SELECT id FROM instructor_feedback_settings")).longValue());
    assertNull(one("SELECT editor_email FROM instructor_feedback_settings"));
    LocalDateTime createdAt =
        ((Timestamp) one("SELECT created_at FROM instructor_feedback_settings")).toLocalDateTime();
    assertTrue(
        Duration.between(before, createdAt).abs().getSeconds() < 60,
        "stamped with the JVM's local time, which the app makes Pacific");
    String notes = text("SELECT notes_text FROM instructor_feedback_settings");
    // Liquibase leaves ${...} it has no parameter for alone, so the fields survive.
    assertTrue(notes.startsWith("Note that the current estimated cost of a TA is"), notes);
    assertTrue(notes.contains("${estimatedCostPerTA}"), notes);
    assertTrue(notes.contains("${estimatedCostPerULA}"), notes);
    assertTrue(notes.contains("${taToUlaCostRatio}.\n\nOn the other hand"), notes);
    assertTrue(notes.endsWith("take your preferences into consideration."), notes);

    // Saves are new rows, numbered after the first; the text may be a million characters.
    sql(
        "INSERT INTO instructor_feedback_settings (created_at, editor_email, notes_text) VALUES"
            + " (LOCALTIMESTAMP, 'admin@ucsb.edu', '"
            + "x".repeat(1_000_000)
            + "')");
    assertEquals(
        2L, ((Number) one("SELECT MAX(id) FROM instructor_feedback_settings")).longValue());
    assertEquals(
        1_000_000L,
        ((Number) one("SELECT LENGTH(notes_text) FROM instructor_feedback_settings WHERE id = 2"))
            .longValue());
    assertThrows(
        SQLException.class,
        () ->
            sql(
                "INSERT INTO instructor_feedback_settings (created_at, notes_text) VALUES"
                    + " (LOCALTIMESTAMP, '"
                    + "x".repeat(1_000_001)
                    + "')"));
    // The time and the text are required.
    assertThrows(
        SQLException.class,
        () -> sql("INSERT INTO instructor_feedback_settings (notes_text) VALUES ('x')"));
    assertThrows(
        SQLException.class,
        () -> sql("INSERT INTO instructor_feedback_settings (created_at) VALUES (LOCALTIMESTAMP)"));
    assertTrue(
        liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).stream()
            .noneMatch(changeSet -> changeSet.getId().equals(CHANGESET)));
  }

  @Test
  public void the_rollback_drops_the_table_and_it_can_be_applied_again() throws Exception {
    upToTheChangeset();
    liquibase.update(1, "");

    liquibase.rollback(1, "");

    assertThrows(
        SQLException.class, () -> one("SELECT COUNT(*) FROM instructor_feedback_settings"));
    liquibase.update(1, "");
    assertEquals(
        1L, ((Number) one("SELECT COUNT(*) FROM instructor_feedback_settings")).longValue());
  }
}
