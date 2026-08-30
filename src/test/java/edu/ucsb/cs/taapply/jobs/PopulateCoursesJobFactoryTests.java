package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import edu.ucsb.cs.taapply.repository.CourseRepository;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = PopulateCoursesJobFactory.class)
@ActiveProfiles("test")
@TestPropertySource(properties = "app.subjectArea=ECE")
public class PopulateCoursesJobFactoryTests {

  @Autowired private PopulateCoursesJobFactory factory;

  @MockitoBean private UCSBCurriculumService ucsbCurriculumService;
  @MockitoBean private CourseRepository courseRepository;
  @MockitoBean private JobRateLimit jobRateLimit;

  @Test
  public void create_wires_in_the_configured_subject_area_and_collaborators() {
    PopulateCoursesJob job = factory.create("20241", "20243", "G");

    assertEquals("20241", job.getStartQuarterYYYYQ());
    assertEquals("20243", job.getEndQuarterYYYYQ());
    assertEquals("G", job.getLevel());
    // Comes from app.subjectArea, not a hardcoded literal.
    assertEquals("ECE", job.getSubjectArea());
    assertSame(ucsbCurriculumService, job.getUcsbCurriculumService());
    assertSame(courseRepository, job.getCourseRepository());
    assertSame(jobRateLimit, job.getJobRateLimit());
  }
}
