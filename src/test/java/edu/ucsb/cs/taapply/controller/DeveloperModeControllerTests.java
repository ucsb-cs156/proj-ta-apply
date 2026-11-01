package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.DeveloperModeService.Status;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = DeveloperModeController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class DeveloperModeControllerTests extends ControllerTestCase {

  @MockitoBean DeveloperModeService developerModeService;
  @MockitoBean UserRepository userRepository;

  // ---- GET /api/developerMode ----

  /** The footer badge is shown on every page, so the status is readable without signing in. */
  @Test
  public void logged_out_visitors_can_read_the_status() throws Exception {
    when(developerModeService.status()).thenReturn(new Status(true, true));

    MvcResult response =
        mockMvc.perform(get("/api/developerMode")).andExpect(status().isOk()).andReturn();

    assertEquals("{\"available\":true,\"on\":true}", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void users_can_read_the_status() throws Exception {
    when(developerModeService.status()).thenReturn(new Status(false, false));

    MvcResult response =
        mockMvc.perform(get("/api/developerMode")).andExpect(status().isOk()).andReturn();

    assertEquals("{\"available\":false,\"on\":false}", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_can_read_the_status() throws Exception {
    when(developerModeService.status()).thenReturn(new Status(true, false));

    MvcResult response =
        mockMvc.perform(get("/api/developerMode")).andExpect(status().isOk()).andReturn();

    assertEquals("{\"available\":true,\"on\":false}", response.getResponse().getContentAsString());
  }

  // ---- PUT /api/admin/developerMode ----

  @Test
  public void logged_out_visitors_cannot_switch() throws Exception {
    mockMvc
        .perform(put("/api/admin/developerMode?on=true").with(csrf()))
        .andExpect(status().is(403));
    verify(developerModeService, never()).setOn(anyBoolean());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_switch() throws Exception {
    mockMvc
        .perform(put("/api/admin/developerMode?on=true").with(csrf()))
        .andExpect(status().is(403));
    verify(developerModeService, never()).setOn(anyBoolean());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_switch_on() throws Exception {
    when(developerModeService.setOn(true)).thenReturn(new Status(true, true));

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/developerMode?on=true").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(developerModeService).setOn(true);
    assertEquals("{\"available\":true,\"on\":true}", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_switch_off() throws Exception {
    when(developerModeService.setOn(false)).thenReturn(new Status(true, false));

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/developerMode?on=false").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(developerModeService).setOn(false);
    assertEquals("{\"available\":true,\"on\":false}", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void switching_where_the_feature_is_not_available_is_a_404() throws Exception {
    when(developerModeService.setOn(true))
        .thenThrow(new EntityNotFoundException("Developer mode is not enabled on this instance"));

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/developerMode?on=true").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Developer mode is not enabled on this instance", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_on_parameter_is_required() throws Exception {
    mockMvc
        .perform(put("/api/admin/developerMode").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(developerModeService, never()).setOn(anyBoolean());
  }
}
