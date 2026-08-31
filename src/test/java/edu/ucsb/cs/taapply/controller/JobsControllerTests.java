package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.jobs.PopulateCoursesJob;
import edu.ucsb.cs.taapply.jobs.PopulateCoursesJobFactory;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.JobsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class JobsControllerTests extends ControllerTestCase {

  @MockitoBean JobService jobService;
  @MockitoBean PopulateCoursesJobFactory populateCoursesJobFactory;

  @Test
  public void logged_out_users_cannot_launch_test_job() throws Exception {
    mockMvc.perform(post("/api/jobs/launch/testjob").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void logged_in_regular_users_cannot_launch_test_job() throws Exception {
    mockMvc.perform(post("/api/jobs/launch/testjob").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_launch_test_job() throws Exception {
    mockMvc.perform(post("/api/jobs/launch/testjob").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void grad_students_cannot_launch_test_job() throws Exception {
    mockMvc.perform(post("/api/jobs/launch/testjob").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_launch_test_job_with_defaults() throws Exception {
    Job job = Job.builder().id(1L).status("complete").build();
    when(jobService.runAsJob(any())).thenReturn(job);

    MvcResult response =
        mockMvc
            .perform(post("/api/jobs/launch/testjob").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(jobService).runAsJob(any());
    assertEquals(mapper.writeValueAsString(job), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_launch_test_job_with_explicit_params() throws Exception {
    Job job = Job.builder().id(2L).status("error").build();
    when(jobService.runAsJob(any())).thenReturn(job);

    MvcResult response =
        mockMvc
            .perform(post("/api/jobs/launch/testjob?fail=true&sleepMs=5").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(jobService).runAsJob(any());
    assertEquals(mapper.writeValueAsString(job), response.getResponse().getContentAsString());
  }

  // ---- POST /api/jobs/launch/populateCourses ----

  private static final String POPULATE_URL =
      "/api/jobs/launch/populateCourses?startQuarter=20241&endQuarter=20243&level=U";

  @Test
  public void logged_out_users_cannot_launch_populate_courses() throws Exception {
    mockMvc.perform(post(POPULATE_URL).with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_launch_populate_courses() throws Exception {
    mockMvc.perform(post(POPULATE_URL).with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_launch_populate_courses() throws Exception {
    mockMvc.perform(post(POPULATE_URL).with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_launch_populate_courses() throws Exception {
    Job job = Job.builder().id(7L).status("running").build();
    PopulateCoursesJob populateJob = PopulateCoursesJob.builder().build();
    when(populateCoursesJobFactory.create("20241", "20243", "U")).thenReturn(populateJob);
    when(jobService.runAsJob(any())).thenReturn(job);

    MvcResult response =
        mockMvc.perform(post(POPULATE_URL).with(csrf())).andExpect(status().isOk()).andReturn();

    verify(populateCoursesJobFactory).create("20241", "20243", "U");
    verify(jobService).runAsJob(populateJob);
    assertEquals(mapper.writeValueAsString(job), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_backwards_quarter_range_is_a_400_and_launches_nothing() throws Exception {
    mockMvc
        .perform(
            post("/api/jobs/launch/populateCourses?startQuarter=20243&endQuarter=20241&level=U")
                .with(csrf()))
        .andExpect(status().isBadRequest());

    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_malformed_quarter_is_a_400_and_launches_nothing() throws Exception {
    mockMvc
        .perform(
            post("/api/jobs/launch/populateCourses?startQuarter=bogus&endQuarter=20241&level=U")
                .with(csrf()))
        .andExpect(status().isBadRequest());

    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_invalid_level_is_a_400_and_launches_nothing() throws Exception {
    mockMvc
        .perform(
            post("/api/jobs/launch/populateCourses?startQuarter=20241&endQuarter=20243&level=X")
                .with(csrf()))
        .andExpect(status().isBadRequest());

    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void all_three_valid_levels_are_accepted() throws Exception {
    Job job = Job.builder().id(8L).build();
    when(populateCoursesJobFactory.create(any(), any(), any()))
        .thenReturn(PopulateCoursesJob.builder().build());
    when(jobService.runAsJob(any())).thenReturn(job);

    for (String level : List.of("U", "G", "A")) {
      mockMvc
          .perform(
              post("/api/jobs/launch/populateCourses?startQuarter=20241&endQuarter=20241&level="
                      + level)
                  .with(csrf()))
          .andExpect(status().isOk());
    }
  }
}
