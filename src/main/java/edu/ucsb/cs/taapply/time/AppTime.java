package edu.ucsb.cs.taapply.time;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Objects;
import java.util.TimeZone;

/**
 * The one place the app decides what time and what day it is (issue #293). Everything people see or
 * type is in the app's time zone, and the date-time columns of the database hold that zone's
 * wall-clock time, so every "now" and every "today" is taken here rather than from the server's own
 * time zone, which on a deployed server is UTC.
 *
 * <p>The zone is the {@code app.timeZone} property, {@value #DEFAULT_ZONE_ID} (UC Santa Barbara's)
 * unless configured (issue #513); {@link AppTimeInitializer} reads it as the application starts and
 * hands it to {@link #configure}. The same zone drives the nightly scheduler and is sent to the
 * frontend in {@code /api/systemInfo}, so changing the one property changes every time the app
 * keeps or shows.
 *
 * <p>The exception is a column that holds an exact instant (the users' {@code last_online}, a
 * {@code TIMESTAMP WITH TIME ZONE}); it stays an {@link Instant}.
 */
public final class AppTime {
  /** The zone the app runs in unless {@code app.timeZone} says otherwise. */
  public static final String DEFAULT_ZONE_ID = "America/Los_Angeles";

  /** {@link #DEFAULT_ZONE_ID} as a zone. */
  public static final ZoneId DEFAULT_ZONE = ZoneId.of(DEFAULT_ZONE_ID);

  // The clock's own zone never matters: now(Clock) reads the instant and applies zone().
  private static final Clock CLOCK = Clock.systemUTC();

  private static volatile ZoneId zone = DEFAULT_ZONE;

  private AppTime() {}

  /** The app's time zone. */
  public static ZoneId zone() {
    return zone;
  }

  /**
   * Makes {@code newZone} the app's zone, and the JVM's default (see {@link
   * #installAsDefaultTimeZone}). Called once, as the application starts, by {@link
   * AppTimeInitializer}; tests that call it must put the default back.
   */
  public static void configure(ZoneId newZone) {
    zone = Objects.requireNonNull(newZone, "the app's time zone");
    installAsDefaultTimeZone();
  }

  /** The current wall-clock time in the app's zone, as stored in the date-time columns. */
  public static LocalDateTime now() {
    return now(CLOCK);
  }

  /** The current date in the app's zone. */
  public static LocalDate today() {
    return today(CLOCK);
  }

  /** The app-zone wall-clock time of the clock's instant; the clock's own zone is ignored. */
  public static LocalDateTime now(Clock clock) {
    return LocalDateTime.ofInstant(clock.instant(), zone);
  }

  /** The app-zone date of the clock's instant; the clock's own zone is ignored. */
  public static LocalDate today(Clock clock) {
    return now(clock).toLocalDate();
  }

  /**
   * Makes the app's zone the JVM's default zone, so that anything that asks the JVM for local time
   * (JDBC drivers, log lines, library code) agrees with {@link #now()} whatever the server's own TZ
   * is. Safe to call more than once.
   */
  public static void installAsDefaultTimeZone() {
    TimeZone.setDefault(TimeZone.getTimeZone(zone));
  }
}
