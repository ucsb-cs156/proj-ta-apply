package edu.ucsb.cs.taapply.services.fake;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.EnrollmentEstimateSource;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.AllocationVisibilityService;
import edu.ucsb.cs.taapply.services.BudgetCourseService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Developer Mode's "fake hiring targets and allocations" (issue #225). No new generator: the real
 * planning features already turn a hiring target and enrollment estimates into a plausible
 * allocation, so this runs them in order for a test instance: set the target, fill the enrollment
 * estimates, auto-allocate, and optionally let each faculty member see their own courses'
 * allocations (the audited change an admin would make by hand).
 */
@Service
public class FakeAllocationsService {

  /** Where the enrollment estimates come from; KEEP leaves the ones already entered. */
  public enum Estimates {
    MAX,
    ACTUAL,
    KEEP
  }

  /** The largest hiring target offered, as a multiple of the recruitment's courses. */
  public static final int MAX_TARGET_PER_COURSE = 3;

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired AllocationService allocationService;
  @Autowired AllocationVisibilityService allocationVisibilityService;
  @Autowired BudgetCourseService budgetCourseService;

  /**
   * Fakes the recruitment's hiring target and allocations.
   *
   * @param hiringTarget from 1 to {@link #MAX_TARGET_PER_COURSE} times the non-removed courses
   * @param estimates where the enrollment estimates come from
   * @param setVisibility whether faculty then see the allocations of their own courses
   * @return the non-removed courses in page order, with their new allocations
   * @throws EntityNotFoundException for an unknown recruitment
   * @throws IllegalArgumentException for a target out of range, or a recruitment with no courses
   */
  public List<RecruitmentCourse> fake(
      Long recruitmentId, int hiringTarget, Estimates estimates, boolean setVisibility) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    List<RecruitmentCourse> courses =
        recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
            .filter(course -> !course.isRemoved())
            .toList();
    if (courses.isEmpty()) {
      throw new IllegalArgumentException("This recruitment has no courses to allocate to");
    }
    int max = MAX_TARGET_PER_COURSE * courses.size();
    if (hiringTarget < 1 || hiringTarget > max) {
      throw new IllegalArgumentException("hiringTarget must be between 1 and " + max);
    }

    recruitment.setTotalHiringTarget(hiringTarget);
    // Every allocation is about to be overwritten, as by Auto Allocate (issue #278).
    recruitment.setAllocationBulkVersion(recruitment.getAllocationBulkVersion() + 1);
    recruitmentRepository.save(recruitment);
    if (estimates != Estimates.KEEP) {
      // The estimates are the quarter's (issue #363): a section with no figure keeps its estimate,
      // and the other recruitment's shares move too.
      budgetCourseService.fillEstimates(
          recruitment.getQuarter(),
          courses,
          estimates == Estimates.MAX
              ? EnrollmentEstimateSource.MAX
              : EnrollmentEstimateSource.ACTUAL);
      allocationService.recomputeQuarter(recruitment.getQuarter());
    }
    List<RecruitmentCourse> allocated = allocationService.autoAllocate(recruitment);
    if (setVisibility) {
      allocationVisibilityService.change(recruitment, AllocationVisibility.OWN_COURSES);
    }
    return allocated;
  }
}
