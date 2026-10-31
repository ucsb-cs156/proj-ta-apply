package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The arithmetic behind the allocation columns of the Recruitment Courses page (issue #176): each
 * section's fractional share of the hiring target by enrollment estimate, and the first-cut
 * allocation an admin can ask for from it.
 *
 * <p>Removed sections take no part in either: they are not offered, so they neither claim a share
 * nor count in the total of the estimates. A section with no estimate counts as 0 students.
 */
@Service
public class AllocationService {

  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;

  /** Course id first, then section: the order the page lists rows in, used to break ties. */
  private static final Comparator<RecruitmentCourse> BY_COURSE_THEN_SECTION =
      Comparator.comparing(RecruitmentCourse::getCourseId)
          .thenComparing(
              RecruitmentCourse::getSection, Comparator.nullsFirst(Comparator.naturalOrder()));

  /**
   * Recomputes and stores {@code unroundedAllocation} for every non-removed section of the
   * recruitment: {@code totalHiringTarget * estimate / total of the estimates}, or 0.0 for every
   * section when the estimates add up to nothing. Returns the sections it recomputed, in page
   * order.
   */
  public List<RecruitmentCourse> recompute(Recruitment recruitment) {
    List<RecruitmentCourse> active = activeRows(recruitment);
    double total = active.stream().mapToDouble(AllocationService::estimateOf).sum();
    for (RecruitmentCourse row : active) {
      double share =
          total == 0 ? 0.0 : recruitment.getTotalHiringTarget() * (estimateOf(row) / total);
      row.setUnroundedAllocation(share);
      recruitmentCourseRepository.save(row);
    }
    return active;
  }

  /**
   * Overwrites every non-removed section's allocation with a best effort at the hiring target from
   * the enrollment estimates, and returns the sections in page order:
   *
   * <ol>
   *   <li>each section gets its unrounded share rounded to the nearest whole number (half up);
   *   <li>while the total is above the target, the section furthest above its share (the largest
   *       {@code allocation - unroundedAllocation}) loses one; while the total is below the target,
   *       the section furthest below its share gains one. Ties go to the first section in page
   *       order. No section ever goes below zero: see the note in the code.
   * </ol>
   *
   * <p>The sign convention is the opposite of the page's Delta column, which shows {@code
   * unroundedAllocation - allocation}; here "furthest above its share" is what has to give.
   */
  public List<RecruitmentCourse> autoAllocate(Recruitment recruitment) {
    List<RecruitmentCourse> active = recompute(recruitment);
    if (!active.isEmpty()) {
      int target = recruitment.getTotalHiringTarget();

      int sum = 0;
      for (RecruitmentCourse row : active) {
        int rounded = (int) Math.floor(row.getUnroundedAllocation() + 0.5);
        row.setAllocation(rounded);
        sum += rounded;
      }
      // Whenever the total is above the target, the excesses add up to more than zero, so the most
      // over section has a positive excess and therefore an allocation above zero: taking one from
      // it can never go below zero.
      while (sum > target) {
        RecruitmentCourse mostOver = active.get(0);
        for (RecruitmentCourse row : active) {
          if (excess(row) > excess(mostOver)) {
            mostOver = row;
          }
        }
        mostOver.setAllocation(mostOver.getAllocation() - 1);
        sum--;
      }
      while (sum < target) {
        RecruitmentCourse mostUnder = active.get(0);
        for (RecruitmentCourse row : active) {
          if (excess(row) < excess(mostUnder)) {
            mostUnder = row;
          }
        }
        mostUnder.setAllocation(mostUnder.getAllocation() + 1);
        sum++;
      }

      for (RecruitmentCourse row : active) {
        recruitmentCourseRepository.save(row);
      }
    }
    return active;
  }

  /** How far a section's allocation is above its fair share; negative when below. */
  private static double excess(RecruitmentCourse row) {
    return row.getAllocation() - row.getUnroundedAllocation();
  }

  private static double estimateOf(RecruitmentCourse row) {
    return row.getEnrollmentEstimate() == null ? 0 : row.getEnrollmentEstimate();
  }

  private List<RecruitmentCourse> activeRows(Recruitment recruitment) {
    return recruitmentCourseRepository.findByRecruitmentId(recruitment.getId()).stream()
        .filter(row -> !row.isRemoved())
        .sorted(BY_COURSE_THEN_SECTION)
        .toList();
  }
}
