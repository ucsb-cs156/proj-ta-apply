package edu.ucsb.cs.taapply.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on Spring scheduling, and with it the nightly refresh of recruitment course lists (issue
 * #124), only when {@code app.recruitmentCourses.refreshEnabled} is true. It is off by default and
 * in every test and development profile, and on in production, so a test run never fires a job.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "app.recruitmentCourses.refreshEnabled", havingValue = "true")
public class SchedulingConfig {}
