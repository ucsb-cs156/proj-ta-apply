package edu.ucsb.cs.taapply.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.time.AppTime;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = RefreshRecruitmentCoursesJobFactory.class)
@ActiveProfiles("test")
public class RefreshRecruitmentCoursesJobFactoryTests {

  @Autowired private RefreshRecruitmentCoursesJobFactory factory;

  @MockitoBean private RecruitmentRepository recruitmentRepository;
  @MockitoBean private ApplicationAccessService applicationAccessService;
  @MockitoBean private PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;

  @Test
  public void create_wires_in_the_day_and_collaborators() {
    LocalDate day = LocalDate.of(2026, 11, 19);

    RefreshRecruitmentCoursesJob job = factory.create(day);

    assertEquals(day, job.getToday());
    assertSame(recruitmentRepository, job.getRecruitmentRepository());
    assertSame(applicationAccessService, job.getApplicationAccessService());
    assertSame(populateRecruitmentCoursesJobFactory, job.getPopulateRecruitmentCoursesJobFactory());
  }

  @Test
  public void create_with_no_day_judges_as_of_today() {
    RefreshRecruitmentCoursesJob job = factory.create();

    assertEquals(AppTime.today(), job.getToday());
    assertSame(recruitmentRepository, job.getRecruitmentRepository());
  }
}
