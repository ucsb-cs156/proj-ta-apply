package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Builds {@link PopulateCoursesJob} instances with their collaborators wired in, so the controller
 * only has to supply the quarter range and level. Same pattern as proj-courses'
 * UpdateCourseDataJobFactory.
 */
@Service
@Slf4j
public class PopulateCoursesJobFactory {

  @Autowired private UCSBCurriculumService ucsbCurriculumService;

  @Autowired private CourseRepository courseRepository;

  @Autowired private JobRateLimit jobRateLimit;

  @Value("${app.subjectArea:CMPSC}")
  private String subjectArea;

  public PopulateCoursesJob create(String startQuarterYYYYQ, String endQuarterYYYYQ, String level) {
    return PopulateCoursesJob.builder()
        .startQuarterYYYYQ(startQuarterYYYYQ)
        .endQuarterYYYYQ(endQuarterYYYYQ)
        .level(level)
        .subjectArea(subjectArea)
        .ucsbCurriculumService(ucsbCurriculumService)
        .courseRepository(courseRepository)
        .jobRateLimit(jobRateLimit)
        .build();
  }
}
