package edu.ucsb.cs.taapply.time;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ServiceLoader;
import java.util.TimeZone;
import java.util.UUID;
import org.h2.util.DateTimeUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;

/**
 * Issue #523: the test JVM, and H2 inside it, run in the app's zone from the first test, whichever
 * test that is.
 */
public class AppTimeTestSessionTests {

  private static final LocalDateTime MIDNIGHT = LocalDateTime.of(2020, 1, 1, 0, 0);

  private TimeZone original;

  @BeforeEach
  public void remember_the_default_zone() {
    original = TimeZone.getDefault();
  }

  @AfterEach
  public void put_the_jvm_and_h2_back() {
    TimeZone.setDefault(original);
    AppTimeTestSession.install();
  }

  /**
   * What a plain-JDBC test running first used to do: H2 settles on the zone surefire gave the JVM.
   */
  private static void letH2SettleOn(String zone) {
    TimeZone.setDefault(TimeZone.getTimeZone(zone));
    DateTimeUtils.resetCalendar();
    DateTimeUtils.getTimeZone();
  }

  /** A TIMESTAMP literal read back the way Hibernate reads one, through java.sql.Timestamp. */
  private static LocalDateTime midnightReadBackThroughH2() throws Exception {
    try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID());
        Statement statement = connection.createStatement()) {
      statement.execute("CREATE TABLE stamps (at TIMESTAMP)");
      statement.execute("INSERT INTO stamps VALUES (TIMESTAMP '2020-01-01 00:00:00')");
      try (ResultSet rows = statement.executeQuery("SELECT at FROM stamps")) {
        assertTrue(rows.next());
        return rows.getTimestamp(1).toLocalDateTime();
      }
    }
  }

  @Test
  public void the_listener_is_registered_with_junit() {
    assertTrue(
        ServiceLoader.load(LauncherSessionListener.class).stream()
            .anyMatch(provider -> provider.type() == AppTimeTestSession.class));
  }

  @Test
  public void opening_the_session_puts_the_jvm_and_h2_in_the_apps_zone() {
    letH2SettleOn("UTC");

    new AppTimeTestSession().launcherSessionOpened(mock(LauncherSession.class));

    assertEquals(AppTime.zone().getId(), TimeZone.getDefault().getID());
    assertEquals(AppTime.zone().getId(), DateTimeUtils.getTimeZone().getId());
  }

  @Test
  public void h2_in_one_zone_and_the_jvm_in_another_is_the_shift_this_prevents() throws Exception {
    letH2SettleOn("UTC");
    AppTime.installAsDefaultTimeZone();

    assertEquals(MIDNIGHT.minusHours(8), midnightReadBackThroughH2());
  }

  @Test
  public void after_install_a_timestamp_reads_back_unshifted_whatever_touched_h2_first()
      throws Exception {
    letH2SettleOn("UTC");

    AppTimeTestSession.install();

    assertEquals(MIDNIGHT, midnightReadBackThroughH2());
  }

  @Test
  public void a_test_that_moves_the_jvm_zone_afterwards_does_not_move_h2() {
    AppTimeTestSession.install();

    TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));

    assertEquals(AppTime.zone().getId(), DateTimeUtils.getTimeZone().getId());
  }
}
