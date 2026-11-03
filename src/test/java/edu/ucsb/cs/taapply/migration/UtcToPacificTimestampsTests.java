package edu.ucsb.cs.taapply.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.time.AppTime;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * The one-time UTC to Pacific conversion of issue #293, on a bare H2 database: values near midnight
 * and around both daylight saving changes, nulls, tables and columns that are missing, and a JVM
 * whose own zone is not Pacific.
 */
public class UtcToPacificTimestampsTests {

  private static final ZoneId UTC = ZoneOffset.UTC;

  private Connection connection;
  private TimeZone original;

  @BeforeEach
  public void open() throws SQLException {
    original = TimeZone.getDefault();
    connection =
        DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
  }

  @AfterEach
  public void close() throws SQLException {
    TimeZone.setDefault(original);
    connection.close();
  }

  private void sql(String text) throws SQLException {
    try (Statement statement = connection.createStatement()) {
      statement.execute(text);
    }
  }

  private static LocalDateTime t(String text) {
    return LocalDateTime.parse(text);
  }

  private LocalDateTime read(String table, String column, long id) throws SQLException {
    try (Statement statement = connection.createStatement();
        ResultSet rs =
            statement.executeQuery("SELECT " + column + " FROM " + table + " WHERE id = " + id)) {
      assertTrue(rs.next());
      return rs.getObject(1, LocalDateTime.class);
    }
  }

  /** Each case is a UTC reading and the Pacific reading of the same instant. */
  private static final String[][] CASES = {
    // an ordinary winter and summer afternoon
    {"2026-01-15T20:30:00", "2026-01-15T12:30:00"},
    {"2026-07-15T20:30:00", "2026-07-15T13:30:00"},
    // just either side of Pacific midnight, in summer (UTC-7) and winter (UTC-8)
    {"2026-07-01T06:59:59", "2026-06-30T23:59:59"},
    {"2026-07-01T07:00:00", "2026-07-01T00:00:00"},
    {"2027-01-01T07:59:59", "2026-12-31T23:59:59"},
    {"2027-01-01T08:00:00", "2027-01-01T00:00:00"},
    // spring forward, 2026-03-08: 2:00 a.m. PST becomes 3:00 a.m. PDT
    {"2026-03-08T09:59:59", "2026-03-08T01:59:59"},
    {"2026-03-08T10:00:00", "2026-03-08T03:00:00"},
    // fall back, 2026-11-01: 2:00 a.m. PDT becomes 1:00 a.m. PST; 1:00 to 1:59 happens twice
    {"2026-11-01T07:59:59", "2026-11-01T00:59:59"},
    {"2026-11-01T08:00:00", "2026-11-01T01:00:00"},
    {"2026-11-01T09:59:59", "2026-11-01T01:59:59"},
    {"2026-11-01T10:00:00", "2026-11-01T02:00:00"},
    // the stamp of a row written at the moment this work began, to the second
    {"2026-11-02T18:45:07", "2026-11-02T10:45:07"},
  };

  private void tableWithEveryColumn(String table, String... columns) throws SQLException {
    StringBuilder text = new StringBuilder("CREATE TABLE " + table + " (id BIGINT PRIMARY KEY");
    for (String column : columns) {
      text.append(", ").append(column).append(" TIMESTAMP");
    }
    sql(text.append(")").toString());
  }

  @Test
  public void every_listed_table_and_column_is_converted_and_nothing_else() throws Exception {
    for (var entry : UtcToPacificTimestamps.COLUMNS.entrySet()) {
      tableWithEveryColumn(entry.getKey(), entry.getValue().toArray(String[]::new));
    }
    sql("CREATE TABLE users (id BIGINT PRIMARY KEY, last_online TIMESTAMP WITH TIME ZONE)");
    sql("CREATE TABLE ucsbapiquarter (id BIGINT PRIMARY KEY, pass1begin TIMESTAMP)");
    sql("INSERT INTO users VALUES (1, TIMESTAMP WITH TIME ZONE '2026-07-15 20:30:00+00')");
    sql("INSERT INTO ucsbapiquarter VALUES (1, TIMESTAMP '2026-04-08 09:00:00')");
    int expectedRows = 0;
    for (var entry : UtcToPacificTimestamps.COLUMNS.entrySet()) {
      for (int i = 0; i < CASES.length; i++) {
        StringBuilder values = new StringBuilder(i + ", ");
        List<String> each = new ArrayList<>();
        for (int c = 0; c < entry.getValue().size(); c++) {
          each.add("TIMESTAMP '" + CASES[i][0].replace('T', ' ') + "'");
        }
        values.append(String.join(", ", each));
        sql("INSERT INTO " + entry.getKey() + " VALUES (" + values + ")");
      }
      expectedRows += CASES.length;
    }

    assertEquals(expectedRows, UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE));

