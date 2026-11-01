package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService.Link;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService.Step;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService.Steps;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = RecruitmentStepsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class RecruitmentStepsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentStepsService recruitmentStepsService;
  @MockitoBean UserRepository userRepository;

  @Test
  public void logged_out_users_cannot_read_the_steps() throws Exception {
    mockMvc.perform(get("/api/admin/recruitments/7/steps")).andExpect(status().is(403));
    verifyNoInteractions(recruitmentStepsService);
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_the_steps() throws Exception {
    mockMvc.perform(get("/api/admin/recruitments/7/steps")).andExpect(status().is(403));
    verifyNoInteractions(recruitmentStepsService);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_gets_the_steps_of_the_recruitment() throws Exception {
    Recruitment recruitment =
        Recruitment.builder().id(7L).quarter("20264").type(RecruitmentType.TA).build();
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment));
    Steps steps =
        new Steps(
            7L,
            RecruitmentType.TA,
            List.of(
                new Step(1, true, "Created: 2026-08-20", null, null, null, null, null),
                new Step(
                    9,
                    false,
                    "Not released yet",
                    null,
                    "publishAssignments",
                    null,
                    new Link("(see assignments)", "/admin/recruitments/7/courses"),
                    false)));
    when(recruitmentStepsService.stepsFor(recruitment)).thenReturn(steps);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitments/7/steps"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(steps), response.getResponse().getContentAsString());
    // Fields that do not apply are left out rather than sent as null.
    assertEquals(
        "{\"recruitmentId\":7,\"type\":\"TA\",\"steps\":[{\"number\":1,\"done\":true,"
            + "\"label\":\"Created: 2026-08-20\"},{\"number\":9,\"done\":false,"
            + "\"label\":\"Not released yet\",\"action\":\"publishAssignments\","
            + "\"secondaryLink\":{\"text\":\"(see assignments)\","
            + "\"href\":\"/admin/recruitments/7/courses\"},\"tentative\":false}]}",
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_steps_of_an_unknown_recruitment_are_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitments/99/steps"))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 99 not found", json.get("message"));
    verifyNoInteractions(recruitmentStepsService);
  }
}
