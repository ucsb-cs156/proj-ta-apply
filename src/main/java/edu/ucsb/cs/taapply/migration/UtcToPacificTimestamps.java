package edu.ucsb.cs.taapply.migration;

import edu.ucsb.cs.taapply.time.AppTime;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Types;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import liquibase.change.custom.CustomTaskChange;
import liquibase.change.custom.CustomTaskRollback;
import liquibase.database.Database;
import liquibase.database.jvm.JdbcConnection;
import liquibase.exception.CustomChangeException;
import liquibase.exception.RollbackImpossibleException;
import liquibase.exception.SetupException;
import liquibase.exception.ValidationErrors;
import liquibase.resource.ResourceAccessor;

/**
 * The one-time conversion of issue #293: every zone-less {@code TIMESTAMP} column the app wrote
 * with {@code LocalDateTime.now()} or a Hibernate timestamp generator while the server ran in UTC
 * holds UTC wall-clock time; this rewrites each value as the Pacific wall-clock time of the same
 * instant. From then on the app writes Pacific wall-clock time ({@link AppTime}), so the column
 * means one thing throughout.
 *
 * <p>Rolling the change back converts every value from Pacific back to UTC. The forward direction
 * loses nothing. The backward direction cannot tell the two passes through the hour that repeats
 * when clocks fall back each November (1:00 to 1:59 a.m. occurs twice); it takes the first, so a
 * value stamped in the second pass comes back an hour early. A value in the hour skipped when
 * clocks spring forward cannot occur.
 *
 * <p>The columns that hold an exact instant ({@code users.last_online}, a {@code TIMESTAMP WITH
 * TIME ZONE}) and the quarter calendar copied from the UCSB API (already Pacific) are left alone.
 * Tables or columns that do not exist yet (a fresh database, or the lib-jobs tables that a later
 * changelog creates) are skipped.
 */
public class UtcToPacificTimestamps implements CustomTaskChange, CustomTaskRollback {

  /** Each table with the timestamp columns to convert; every table has a numeric {@code id}. */
  static final Map<String, List<String>> COLUMNS = columns();

  private static Map<String, List<String>> columns() {
    Map<String, List<String>> map = new LinkedHashMap<>();
    map.put("applications", List.of("submitted_at", "cancelled_at"));
    map.put("audit_trail", List.of("edited_at"));
    map.put("recruitment_audit_trail", List.of("changed_at"));
    map.put("notice_versions", List.of("created_at"));
    map.put(
        "recruitments",
        List.of(
            "last_populated_at",
            "created_at",
            "allocations_released_at",
            "faculty_review_closed_at",
            "assignments_published_at"));
    map.put("draft_applications", List.of("updated_at"));
    map.put("jobs", List.of("created_at", "updated_at"));
    map.put("job_logs", List.of("created_at"));
    return map;
  }

  /** The same wall-clock reading in another zone: the instant is kept, the clock face changes. */
  static LocalDateTime shift(LocalDateTime value, ZoneId from, ZoneId to) {
    return value.atZone(from).withZoneSameInstant(to).toLocalDateTime();
  }

  @Override
  public void execute(Database database) throws CustomChangeException {
    convert(database, ZoneOffset.UTC, AppTime.ZONE);
  }

  @Override
  public void rollback(Database database)
      throws CustomChangeException, RollbackImpossibleException {
    convert(database, AppTime.ZONE, ZoneOffset.UTC);
  }

  private void convert(Database database, ZoneId from, ZoneId to) throws CustomChangeException {
    try {
      Connection connection = ((JdbcConnection) database.getConnection()).getUnderlyingConnection();
      convert(connection, from, to);
    } catch (SQLException e) {
      throw new CustomChangeException("Could not convert timestamps: " + e.getMessage(), e);
    }
  }

  /** Converts every listed column of every listed table that exists, by id, in one pass each. */
  static int convert(Connection connection, ZoneId from, ZoneId to) throws SQLException {
    int changed = 0;
    for (Map.Entry<String, List<String>> entry : COLUMNS.entrySet()) {
      String table = actualName(connection, entry.getKey(), null);
      if (table == null) {
        continue;
      }
      String id = actualName(connection, "id", table);
      List<String> present = new ArrayList<>();
      for (String column : entry.getValue()) {
        String actual = actualName(connection, column, table);
        if (actual != null) {
          present.add(actual);
        }
      }
      if (id != null && !present.isEmpty()) {
        changed += convertTable(connection, table, id, present, from, to);
      }
    }
    return changed;
  }

  private static int convertTable(
      Connection connection, String table, String id, List<String> columns, ZoneId from, ZoneId to)
      throws SQLException {
    String quote = connection.getMetaData().getIdentifierQuoteString().trim();
    List<String> quoted = new ArrayList<>();
    for (String column : columns) {
      quoted.add(quote + column + quote);
    }
    String select =
        "SELECT "
            + quote
            + id
            + quote
            + ", "
            + String.join(", ", quoted)
            + " FROM "
            + quote
            + table
            + quote;
    String assignments = String.join(" = ?, ", quoted) + " = ?";
    String update =
        "UPDATE "
            + quote
            + table
            + quote
            + " SET "
            + assignments
            + " WHERE "
            + quote
            + id
            + quote
            + " = ?";

    int rows = 0;
    try (Statement statement = connection.createStatement();
        ResultSet results = statement.executeQuery(select);
        PreparedStatement updater = connection.prepareStatement(update)) {
      while (results.next()) {
        long key = results.getLong(1);
        for (int i = 0; i < columns.size(); i++) {
          LocalDateTime value = results.getObject(i + 2, LocalDateTime.class);
          if (value == null) {
            updater.setNull(i + 1, Types.TIMESTAMP);
          } else {
            updater.setObject(i + 1, shift(value, from, to));
          }
        }
        updater.setLong(columns.size() + 1, key);
        updater.addBatch();
        rows++;
      }
      updater.executeBatch();
    }
    return rows;
  }

  /**
   * The name a table (or one of its columns) really has in the database, whatever its case, or null
   * when there is none.
   */
  private static String actualName(Connection connection, String name, String table)
      throws SQLException {
    String label = table == null ? "TABLE_NAME" : "COLUMN_NAME";
    for (String candidate : List.of(name, name.toUpperCase(), name.toLowerCase())) {
      List<String> found = new ArrayList<>();
      try (ResultSet rows = lookup(connection, candidate, table)) {
        while (rows.next()) {
          found.add(rows.getString(label));
        }
      }
      for (String actual : found) {
        if (actual.equalsIgnoreCase(name)) {
          return actual;
        }
      }
    }
    return null;
  }

  /** The metadata rows for a table (when {@code table} is null) or for a column of that table. */
  private static ResultSet lookup(Connection connection, String candidate, String table)
      throws SQLException {
    DatabaseMetaData meta = connection.getMetaData();
    return table == null
        ? meta.getTables(null, connection.getSchema(), candidate, null)
        : meta.getColumns(null, connection.getSchema(), table, candidate);
  }

  @Override
  public String getConfirmationMessage() {
    return "Converted the stored date-times between UTC and Pacific time";
  }

  @Override
  public void setUp() throws SetupException {}

  @Override
  public void setFileOpener(ResourceAccessor resourceAccessor) {}

  @Override
  public ValidationErrors validate(Database database) {
    return new ValidationErrors();
  }
}
