package edu.ucsb.cs.taapply.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.jobs.RecruitmentCoursesRefreshScheduler;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs156.jobs.services.JobRateLimit;
import edu.ucsb.cs156.jobs.services.JobService;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** The nightly refresh (issue #124) exists only when switched on by property. */
public class SchedulingConfigTests {

  @SpringBootTest(
      classes = {SchedulingConfig.class, RecruitmentCoursesRefreshScheduler.class},
      properties = "app.recruitmentCourses.refreshEnabled=true")
  @Nested
  class SwitchedOn {
    @Autowired ApplicationContext context;
    @MockitoBean RecruitmentRepository recruitmentRepository;
    @MockitoBean PopulateRecruitmentCoursesJobFactory factory;
    @MockitoBean JobService jobService;
    @MockitoBean JobRateLimit jobRateLimit;
    @MockitoBean ApplicationAccessService applicationAccessService;

    @Test
    public void the_scheduler_and_scheduling_config_are_present() {
      assertTrue(context.containsBean("schedulingConfig"));
      assertTrue(context.containsBean("recruitmentCoursesRefreshScheduler"));
    }
  }

  @SpringBootTest(classes = {SchedulingConfig.class, RecruitmentCoursesRefreshScheduler.class})
  @Nested
  class SwitchedOffByDefault {
    @Autowired ApplicationContext context;
    @MockitoBean RecruitmentRepository recruitmentRepository;
    @MockitoBean PopulateRecruitmentCoursesJobFactory factory;
    @MockitoBean JobService jobService;
    @MockitoBean JobRateLimit jobRateLimit;
    @MockitoBean ApplicationAccessService applicationAccessService;

    @Test
    public void neither_bean_is_present() {
      assertFalse(context.containsBean("schedulingConfig"));
      assertFalse(context.containsBean("recruitmentCoursesRefreshScheduler"));
    }
  }
}
