package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
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
}
