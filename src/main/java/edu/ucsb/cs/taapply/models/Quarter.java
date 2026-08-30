package edu.ucsb.cs.taapply.models;

import java.util.ArrayList;
import java.util.List;

/**
 * A UCSB quarter in YYYYQ format, where Q is 1=Winter, 2=Spring, 3=Summer, 4=Fall. For example
 * 20244 is Fall 2024 and 20251 is Winter 2025.
 *
 * <p>This is a deliberately narrow version of proj-courses' {@code models/Quarter}: it keeps only
 * what iteration 2 needs (parsing, incrementing and building an inclusive range). QYY parsing and
 * {@code decrement()} are omitted rather than ported unused.
 */
public class Quarter {

  private int yyyyq;

  public Quarter(int yyyyq) {
    setValue(yyyyq);
  }

  /**
   * @param yyyyq quarter in YYYYQ format, e.g. "20244"
   * @throws IllegalArgumentException if not five digits ending in 1-4
   */
  public Quarter(String yyyyq) {
    setValue(yyyyqToInt(yyyyq));
  }

  public int getValue() {
    return this.yyyyq;
  }

  public String getYYYYQ() {
    return String.format("%d", this.yyyyq);
  }

  @Override
  public String toString() {
    return getYYYYQ();
  }

  private void setValue(int yyyyq) {
    if (invalidQtr(yyyyq)) {
      throw new IllegalArgumentException("Quarter requires an integer ending in 1, 2, 3 or 4");
    }
    this.yyyyq = yyyyq;
  }

  private static boolean invalidQtr(int value) {
    int q = value % 10;
    return (q < 1) || (q > 4);
  }

  /**
   * Advance to the next quarter, rolling e.g. 20244 to 20251.
   *
   * @return the new value in YYYYQ format
   */
  public int increment() {
    int q = this.yyyyq % 10;
    int yyyy = this.yyyyq / 10;
    setValue((q == 4) ? (((yyyy + 1) * 10) + 1) : (this.yyyyq + 1));
    return this.yyyyq;
  }

  /**
   * Parse a YYYYQ string into an int.
   *
   * @throws IllegalArgumentException if not five digits ending in 1-4
   */
  public static int yyyyqToInt(String yyyyq) {
    if (yyyyq == null || yyyyq.length() != 5) {
      throw new IllegalArgumentException("Quarter should be in YYYYQ format, e.g. 20244");
    }
    int value;
    try {
      value = Integer.parseInt(yyyyq);
    } catch (NumberFormatException e) {
      throw new IllegalArgumentException("Quarter should be in YYYYQ format, e.g. 20244");
    }
    if (invalidQtr(value)) {
      throw new IllegalArgumentException("Quarter should end in 1, 2, 3 or 4");
    }
    return value;
  }

  /**
   * Every quarter from start to end, inclusive, in ascending order.
   *
   * @throws IllegalArgumentException if either is malformed, or if start is after end. Unlike
   *     proj-courses' version, this does not silently reverse direction when start &gt; end: the
   *     admin Courses form treats that as a validation error rather than a backwards range.
   */
  public static List<Quarter> quarterList(String start, String end) {
    int startInt = yyyyqToInt(start);
    int endInt = yyyyqToInt(end);

    if (startInt > endInt) {
      throw new IllegalArgumentException(
          String.format("Start quarter %s must not be after end quarter %s", start, end));
    }

    List<Quarter> result = new ArrayList<>();
    for (Quarter iter = new Quarter(startInt); iter.getValue() <= endInt; iter.increment()) {
      result.add(new Quarter(iter.getValue()));
    }
    return result;
  }
}
