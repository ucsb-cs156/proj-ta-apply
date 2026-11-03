package edu.ucsb.cs.taapply.time;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.TimeZone;

/**
 * The one place the app decides what time and what day it is (issue #293). Everything people see or
 * type is in Pacific time ({@code America/Los_Angeles}), and the date-time columns of the database
 * hold Pacific wall-clock time, so every "now" and every "today" is taken here rather than from the
 * server's own time zone, which on a deployed server is UTC.
 *
 * <p>The exception is a column that holds an exact instant (the users' {@code last_online}, a
 * {@code TIMESTAMP WITH TIME ZONE}); it stays an {@link Instant}.
 */
public final class AppTime {
  /** The app's time zone: UC Santa Barbara's. */
  public static final ZoneId ZONE = ZoneId.of("America/Los_Angeles");

  private static final Clock CLOCK = Clock.system(ZONE);

  private AppTime() {}

  /** The current Pacific wall-clock time, as stored in the date-time columns. */
  public static LocalDateTime now() {
    return now(CLOCK);
  }

  /** The current Pacific date. */
  public static LocalDate today() {
    return today(CLOCK);
  }

  /** The Pacific wall-clock time of the clock's instant; the clock's own zone is ignored. */
  public static LocalDateTime now(Clock clock) {
    return LocalDateTime.ofInstant(clock.instant(), ZONE);
  }

  /** The Pacific date of the clock's instant; the clock's own zone is ignored. */
  public static LocalDate today(Clock clock) {
    return now(clock).toLocalDate();
  }

  /**
   * Makes Pacific time the JVM's default zone, so that anything that asks the JVM for local time
   * (JDBC drivers, log lines, library code) agrees with {@link #now()} whatever the server's own TZ
   * is. Safe to call more than once.
   */
  public static void installAsDefaultTimeZone() {
    TimeZone.setDefault(TimeZone.getTimeZone(ZONE));
  }
}
