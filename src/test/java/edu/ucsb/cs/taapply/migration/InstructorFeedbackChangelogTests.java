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
 * Changeset 068 (issue #425) run by Liquibase over the schema as it was, the way production will
 * meet it: the instructor_feedback table, its defaults, its unique key and its two foreign keys;
 * and its rollback.
 */
public class InstructorFeedbackChangelogTests {

  private static final String CHANGELOG = "db/migration/changelog-master.json";
  private static final String CHANGESET = "068-create-instructor-feedback";

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

  /** Applies every changeset before 068. */
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

  /** A budget for 20264 and one TA recruitment course in it, id returned. */
  private long aCourse() throws SQLException {
    sql("INSERT INTO budgets (quarter) VALUES ('20264')");
    sql(
        "INSERT INTO recruitments (quarter, type, tentative_opening_date,"
            + " primary_consideration_date) VALUES ('20264', 'TA', DATE '2026-09-01', DATE"
            + " '2026-09-15')");
    long recruitmentId = ((Number) one("SELECT id FROM recruitments")).longValue();
    sql(
        "INSERT INTO recruitment_courses (recruitment_id, course_id, enroll_code, section) VALUES"
            + " ("
            + recruitmentId
            + ", 'CMPSC   156', '07492', '0100')");
    return ((Number) one("SELECT id FROM recruitment_courses")).longValue();
  }

  private void feedback(String quarter, String email, long courseId) throws SQLException {
    sql(
        "INSERT INTO instructor_feedback (quarter, email, recruitment_course_id) VALUES ('"
            + quarter
            + "', '"
            + email
            + "', "
            + courseId
            + ")");
  }

  @Test
  public void the_table_is_created_with_its_defaults_and_keys() throws Exception {
    upToTheChangeset();
    long course = aCourse();

    liquibase.update(1, "");

    feedback("20264", "pconrad@ucsb.edu", course);
    for (String column :
        List.of(
            "alloc_reasonable", "different_ta_count", "different_ula_count", "other_concerns")) {
      assertEquals(Boolean.FALSE, one("SELECT " + column + " FROM instructor_feedback"));
    }
    assertEquals(null, one("SELECT num_tas_preferred FROM instructor_feedback"));
    assertEquals(null, one("SELECT num_ulas_preferred FROM instructor_feedback"));
    assertEquals(null, one("SELECT comments FROM instructor_feedback"));
    assertEquals(null, one("SELECT last_updated FROM instructor_feedback"));
    sql("UPDATE instructor_feedback SET comments = '" + "x".repeat(2048) + "'");
    assertThrows(
        SQLException.class,
        () -> sql("UPDATE instructor_feedback SET comments = '" + "x".repeat(2049) + "'"));
    // A co-instructor has a row of their own; the same instructor does not get two.
    feedback("20264", "coteacher@ucsb.edu", course);
    assertThrows(SQLException.class, () -> feedback("20264", "pconrad@ucsb.edu", course));
    // The quarter must be budgeted and the course must exist.
    assertThrows(SQLException.class, () -> feedback("20271", "x@ucsb.edu", course));
    assertThrows(SQLException.class, () -> feedback("20264", "x@ucsb.edu", course + 1000));
    // Deleting the course takes its feedback with it.
    sql("DELETE FROM recruitment_courses WHERE id = " + course);
    assertEquals(0L, ((Number) one("SELECT COUNT(*) FROM instructor_feedback")).longValue());
    assertTrue(
        liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).stream()
            .noneMatch(changeSet -> changeSet.getId().equals(CHANGESET)));
  }

  @Test
  public void the_rollback_drops_the_table_and_it_can_be_applied_again() throws Exception {
    upToTheChangeset();
    long course = aCourse();
    liquibase.update(1, "");
    feedback("20264", "pconrad@ucsb.edu", course);

    liquibase.rollback(1, "");

    assertThrows(SQLException.class, () -> one("SELECT COUNT(*) FROM instructor_feedback"));
    liquibase.update(1, "");
    assertEquals(0L, ((Number) one("SELECT COUNT(*) FROM instructor_feedback")).longValue());
  }

  @Test
  public void deleting_the_budget_takes_its_feedback_with_it() throws Exception {
    liquibase.update("");
    long course = aCourse();
    feedback("20264", "pconrad@ucsb.edu", course);

    sql("DELETE FROM budgets WHERE quarter = '20264'");

    assertEquals(0L, ((Number) one("SELECT COUNT(*) FROM instructor_feedback")).longValue());
    assertEquals(0, liquibase.listUnrunChangeSets(new Contexts(), new LabelExpression()).size());
  }
}
