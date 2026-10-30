package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.UCSBAPIQuarter;
import edu.ucsb.cs.taapply.repository.UCSBAPIQuarterRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.UcsbQuarterService;
import edu.ucsb.cs.taapply.testconfig.TestConfig;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = UCSBAPIQuarterController.class)
@Import(TestConfig.class)
public class UCSBAPIQuarterControllerTests extends ControllerTestCase {

  @MockitoBean UCSBAPIQuarterRepository repository;
  @MockitoBean UcsbQuarterService ucsbQuarterService;
  @MockitoBean UserRepository userRepository;

  private static UCSBAPIQuarter quarter(String yyyyq, String qyy, String name) {
    return UCSBAPIQuarter.builder()
        .quarter(yyyyq)
        .qyy(qyy)
        .name(name)
        .category(name.split(" ")[0])
        .academicYear("2021-2022")
        .firstDayOfQuarter(LocalDateTime.of(2021, 9, 26, 0, 0))
        .pass1Begin(LocalDateTime.of(2021, 5, 10, 9, 0))
        .build();
  }

  private static final UCSBAPIQuarter F21 = quarter("20214", "F21", "FALL 2021");
  private static final UCSBAPIQuarter W22 = quarter("20221", "W22", "WINTER 2022");

  @Test
  public void logged_out_users_cannot_list_or_refresh() throws Exception {
    mockMvc.perform(get("/api/admin/quarters/all")).andExpect(status().is(403));
    mockMvc.perform(post("/api/admin/quarters/refresh").with(csrf())).andExpect(status().is(403));
    verify(ucsbQuarterService, never()).refreshThroughEnd();
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_list_or_refresh() throws Exception {
    mockMvc.perform(get("/api/admin/quarters/all")).andExpect(status().is(403));
    mockMvc.perform(post("/api/admin/quarters/refresh").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_list() throws Exception {
    mockMvc.perform(get("/api/admin/quarters/all")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_lists_newest_first_by_default() throws Exception {
    when(repository.findAllByOrderByQuarterDesc()).thenReturn(List.of(W22, F21));

    MvcResult response =
        mockMvc.perform(get("/api/admin/quarters/all")).andExpect(status().isOk()).andReturn();

    verify(repository, times(1)).findAllByOrderByQuarterDesc();
    verify(repository, never()).findAllByOrderByQuarterAsc();
    assertEquals(
        mapper.writeValueAsString(List.of(W22, F21)), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void direction_asc_lists_oldest_first_and_is_case_insensitive() throws Exception {
    when(repository.findAllByOrderByQuarterAsc()).thenReturn(List.of(F21, W22));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/quarters/all?direction=ASC"))
            .andExpect(status().isOk())
            .andReturn();

    verify(repository, times(1)).findAllByOrderByQuarterAsc();
    verify(repository, never()).findAllByOrderByQuarterDesc();
    assertEquals(
        mapper.writeValueAsString(List.of(F21, W22)), response.getResponse().getContentAsString());

    when(repository.findAllByOrderByQuarterDesc()).thenReturn(List.of(W22, F21));
    mockMvc.perform(get("/api/admin/quarters/all?direction=Desc")).andExpect(status().isOk());
    verify(repository, times(1)).findAllByOrderByQuarterDesc();
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_direction_that_is_not_asc_or_desc_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(get("/api/admin/quarters/all?direction=sideways"))
            .andExpect(status().isBadRequest())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("direction must be asc or desc, not sideways", json.get("message"));
    verify(repository, never()).findAllByOrderByQuarterAsc();
    verify(repository, never()).findAllByOrderByQuarterDesc();
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void refresh_returns_what_the_service_did() throws Exception {
    UcsbQuarterService.QuarterRefresh refresh =
        new UcsbQuarterService.QuarterRefresh("20214", "20221", List.of(F21, W22));
    when(ucsbQuarterService.refreshThroughEnd()).thenReturn(refresh);

    MvcResult response =
        mockMvc
            .perform(post("/api/admin/quarters/refresh").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(ucsbQuarterService, times(1)).refreshThroughEnd();
    assertEquals(mapper.writeValueAsString(refresh), response.getResponse().getContentAsString());
    Map<String, Object> json = responseToJson(response);
    assertEquals("20214", json.get("start"));
    assertEquals("20221", json.get("end"));
    assertEquals(2, ((List<?>) json.get("quarters")).size());
    assertEquals("20214", refresh.start());
    assertEquals("20221", refresh.end());
    assertEquals(List.of(F21, W22), refresh.quarters());
  }
}
