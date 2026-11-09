package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
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
 * Changeset 070 (issue #430) run by Liquibase over the schema as it was, the way production will
 * meet it: the versions already saved ask for feedback, later ones do unless they say otherwise,
 * and the rollback drops the column.
 */
public class AskForFeedbackChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET =
      "070-add-ask-for-feedback-to-instructor-feedback-settings";

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

  /** Applies every changeset before 070, then saves a second version as an admin would have. */
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
        "INSERT INTO instructor_feedback_settings (created_at, editor_email, notes_text) VALUES"
            + " (LOCALTIMESTAMP, 'admin@ucsb.edu', 'Edited')");
  }

  @Test
  public void every_existing_version_asks_for_feedback_and_new_ones_do_by_default()
      throws Exception {
    upToTheChangeset();

    liquibase.update(1, "");

    assertEquals(
        2L,
        ((Number)
                one(
                    "SELECT COUNT(*) FROM instructor_feedback_settings"
                        + " WHERE ask_for_feedback = TRUE"))
            .longValue());
    sql(
        "INSERT INTO instructor_feedback_settings (created_at, notes_text) VALUES"
            + " (LOCALTIMESTAMP, 'Default')");
    assertEquals(
        true,
        one(
            "SELECT ask_for_feedback FROM instructor_feedback_settings WHERE notes_text ="
                + " 'Default'"));
    sql(
        "INSERT INTO instructor_feedback_settings (created_at, notes_text, ask_for_feedback)"
            + " VALUES (LOCALTIMESTAMP, 'Off', FALSE)");
    assertEquals(
        false,
        one("SELECT ask_for_feedback FROM instructor_feedback_settings WHERE notes_text = 'Off'"));
    // Required: a version either asks or it does not.
    assertThrows(
        SQLException.class,
        () ->
            sql(
                "INSERT INTO instructor_feedback_settings (created_at, notes_text,"
                    + " ask_for_feedback) VALUES (LOCALTIMESTAMP, 'Null', NULL)"));
    assertTrue(
        liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).stream()
            .noneMatch(changeSet -> changeSet.getId().equals(CHANGESET)));
  }

  @Test
  public void the_rollback_drops_the_column_and_it_can_be_applied_again() throws Exception {
    upToTheChangeset();
    liquibase.update(1, "");

    liquibase.rollback(1, "");

    assertThrows(
        SQLException.class, () -> one("SELECT ask_for_feedback FROM instructor_feedback_settings"));
    assertEquals(
        2L, ((Number) one("SELECT COUNT(*) FROM instructor_feedback_settings")).longValue());
    liquibase.update(1, "");
    assertEquals(
        2L,
        ((Number)
                one(
                    "SELECT COUNT(*) FROM instructor_feedback_settings"
                        + " WHERE ask_for_feedback = TRUE"))
            .longValue());
  }
}
