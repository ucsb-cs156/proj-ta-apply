package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
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
 * Changesets 065 and 066 (issue #337) run by Liquibase itself over the real schema, with rows in
 * it, the way production will meet them: each adds a nullable {@code editor_email} column to one of
 * the two audit trail tables, the rows already there keep every value they had and get a null
 * editor, and a new row may carry an email. Rolling either back drops the column again.
 */
public class EditorEmailChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String AUDIT_TRAIL = "065-add-editor-email-to-audit-trail";
  private static final String RECRUITMENT_AUDIT_TRAIL =
      "066-add-editor-email-to-recruitment-audit-trail";

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

  private boolean hasColumn(String table, String column) throws SQLException {
    try (ResultSet rs =
        connection.getMetaData().getColumns(null, null, table.toUpperCase(), null)) {
      while (rs.next()) {
        if (column.equalsIgnoreCase(rs.getString("COLUMN_NAME"))) {
          return true;
        }
      }
    }
    return false;
  }

  /** Applies every changeset before the given one, so there is a schema to put rows in. */
  private void upTo(String changeset) throws Exception {
    List<ChangeSet> unrun = liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression());
    int at = -1;
    for (int i = 0; i < unrun.size(); i++) {
      if (unrun.get(i).getId().equals(changeset)) {
        at = i;
      }
    }
    assertTrue(at > 0, "the changeset is in the changelog");
    liquibase.update(at, "");
  }

  /** The next unrun changeset, which the tests expect to be the one under test. */
  private String nextChangeset() throws Exception {
    return liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).get(0).getId();
  }

  // ---- 065: audit_trail ----

  @Test
  public void audit_trail_rows_written_before_the_column_keep_their_values_and_get_a_null_editor()
      throws Exception {
    upTo(AUDIT_TRAIL);
    assertEquals(AUDIT_TRAIL, nextChangeset());
    assertFalse(hasColumn("audit_trail", "editor_email"));
    sql(
        "INSERT INTO audit_trail (ta_application_id, field_name, old_value, new_value)"
            + " VALUES (7, 'major', 'CS', 'CE')");

    liquibase.update(1, "");

    assertTrue(hasColumn("audit_trail", "editor_email"));
    try (Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery(
                "SELECT ta_application_id, field_name, old_value, new_value, editor_email"
                    + " FROM audit_trail")) {
      assertTrue(rs.next());
      assertEquals(7L, rs.getLong(1));
      assertEquals("major", rs.getString(2));
      assertEquals("CS", rs.getString(3));
      assertEquals("CE", rs.getString(4));
      assertNull(rs.getString(5));
      assertFalse(rs.next());
    }

    // A row written from now on may name its editor, and the one from before still may not.
    sql(
        "INSERT INTO audit_trail (ta_application_id, field_name, new_value, editor_email)"
            + " VALUES (8, 'major', 'CE', 'admin@ucsb.edu')");
    try (Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery(
                "SELECT editor_email FROM audit_trail ORDER BY ta_application_id")) {
      assertTrue(rs.next());
      assertNull(rs.getString(1));
      assertTrue(rs.next());
      assertEquals("admin@ucsb.edu", rs.getString(1));
    }
  }

  @Test
  public void audit_trail_rollback_drops_the_column_and_keeps_the_rows() throws Exception {
    upTo(AUDIT_TRAIL);
    sql("INSERT INTO audit_trail (ta_application_id, field_name) VALUES (7, 'major')");

    liquibase.update(1, "");
    assertTrue(hasColumn("audit_trail", "editor_email"));

    liquibase.rollback(1, "");
    assertFalse(hasColumn("audit_trail", "editor_email"));
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM audit_trail")) {
      assertTrue(rs.next());
      assertEquals(1, rs.getInt(1));
    }

    // and it can be applied again after the rollback
    liquibase.update(1, "");
    assertTrue(hasColumn("audit_trail", "editor_email"));
  }

  // ---- 066: recruitment_audit_trail ----

  @Test
  public void recruitment_audit_trail_rows_written_before_the_column_get_a_null_editor()
      throws Exception {
    upTo(RECRUITMENT_AUDIT_TRAIL);
    assertEquals(RECRUITMENT_AUDIT_TRAIL, nextChangeset());
    assertFalse(hasColumn("recruitment_audit_trail", "editor_email"));
    sql(
        "INSERT INTO recruitment_audit_trail (recruitment_id, what_changed, old_value, new_value)"
            + " VALUES (1, 'applicationStatus', 'CLOSED', 'OPEN')");

    liquibase.update(1, "");

    assertTrue(hasColumn("recruitment_audit_trail", "editor_email"));
    try (Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery(
                "SELECT recruitment_id, what_changed, old_value, new_value, editor_email"
                    + " FROM recruitment_audit_trail")) {
      assertTrue(rs.next());
      assertEquals(1L, rs.getLong(1));
      assertEquals("applicationStatus", rs.getString(2));
      assertEquals("CLOSED", rs.getString(3));
      assertEquals("OPEN", rs.getString(4));
      assertNull(rs.getString(5));
      assertFalse(rs.next());
    }

    sql(
        "INSERT INTO recruitment_audit_trail (recruitment_id, what_changed, editor_email)"
            + " VALUES (2, 'created', 'admin@ucsb.edu')");
    try (Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery(
                "SELECT editor_email FROM recruitment_audit_trail ORDER BY recruitment_id")) {
      assertTrue(rs.next());
      assertNull(rs.getString(1));
      assertTrue(rs.next());
      assertEquals("admin@ucsb.edu", rs.getString(1));
    }
  }

  @Test
  public void recruitment_audit_trail_rollback_drops_the_column_and_keeps_the_rows()
      throws Exception {
    upTo(RECRUITMENT_AUDIT_TRAIL);
    sql("INSERT INTO recruitment_audit_trail (recruitment_id, what_changed) VALUES (1, 'created')");

    liquibase.update(1, "");
    assertTrue(hasColumn("recruitment_audit_trail", "editor_email"));

    liquibase.rollback(1, "");
    assertFalse(hasColumn("recruitment_audit_trail", "editor_email"));
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM recruitment_audit_trail")) {
      assertTrue(rs.next());
      assertEquals(1, rs.getInt(1));
    }

    liquibase.update(1, "");
    assertTrue(hasColumn("recruitment_audit_trail", "editor_email"));
  }

  // ---- both, on a fresh database ----

  /** A fresh database gets both columns, and nothing is left unrun after them. */
  @Test
  public void a_fresh_database_runs_both_changesets_and_the_rest_of_the_changelog()
      throws Exception {
    liquibase.update("");

    assertTrue(hasColumn("audit_trail", "editor_email"));
    assertTrue(hasColumn("recruitment_audit_trail", "editor_email"));
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }

  /**
   * The preconditions: a database that already has the column (one Hibernate once built, say) marks
   * the changeset ran rather than failing on a duplicate column.
   */
  @Test
  public void a_database_that_already_has_the_columns_marks_the_changesets_ran() throws Exception {
    upTo(AUDIT_TRAIL);
    sql("ALTER TABLE audit_trail ADD COLUMN editor_email VARCHAR(255)");
    sql("ALTER TABLE recruitment_audit_trail ADD COLUMN editor_email VARCHAR(255)");

    liquibase.update("");

    assertTrue(hasColumn("audit_trail", "editor_email"));
    assertTrue(hasColumn("recruitment_audit_trail", "editor_email"));
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }
}
