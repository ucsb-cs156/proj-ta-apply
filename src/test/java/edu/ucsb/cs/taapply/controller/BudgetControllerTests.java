package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.BudgetService;
import edu.ucsb.cs.taapply.services.BudgetService.QuarterSummary;
import edu.ucsb.cs.taapply.services.BudgetService.Side;
import edu.ucsb.cs.taapply.services.BudgetService.Summary;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = BudgetController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class BudgetControllerTests extends ControllerTestCase {

  @MockitoBean BudgetService budgetService;
  @MockitoBean BudgetRepository budgetRepository;
  @MockitoBean UserRepository userRepository;

  private static final String Q = "20264";

  private static Budget budget(String unrestricted, String tas, String ulas) {
    return Budget.builder()
        .quarter(Q)
        .unrestrictedBudget(new BigDecimal(unrestricted))
        .tasOnlyBudget(new BigDecimal(tas))
        .ulasOnlyBudget(new BigDecimal(ulas))
        .build();
  }

  private static Summary summary(Budget budget) {
    return new Summary(
        Q,
        budget,
        new Side(5L, 8, new BigDecimal("12000.00"), 9, 400, 1, 50.0, new BigDecimal("96000.00")),
        null,
        new BigDecimal("96000.00"),
        new BigDecimal("1000.00"),
        new BigDecimal("-95000.00"));
  }

  // ---- GET /api/admin/budget/quarters ----

  @Test
  public void logged_out_users_cannot_list_quarters() throws Exception {
    mockMvc.perform(get("/api/admin/budget/quarters")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_list_quarters() throws Exception {
    mockMvc.perform(get("/api/admin/budget/quarters")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_the_quarters_with_recruitments() throws Exception {
    List<QuarterSummary> quarters =
        List.of(new QuarterSummary("20264", true, true), new QuarterSummary("20262", false, true));
    when(budgetService.quarters()).thenReturn(quarters);

    MvcResult response =
        mockMvc.perform(get("/api/admin/budget/quarters")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(quarters), response.getResponse().getContentAsString());
  }

  // ---- GET /api/admin/budget ----

  @Test
  public void logged_out_users_cannot_read_a_budget() throws Exception {
    mockMvc.perform(get("/api/admin/budget?quarter=20264")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_read_a_budget() throws Exception {
    mockMvc.perform(get("/api/admin/budget?quarter=20264")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_the_summary_for_a_quarter() throws Exception {
    Summary summary = summary(budget("1000.00", "0.00", "0.00"));
    when(budgetService.summary(Q)).thenReturn(summary);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/budget?quarter=20264"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(summary), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_quarter_with_no_recruitment_is_a_404() throws Exception {
    when(budgetService.summary("20111"))
        .thenThrow(new EntityNotFoundException("No recruitment for quarter 20111"));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/budget?quarter=20111"))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("No recruitment for quarter 20111", json.get("message"));
  }

  // ---- PUT /api/admin/budget ----

  @Test
  public void logged_out_users_cannot_change_a_budget() throws Exception {
    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&unrestrictedBudget=5").with(csrf()))
        .andExpect(status().is(403));
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_a_budget() throws Exception {
    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&unrestrictedBudget=5").with(csrf()))
        .andExpect(status().is(403));
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_set_all_three_lines_at_once_rounded_to_cents() throws Exception {
    Budget budget = budget("0", "0", "0");
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    Summary summary = summary(budget);
    when(budgetService.summary(Q)).thenReturn(summary);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/budget?quarter=20264&unrestrictedBudget=100000"
                        + "&tasOnlyBudget=20000.255&ulasOnlyBudget=5000.5")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(new BigDecimal("100000.00"), budget.getUnrestrictedBudget());
    assertEquals(new BigDecimal("20000.26"), budget.getTasOnlyBudget());
    assertEquals(new BigDecimal("5000.50"), budget.getUlasOnlyBudget());
    // Saved before the summary is recomputed, so the response shows the new figures.
    InOrder inOrder = inOrder(budgetRepository, budgetService);
    inOrder.verify(budgetRepository).save(budget);
    inOrder.verify(budgetService).summary(Q);
    assertEquals(mapper.writeValueAsString(summary), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void lines_not_given_keep_their_values() throws Exception {
    Budget budget = budget("1.00", "2.00", "3.00");
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&tasOnlyBudget=0").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("1.00"), budget.getUnrestrictedBudget());
    assertEquals(new BigDecimal("0.00"), budget.getTasOnlyBudget());
    assertEquals(new BigDecimal("3.00"), budget.getUlasOnlyBudget());

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&ulasOnlyBudget=9.99").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("1.00"), budget.getUnrestrictedBudget());
    assertEquals(new BigDecimal("0.00"), budget.getTasOnlyBudget());
    assertEquals(new BigDecimal("9.99"), budget.getUlasOnlyBudget());

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&unrestrictedBudget=4.5").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("4.50"), budget.getUnrestrictedBudget());
    assertEquals(new BigDecimal("0.00"), budget.getTasOnlyBudget());
    assertEquals(new BigDecimal("9.99"), budget.getUlasOnlyBudget());

    mockMvc.perform(put("/api/admin/budget?quarter=20264").with(csrf())).andExpect(status().isOk());
    assertEquals(new BigDecimal("4.50"), budget.getUnrestrictedBudget());
    assertEquals(new BigDecimal("0.00"), budget.getTasOnlyBudget());
    assertEquals(new BigDecimal("9.99"), budget.getUlasOnlyBudget());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_negative_unrestricted_budget_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/budget?quarter=20264&unrestrictedBudget=-0.01&tasOnlyBudget=5")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "unrestrictedBudget must not be negative", responseToJson(response).get("message"));
    verify(budgetService, never()).budgetFor(any());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_negative_tas_only_budget_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(put("/api/admin/budget?quarter=20264&tasOnlyBudget=-5").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals("tasOnlyBudget must not be negative", responseToJson(response).get("message"));
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_negative_ulas_only_budget_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(put("/api/admin/budget?quarter=20264&ulasOnlyBudget=-5").with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals("ulasOnlyBudget must not be negative", responseToJson(response).get("message"));
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_the_budget_of_a_quarter_with_no_recruitment_is_a_404() throws Exception {
    when(budgetService.budgetFor("20111"))
        .thenThrow(new EntityNotFoundException("No recruitment for quarter 20111"));

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/budget?quarter=20111&unrestrictedBudget=5").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals("No recruitment for quarter 20111", responseToJson(response).get("message"));
    verify(budgetRepository, never()).save(any());
  }
}
