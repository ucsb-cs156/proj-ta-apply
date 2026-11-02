package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Random;
import org.junit.jupiter.api.Test;

public class MinimaxAllocatorTests {

  private static double largestGap(double[] share, int[] allocation) {
    double gap = 0;
    for (int i = 0; i < share.length; i++) {
      gap = Math.max(gap, Math.abs(allocation[i] - share[i]));
    }
    return gap;
  }

  /** The smallest largest-gap over every way of splitting the target with a one each. */
  private static double bruteForce(double[] share, int target, int index, double gapSoFar) {
    if (index == share.length - 1) {
      return Math.max(gapSoFar, Math.abs(target - share[index]));
    }
    double best = Double.MAX_VALUE;
    int mostHere = target - (share.length - 1 - index);
    for (int a = 1; a <= mostHere; a++) {
      double gap = Math.max(gapSoFar, Math.abs(a - share[index]));
      best = Math.min(best, bruteForce(share, target - a, index + 1, gap));
    }
    return best;
  }

  @Test
  public void one_section_takes_the_whole_target() {
    assertArrayEquals(new int[] {6}, MinimaxAllocator.allocate(new double[] {6.0}, 6));
    assertArrayEquals(new int[] {6}, MinimaxAllocator.allocate(new double[] {0.0}, 6));
  }

  @Test
  public void as_many_hires_as_sections_gives_one_each() {
    assertArrayEquals(
        new int[] {1, 1, 1}, MinimaxAllocator.allocate(new double[] {0.1, 0.1, 2.8}, 3));
  }

  @Test
  public void exact_shares_are_kept() {
    assertArrayEquals(
        new int[] {3, 1, 4}, MinimaxAllocator.allocate(new double[] {3.0, 1.0, 4.0}, 8));
  }

  @Test
  public void tiny_shares_are_raised_to_one_and_the_large_one_gives_way() {
    assertArrayEquals(
        new int[] {1, 1, 4}, MinimaxAllocator.allocate(new double[] {0.2, 0.2, 5.6}, 6));
  }

  @Test
  public void ties_go_to_the_first_section() {
    assertArrayEquals(
        new int[] {3, 3, 2, 2}, MinimaxAllocator.allocate(new double[] {2.5, 2.5, 2.5, 2.5}, 10));
  }

  @Test
  public void a_section_that_is_close_already_keeps_its_place_while_a_tied_pair_splits() {
    // Shares 2.5, 3.9, 2.5, 1.1 of 10. The best largest gap is 0.5. The second and fourth are
    // pinned to 4 and 1, so one of the two 2.5s gets the last unit: the first.
    assertArrayEquals(
        new int[] {3, 4, 2, 1}, MinimaxAllocator.allocate(new double[] {2.5, 3.9, 2.5, 1.1}, 10));
  }

  @Test
  public void matches_exhaustive_search_on_many_random_cases() {
    Random random = new Random(257);
    for (int round = 0; round < 400; round++) {
      int n = 1 + random.nextInt(5);
      int target = n + random.nextInt(8);
      double[] share = new double[n];
      double total = 0;
      for (int i = 0; i < n; i++) {
        share[i] = random.nextInt(4) == 0 ? 0 : random.nextInt(1000) / 10.0;
        total += share[i];
      }
      // Scale so the shares add up to the target, like real shares do, in every other round (the
      // result is optimal for any shares).
      for (int i = 0; i < n && total > 0 && round % 2 == 0; i++) {
        share[i] = share[i] * target / total;
      }

      int[] allocation = MinimaxAllocator.allocate(share, target);

      String where =
          Arrays.toString(share) + " of " + target + " -> " + Arrays.toString(allocation);
      assertEquals(target, Arrays.stream(allocation).sum(), where);
      assertTrue(Arrays.stream(allocation).allMatch(a -> a >= 1), where);
      assertEquals(bruteForce(share, target, 0, 0), largestGap(share, allocation), 1e-12, where);
    }
  }

  @Test
  public void a_large_case_finishes_quickly_and_adds_up() {
    int n = 120;
    int target = 400;
    double[] share = new double[n];
    for (int i = 0; i < n; i++) {
      share[i] = (i % 7) * target / 360.0;
    }
    long start = System.nanoTime();
    int[] allocation = MinimaxAllocator.allocate(share, target);
    long millis = (System.nanoTime() - start) / 1_000_000;

    assertEquals(target, Arrays.stream(allocation).sum());
    assertTrue(Arrays.stream(allocation).allMatch(a -> a >= 1));
    assertTrue(millis < 5000, "took " + millis + " ms");
  }
}
