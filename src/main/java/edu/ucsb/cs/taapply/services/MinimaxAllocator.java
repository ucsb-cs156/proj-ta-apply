package edu.ucsb.cs.taapply.services;

import java.util.Arrays;

/**
 * Splits a hiring target among sections so that every section gets at least one, and the largest
 * distance between any section's allocation and its fair share is as small as it can be (issue
 * #257).
 *
 * <p>With {@code n} sections, fair shares {@code s[i]} and a target {@code T >= n}, this finds
 * whole numbers {@code a[i] >= 1} adding up to {@code T} that minimise {@code max |a[i] - s[i]|}.
 * The method is a greedy one, and it is exactly optimal, not an approximation: every section starts
 * at one, and each of the remaining {@code T - n} units goes to the section with the largest
 * shortfall {@code s[i] - a[i]} (the first in order on ties).
 *
 * <p><b>Why it is optimal.</b> The largest shortfall never rises as units are handed out, since
 * only the section that has it changes, and it drops by one. Call the shortfall of the section that
 * took unit {@code t}, just before it did, {@code m(t)}; these are non-increasing. Let {@code a} be
 * the result and {@code b} any other way to split the target with a one each. Take the section with
 * the largest gap in {@code a}:
 *
 * <ul>
 *   <li><b>It is under its share by {@code U}.</b> If {@code b} gives it no more than {@code a}
 *       did, {@code b} is at least {@code U} under it too. Otherwise some other section {@code i}
 *       has {@code b[i] < a[i]}; the last unit {@code a[i]} took went to it because its shortfall
 *       was then the largest, so at least this section's, which was at least {@code U} (it only
 *       grows less short later). So {@code s[i] - b[i] >= s[i] - (a[i] - 1) >= U}.
 *   <li><b>It is over its share by {@code O}.</b> If it never took a unit, then {@code b[i] >= 1 =
 *       a[i]} gives {@code b} the same overshoot. Otherwise its last unit went to it at shortfall
 *       {@code m}, so {@code O = 1 - m}. If {@code b[i] >= a[i]}, {@code b} is at least as far
 *       over. Otherwise some section {@code k} has {@code b[k] > a[k]}; at that moment {@code k}
 *       was at most {@code m} short, so {@code b[k] - s[k] >= a[k] + 1 - s[k] >= 1 - m = O}.
 * </ul>
 *
 * <p>Either way {@code b} has a gap at least as large as {@code a}'s, so {@code a} is optimal. This
 * holds for any non-negative shares, not only ones that add up to the target.
 *
 * <p>Running time: {@code T - n} units, each found by one pass over the {@code n} sections, so
 * {@code O(n * (T - n))}; with a priority queue it would be {@code O((T - n) log n)}, which these
 * sizes do not need.
 */
final class MinimaxAllocator {

  private MinimaxAllocator() {}

  /**
   * The allocations, in the order of {@code share}. Requires {@code share.length >= 1} and {@code
   * target >= share.length}.
   */
  static int[] allocate(double[] share, int target) {
    int[] allocation = new int[share.length];
    Arrays.fill(allocation, 1);
    for (int unit = share.length; unit < target; unit++) {
      int neediest = 0;
      for (int i = 1; i < share.length; i++) {
        if (share[i] - allocation[i] > share[neediest] - allocation[neediest]) {
          neediest = i;
        }
      }
      allocation[neediest]++;
    }
    return allocation;
  }
}
