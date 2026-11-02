package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.CreateFakeApplicationsJobFactory;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Developer Mode's fake applications (issue #219). Admin only, and 404 unless Developer Mode is on
 * (the environment flag AND the setting), so nothing can be generated where the feature does not
 * exist.
 */
@Tag(name = "Developer mode")
@RestController
@RequestMapping("/api/admin/developer/fakeApplications")
public class DeveloperFakeApplicationsController extends ApiController {

  /** A request must ask for between this many and {@link #MAX_PER_COURSE} per course. */
  static final int MIN_PER_COURSE = 2;

  static final int MAX_PER_COURSE = 10;

  @Autowired DeveloperModeService developerModeService;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired AuditTrailRepository auditTrailRepository;
  @Autowired CreateFakeApplicationsJobFactory createFakeApplicationsJobFactory;
  @Autowired JobService jobService;

  @Operation(
      summary = "Create fake applications for a recruitment",
      description =
          "Launches a job that adds count fake applications (origin DEVELOPER_MODE). count must"
              + " be between 2 and 10 times the recruitment's non-removed courses. 404 unless"
              + " Developer Mode is on.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("")
  public Job create(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "count") @RequestParam int count,
      @Parameter(name = "coverage", description = "ALL or SPARSE") @RequestParam
          FakeCoverage coverage) {
    requireDeveloperMode();
    requireRecruitment(recruitmentId);

    long courses =
        recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
            .filter(c -> !c.isRemoved())
            .count();
    if (courses == 0) {
      throw new IllegalArgumentException("This recruitment has no courses to apply to");
    }
    if (count < MIN_PER_COURSE * courses || count > MAX_PER_COURSE * courses) {
      throw new IllegalArgumentException(
          "count must be between %d and %d for %d course(s)"
              .formatted(MIN_PER_COURSE * courses, MAX_PER_COURSE * courses, courses));
    }
    return jobService.runAsJob(
        createFakeApplicationsJobFactory.create(recruitmentId, count, coverage));
  }

  @Operation(
      summary = "Delete a recruitment's fake applications",
      description =
          "Deletes every application with origin DEVELOPER_MODE in the recruitment, with its audit"
              + " trail, and nothing else. Returns how many. 404 unless Developer Mode is on.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("")
  public Map<String, Integer> delete(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    requireDeveloperMode();
    requireRecruitment(recruitmentId);

    List<Application> fakes =
        applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId).stream()
            .filter(a -> a.getOrigin() == ApplicationOrigin.DEVELOPER_MODE)
            .toList();
    for (Application fake : fakes) {
      // An admin may have edited a fake application; its audit rows would block the delete.
      auditTrailRepository.deleteAll(
          auditTrailRepository.findByTaApplicationIdOrderByIdAsc(fake.getId()));
      auditTrailRepository.deleteAll(
          auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(fake.getId()));
    }
    applicationRepository.deleteAll(fakes);
    return Map.of("deleted", fakes.size());
  }

  private void requireDeveloperMode() {
    if (!developerModeService.isOn()) {
      throw new EntityNotFoundException("Developer mode is not on");
    }
  }

  private void requireRecruitment(Long recruitmentId) {
    recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }
}
