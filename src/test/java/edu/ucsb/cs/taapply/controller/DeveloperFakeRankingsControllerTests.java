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
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.jobs.CreateFakeRankingsJob;
import edu.ucsb.cs.taapply.jobs.CreateFakeRankingsJobFactory;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.fake.FakeRankingScope;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = DeveloperFakeRankingsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class DeveloperFakeRankingsControllerTests extends ControllerTestCase {

  @MockitoBean DeveloperModeService developerModeService;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean CreateFakeRankingsJobFactory createFakeRankingsJobFactory;
  @MockitoBean JobService jobService;
  @MockitoBean UserRepository userRepository;

  private static final String CREATE = "/api/admin/developer/fakeRankings";

  private static Recruitment recruitment(String reviewStatus) {
    return Recruitment.builder()
        .id(7L)
        .quarter("20261")
        .type(RecruitmentType.TA)
        .reviewStatus(reviewStatus)
        .build();
  }

  @BeforeEach
  void developerModeOnAndReviewsOpen() {
    when(developerModeService.isOn()).thenReturn(true);
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment("Open")));
  }

  private static String url(String recruitmentId, String scope) {
    return CREATE + "?recruitmentId=" + recruitmentId + "&scope=" + scope;
  }

  // ---- who may ----

  @Test
  public void logged_out_users_cannot_create() throws Exception {
    mockMvc.perform(post(url("7", "ALL")).with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_create() throws Exception {
    mockMvc.perform(post(url("7", "ALL")).with(csrf())).andExpect(status().is(403));
    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_create() throws Exception {
    mockMvc.perform(post(url("7", "ALL")).with(csrf())).andExpect(status().is(403));
  }

  // ---- what it does ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_launches_the_job() throws Exception {
    CreateFakeRankingsJob job = CreateFakeRankingsJob.builder().build();
    Job launched = Job.builder().id(3L).status("running").build();
    when(createFakeRankingsJobFactory.create(7L, FakeRankingScope.SOME, true)).thenReturn(job);
    when(jobService.runAsJob(job)).thenReturn(launched);

    MvcResult response =
        mockMvc
            .perform(post(url("7", "SOME") + "&includeNotInterested=true").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(launched), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void not_interested_defaults_to_false() throws Exception {
    CreateFakeRankingsJob job = CreateFakeRankingsJob.builder().build();
    Job launched = Job.builder().id(4L).build();
    when(createFakeRankingsJobFactory.create(7L, FakeRankingScope.ALL, false)).thenReturn(job);
    when(jobService.runAsJob(job)).thenReturn(launched);

    mockMvc.perform(post(url("7", "ALL")).with(csrf())).andExpect(status().isOk());

    verify(jobService).runAsJob(job);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_scope_other_than_some_or_all_is_a_400() throws Exception {
    mockMvc.perform(post(url("7", "MOST")).with(csrf())).andExpect(status().isBadRequest());

    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void unless_the_faculty_review_is_open_it_is_a_400_and_launches_nothing()
      throws Exception {
    for (String status : new String[] {"NotStarted", "Closed", null}) {
      when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment(status)));

      MvcResult response =
          mockMvc
              .perform(post(url("7", "ALL")).with(csrf()))
              .andExpect(status().isBadRequest())
              .andReturn();

      assertEquals(
          Map.of(
              "type",
              "IllegalArgumentException",
              "message",
              "Faculty ranking is not open for this recruitment"),
          responseToJson(response));
    }
    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(post(url("99", "ALL")).with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals(
        Map.of("type", "EntityNotFoundException", "message", "Recruitment with id 99 not found"),
        responseToJson(response));
    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void with_developer_mode_off_it_is_a_404_and_launches_nothing() throws Exception {
    when(developerModeService.isOn()).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(post(url("7", "ALL")).with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals(
        Map.of("type", "EntityNotFoundException", "message", "Developer mode is not on"),
        responseToJson(response));
    verify(jobService, never()).runAsJob(any());
  }
}
