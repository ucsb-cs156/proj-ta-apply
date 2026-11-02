package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.fake.FakeAllocationsService;
import edu.ucsb.cs.taapply.services.fake.FakeAllocationsService.Estimates;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = DeveloperAllocationsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class DeveloperAllocationsControllerTests extends ControllerTestCase {

  @MockitoBean DeveloperModeService developerModeService;
  @MockitoBean FakeAllocationsService fakeAllocationsService;
  @MockitoBean UserRepository userRepository;

  private static final String URL =
      "/api/admin/developer/fakeAllocations?recruitmentId=7&hiringTarget=5&estimates=MAX";

  @Test
  public void logged_out_users_cannot_fake_allocations() throws Exception {
    mockMvc.perform(post(URL).with(csrf())).andExpect(status().is(403));
    verify(fakeAllocationsService, never()).fake(any(), anyInt(), any(), anyBoolean());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_fake_allocations() throws Exception {
    mockMvc.perform(post(URL).with(csrf())).andExpect(status().is(403));
    verify(fakeAllocationsService, never()).fake(any(), anyInt(), any(), anyBoolean());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void it_is_a_404_when_developer_mode_is_not_on() throws Exception {
    when(developerModeService.isOn()).thenReturn(false);

    MvcResult response =
        mockMvc.perform(post(URL).with(csrf())).andExpect(status().isNotFound()).andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Developer mode is not on", json.get("message"));
    verify(fakeAllocationsService, never()).fake(any(), anyInt(), any(), anyBoolean());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_fakes_allocations_and_gets_the_courses_back() throws Exception {
    when(developerModeService.isOn()).thenReturn(true);
    List<RecruitmentCourse> courses =
        List.of(RecruitmentCourse.builder().id(1L).recruitmentId(7L).allocation(5).build());
    when(fakeAllocationsService.fake(7L, 5, Estimates.MAX, false)).thenReturn(courses);

    MvcResult response =
        mockMvc.perform(post(URL).with(csrf())).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(courses), response.getResponse().getContentAsString());
    verify(fakeAllocationsService).fake(7L, 5, Estimates.MAX, false);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_estimate_choice_and_visibility_flag_are_passed_on() throws Exception {
    when(developerModeService.isOn()).thenReturn(true);
    when(fakeAllocationsService.fake(7L, 3, Estimates.KEEP, true)).thenReturn(List.of());

    mockMvc
        .perform(
            post("/api/admin/developer/fakeAllocations?recruitmentId=7&hiringTarget=3"
                    + "&estimates=KEEP&setVisibility=true")
                .with(csrf()))
        .andExpect(status().isOk());

    verify(fakeAllocationsService).fake(7L, 3, Estimates.KEEP, true);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_refused_target_is_a_400_with_the_services_message() throws Exception {
    when(developerModeService.isOn()).thenReturn(true);
    when(fakeAllocationsService.fake(7L, 5, Estimates.MAX, false))
        .thenThrow(new IllegalArgumentException("hiringTarget must be between 1 and 3"));

    MvcResult response =
        mockMvc.perform(post(URL).with(csrf())).andExpect(status().isBadRequest()).andReturn();

    assertEquals("hiringTarget must be between 1 and 3", responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_recruitment_is_a_404() throws Exception {
    when(developerModeService.isOn()).thenReturn(true);
    when(fakeAllocationsService.fake(7L, 5, Estimates.MAX, false))
        .thenThrow(new EntityNotFoundException(edu.ucsb.cs.taapply.entity.Recruitment.class, 7L));

    MvcResult response =
        mockMvc.perform(post(URL).with(csrf())).andExpect(status().isNotFound()).andReturn();

    assertEquals("Recruitment with id 7 not found", responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_estimate_choice_is_a_400() throws Exception {
    when(developerModeService.isOn()).thenReturn(true);

    mockMvc
        .perform(
            post("/api/admin/developer/fakeAllocations?recruitmentId=7&hiringTarget=5"
                    + "&estimates=GUESS")
                .with(csrf()))
        .andExpect(status().isBadRequest());

    verify(fakeAllocationsService, never()).fake(any(), anyInt(), any(), anyBoolean());
  }
}
