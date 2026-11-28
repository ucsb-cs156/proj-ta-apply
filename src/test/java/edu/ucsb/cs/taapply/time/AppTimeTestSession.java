package edu.ucsb.cs.taapply.time;

import org.h2.util.DateTimeUtils;
import org.junit.platform.launcher.LauncherSession;
import org.junit.platform.launcher.LauncherSessionListener;

/**
 * Puts the test JVM into the app's time zone before the first test runs, the way {@code
 * TaApplyApplication} does for the app (issue #523).
 *
 * <p>Surefire starts the test JVM with {@code TZ=UTC}, as a deployed server runs. Loading {@code
 * TaApplyApplication} installs the app's zone, and every Spring test loads it; a plain-JDBC test
 * (the Liquibase changelog tests) does not. H2 reads the JVM's default zone the first time it needs
 * one and keeps that value for the rest of the JVM, so when a plain-JDBC test was the first to
 * touch H2, H2 settled on UTC while later Spring tests ran in the app's zone, and a {@code
 * TIMESTAMP} read back through {@code java.sql.Timestamp} came out shifted by eight hours. Which
 * tests failed depended on the order surefire happened to pick, which differs between macOS and
 * Linux.
 *
 * <p>This listener runs once, when JUnit opens its launcher session, before any test class is
 * loaded: it installs the app's zone as the JVM default and has H2 read it right then, so H2 keeps
 * the app's zone whatever test comes first and whatever zone a test later gives the JVM. Registered
 * in {@code META-INF/services/org.junit.platform.launcher.LauncherSessionListener}.
 */
public final class AppTimeTestSession implements LauncherSessionListener {

  @Override
  public void launcherSessionOpened(LauncherSession session) {
    install();
  }

  /**
   * Makes the app's zone the JVM default and the zone H2 keeps. Safe to call again; a test that has
   * deliberately unsettled H2 calls it to put things back.
   */
  public static void install() {
    AppTime.installAsDefaultTimeZone();
    // H2 caches the JVM's zone in DateTimeUtils the first time getTimeZone() is called (opening a
    // connection calls it) and never looks again; resetting and reading it here, with the app's
    // zone
    // in place, is what makes H2 keep the app's zone for the rest of the test run.
    DateTimeUtils.resetCalendar();
    DateTimeUtils.getTimeZone();
  }
}