    for (var entry : UtcToPacificTimestamps.COLUMNS.entrySet()) {
      for (String column : entry.getValue()) {
        for (int i = 0; i < CASES.length; i++) {
          assertEquals(
              t(CASES[i][1]),
              read(entry.getKey(), column, i),
              entry.getKey() + "." + column + " of " + CASES[i][0]);
        }
      }
    }
    // the instant column and the UCSB calendar are as they were
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT pass1begin FROM ucsbapiquarter")) {
      assertTrue(rs.next());
      assertEquals(t("2026-04-08T09:00:00"), rs.getObject(1, LocalDateTime.class));
    }
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT last_online FROM users")) {
      assertTrue(rs.next());
      assertEquals(
          java.time.Instant.parse("2026-07-15T20:30:00Z"),
          rs.getObject(1, java.time.OffsetDateTime.class).toInstant());
    }
  }

  @Test
  public void converting_back_restores_everything_but_the_second_pass_through_the_repeated_hour()
      throws Exception {
    tableWithEveryColumn("notice_versions", "created_at");
    for (int i = 0; i < CASES.length; i++) {
      sql(
          "INSERT INTO notice_versions VALUES ("
              + i
              + ", TIMESTAMP '"
              + CASES[i][0].replace('T', ' ')
              + "')");
    }

    UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE);
    UtcToPacificTimestamps.convert(connection, AppTime.ZONE, UTC);

    for (int i = 0; i < CASES.length; i++) {
      LocalDateTime original = t(CASES[i][0]);
      LocalDateTime expected = original;
      // 09:00:00 to 09:59:59 UTC on 2026-11-01 is 1:00 to 1:59 PST, the second pass through the
      // hour, which reads the same as the first (08:00 to 08:59 UTC) and so comes back an hour
      // early
      if (!original.isBefore(t("2026-11-01T09:00:00"))
          && original.isBefore(t("2026-11-01T10:00"))) {
        expected = original.minusHours(1);
      }
      assertEquals(expected, read("notice_versions", "created_at", i), "round trip of " + original);
    }
  }

  @Test
  public void nulls_stay_null_and_rows_are_matched_by_id() throws Exception {
    tableWithEveryColumn("applications", "submitted_at", "cancelled_at");
    sql("INSERT INTO applications VALUES (5, TIMESTAMP '2026-07-15 20:30:00', NULL)");
    sql("INSERT INTO applications VALUES (6, NULL, TIMESTAMP '2026-01-15 20:30:00')");
    sql("INSERT INTO applications VALUES (7, NULL, NULL)");

    assertEquals(3, UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE));

    assertEquals(t("2026-07-15T13:30:00"), read("applications", "submitted_at", 5));
    assertNull(read("applications", "cancelled_at", 5));
    assertNull(read("applications", "submitted_at", 6));
    assertEquals(t("2026-01-15T12:30:00"), read("applications", "cancelled_at", 6));
    assertNull(read("applications", "submitted_at", 7));
    assertNull(read("applications", "cancelled_at", 7));
  }

  @Test
  public void tables_columns_and_ids_that_are_missing_are_skipped() throws Exception {
    // no jobs tables at all (a fresh database); applications lacks cancelled_at; audit_trail has
    // no id column
    tableWithEveryColumn("applications", "submitted_at");
    sql("INSERT INTO applications VALUES (1, TIMESTAMP '2026-07-15 20:30:00')");
    sql("CREATE TABLE audit_trail (edited_at TIMESTAMP)");
    sql("INSERT INTO audit_trail VALUES (TIMESTAMP '2026-07-15 20:30:00')");
    sql("CREATE TABLE notice_versions (id BIGINT PRIMARY KEY, other TIMESTAMP)");
    sql("INSERT INTO notice_versions VALUES (1, TIMESTAMP '2026-07-15 20:30:00')");

    assertEquals(1, UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE));

    assertEquals(t("2026-07-15T13:30:00"), read("applications", "submitted_at", 1));
    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT edited_at FROM audit_trail")) {
      assertTrue(rs.next());
      assertEquals(t("2026-07-15T20:30:00"), rs.getObject(1, LocalDateTime.class));
    }
    assertEquals(t("2026-07-15T20:30:00"), read("notice_versions", "other", 1));
  }

  /** In a metadata pattern an underscore matches any character; such a near miss is not a match. */
  @Test
  public void a_name_that_only_matches_the_metadata_pattern_is_not_the_table() throws Exception {
    sql("CREATE TABLE jobXlogs (id BIGINT PRIMARY KEY, created_at TIMESTAMP)");
    sql("INSERT INTO jobXlogs VALUES (1, TIMESTAMP '2026-07-15 20:30:00')");
    sql("CREATE TABLE notice_versions (id BIGINT PRIMARY KEY, createdXat TIMESTAMP)");
    sql("INSERT INTO notice_versions VALUES (1, TIMESTAMP '2026-07-15 20:30:00')");

    assertEquals(0, UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE));

    assertEquals(t("2026-07-15T20:30:00"), read("jobXlogs", "created_at", 1));
    assertEquals(t("2026-07-15T20:30:00"), read("notice_versions", "createdXat", 1));
  }

  @Test
  public void an_empty_database_converts_nothing() throws Exception {
    assertEquals(0, UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE));
  }

  @Test
  public void quoted_lower_case_names_are_found_too() throws Exception {
    sql("CREATE TABLE \"jobs\" (\"id\" BIGINT PRIMARY KEY, \"created_at\" TIMESTAMP)");
    sql("INSERT INTO \"jobs\" VALUES (1, TIMESTAMP '2026-07-15 20:30:00')");

    assertEquals(1, UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE));

    try (Statement statement = connection.createStatement();
        ResultSet rs = statement.executeQuery("SELECT \"created_at\" FROM \"jobs\"")) {
      assertTrue(rs.next());
      assertEquals(t("2026-07-15T13:30:00"), rs.getObject(1, LocalDateTime.class));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"UTC", "Asia/Tokyo", "America/New_York", "America/Los_Angeles"})
  public void the_jvms_own_zone_makes_no_difference(String zone) throws Exception {
    TimeZone.setDefault(TimeZone.getTimeZone(zone));
    tableWithEveryColumn("recruitments", "created_at");
    for (int i = 0; i < CASES.length; i++) {
      sql(
          "INSERT INTO recruitments VALUES ("
              + i
              + ", TIMESTAMP '"
              + CASES[i][0].replace('T', ' ')
              + "')");
    }

    UtcToPacificTimestamps.convert(connection, UTC, AppTime.ZONE);

    for (int i = 0; i < CASES.length; i++) {
      assertEquals(t(CASES[i][1]), read("recruitments", "created_at", i), CASES[i][0]);
    }
  }

  @Test
  public void shift_keeps_the_instant_and_changes_the_clock_face() {
    assertEquals(
        t("2026-07-01T00:00:00"),
        UtcToPacificTimestamps.shift(t("2026-07-01T07:00:00"), UTC, AppTime.ZONE));
    assertEquals(
        t("2026-07-01T07:00:00"),
        UtcToPacificTimestamps.shift(t("2026-07-01T00:00:00"), AppTime.ZONE, UTC));
    // the repeated hour: the first pass wins going back
    assertEquals(
        t("2026-11-01T08:30:00"),
        UtcToPacificTimestamps.shift(t("2026-11-01T01:30:00"), AppTime.ZONE, UTC));
  }

  // ---- through Liquibase, as the application runs it ---------------------------------------

  @Test
  public void execute_and_rollback_convert_through_the_liquibase_database() throws Exception {
    tableWithEveryColumn("notice_versions", "created_at");
    sql("INSERT INTO notice_versions VALUES (1, TIMESTAMP '2026-07-01 07:00:00')");
    Database database =
        DatabaseFactory.getInstance()
            .findCorrectDatabaseImplementation(new JdbcConnection(connection));
    UtcToPacificTimestamps change = new UtcToPacificTimestamps();

    change.execute(database);
    assertEquals(t("2026-07-01T00:00:00"), read("notice_versions", "created_at", 1));
    change.rollback(database);
    assertEquals(t("2026-07-01T07:00:00"), read("notice_versions", "created_at", 1));
  }

  @Test
  public void a_database_error_is_reported_as_a_failed_change() throws Exception {
    tableWithEveryColumn("notice_versions", "created_at");
    sql("INSERT INTO notice_versions VALUES (1, TIMESTAMP '2026-07-01 07:00:00')");
    Database database =
        DatabaseFactory.getInstance()
            .findCorrectDatabaseImplementation(new JdbcConnection(connection));
    connection.close();

    CustomChangeException e =
        assertThrows(
            CustomChangeException.class, () -> new UtcToPacificTimestamps().execute(database));
    assertTrue(e.getMessage().startsWith("Could not convert timestamps: "), e.getMessage());
  }

  @Test
  public void the_boilerplate_of_a_liquibase_custom_change() {
    UtcToPacificTimestamps change = new UtcToPacificTimestamps();
    assertNotNull(change.getConfirmationMessage());
    assertTrue(change.getConfirmationMessage().contains("UTC"));
    assertTrue(change.getConfirmationMessage().contains("Pacific"));
    assertTrue(change.validate(null).getErrorMessages().isEmpty());
    assertEquals(0, change.validate(null).getWarningMessages().size());
    // these are required by the interface and have nothing to do
    org.junit.jupiter.api.Assertions.assertDoesNotThrow(change::setUp);
    org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> change.setFileOpener(null));
  }
}
