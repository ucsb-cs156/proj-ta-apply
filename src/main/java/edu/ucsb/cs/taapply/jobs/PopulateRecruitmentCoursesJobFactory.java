package edu.ucsb.cs.taapply.jobs;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Wires collaborators into {@link PopulateRecruitmentCoursesJob}, as PopulateCoursesJobFactory
 * does.
 */
@Service
@Slf4j
public class PopulateRecruitmentCoursesJobFactory {

  @Autowired private UCSBCurriculumService ucsbCurriculumService;
  @Autowired private CourseRepository courseRepository;
  @Autowired private RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired private JobRateLimit jobRateLimit;

  @Value("${app.subjectArea:CMPSC}")
  private String subjectArea;

  public PopulateRecruitmentCoursesJob create(Recruitment recruitment) {
    return PopulateRecruitmentCoursesJob.builder()
        .recruitment(recruitment)
        .subjectArea(subjectArea)
        .ucsbCurriculumService(ucsbCurriculumService)
        .courseRepository(courseRepository)
        .recruitmentCourseRepository(recruitmentCourseRepository)
        .jobRateLimit(jobRateLimit)
        .build();
  }
}
