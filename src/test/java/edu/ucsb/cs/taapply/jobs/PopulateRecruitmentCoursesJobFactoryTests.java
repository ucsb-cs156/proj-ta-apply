package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = PopulateRecruitmentCoursesJobFactory.class)
@ActiveProfiles("test")
@TestPropertySource(properties = "app.subjectArea=ECE")
public class PopulateRecruitmentCoursesJobFactoryTests {

  @Autowired private PopulateRecruitmentCoursesJobFactory factory;

  @MockitoBean private UCSBCurriculumService ucsbCurriculumService;
  @MockitoBean private CourseRepository courseRepository;
  @MockitoBean private RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean private JobRateLimit jobRateLimit;

  @Test
  public void create_wires_in_the_configured_subject_area_and_collaborators() {
    Recruitment recruitment =
        Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.ULA).build();

    PopulateRecruitmentCoursesJob job = factory.create(recruitment);

    assertSame(recruitment, job.getRecruitment());
    // From app.subjectArea, not a hardcoded literal.
    assertEquals("ECE", job.getSubjectArea());
    assertSame(ucsbCurriculumService, job.getUcsbCurriculumService());
    assertSame(courseRepository, job.getCourseRepository());
    assertSame(recruitmentCourseRepository, job.getRecruitmentCourseRepository());
    assertSame(jobRateLimit, job.getJobRateLimit());
  }
}
