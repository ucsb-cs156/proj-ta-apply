package edu.ucsb.cs.taapply.services;

/**
 * Reads the background refresh settings (issue #281): {@code ADMIN_REFRESH_SEC}, {@code
 * ADMIN_REFRESH_JITTER}, {@code NON_ADMIN_REFRESH} and {@code NON_ADMIN_JITTER}. A client waits a
 * uniformly random time between base minus jitter and base plus jitter seconds before each refresh.
 *
 * <p>The rules, so that a typing mistake can never make a client refresh in a tight loop or never:
 *
 * <ul>
 *   <li>a base that is missing, not a number, not finite or below 1 second is the default;
 *   <li>a jitter that is missing, not a number, not finite, negative or larger than its base is the
 *       default jitter;
 *   <li>a jitter is never larger than its base, so a wait is never negative (the client also never
 *       waits less than 1 second).
 * </ul>
 */
public final class RefreshSetting {

  public static final double MIN_BASE_SEC = 1;

  private RefreshSetting() {}

  private static Double number(String setting) {
    if (setting == null) {
      return null;
    }
    try {
      double value = Double.parseDouble(setting.trim());
      return Double.isFinite(value) ? value : null;
    } catch (NumberFormatException e) {
      return null;
    }
  }

  /**
   * The mean wait in seconds: the setting if it is a number of at least 1, otherwise the default.
   */
  public static double base(String setting, double defaultBase) {
    Double value = number(setting);
    return value != null && value >= MIN_BASE_SEC ? value : defaultBase;
  }

  /** The jitter in seconds, for a base already resolved by {@link #base}. */
  public static double jitter(String setting, double defaultJitter, double base) {
    Double value = number(setting);
    double chosen = value != null && value >= 0 && value <= base ? value : defaultJitter;
    return Math.min(chosen, base);
  }
}
