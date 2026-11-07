package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
@Import({
  edu.ucsb.cs.taapply.testconfig.TestConfig.class,
  BudgetControllerTests.DetectorConfig.class
})
public class BudgetControllerTests extends ControllerTestCase {

  /** The application's own detector, but one that can be emptied between tests and mutations. */
  @org.springframework.boot.test.context.TestConfiguration
  static class DetectorConfig {
    @org.springframework.context.annotation.Bean
    DraftApplicationsControllerTests.ResettableDetector clientActivityDetector() {
      return new DraftApplicationsControllerTests.ResettableDetector();
    }
  }

  @org.springframework.beans.factory.annotation.Autowired
  DraftApplicationsControllerTests.ResettableDetector detector;

  @org.junit.jupiter.api.BeforeEach
  public void forgetWhoWasThere() {
    detector.reset();
  }

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
        new BigDecimal("3231.80"),
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

  // ---- the ULA rate, the hours per ULA and the other funds (issue #388) ----

  @Test
  public void a_new_budget_has_no_costs_rate_hours_or_other_funds_yet() {
    Budget budget = budget("0", "0", "0");
    assertEquals(null, budget.getTaCostPerQuarter());
    assertEquals(null, budget.getUlaRateDollarsPerHour());
    assertEquals(null, budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(null, budget.getGiftFundsForASEs());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_set_the_rate_the_hours_and_the_other_funds_at_once_rounded_to_cents()
      throws Exception {
    Budget budget = budget("0", "0", "0");
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    Summary summary = summary(budget);
    when(budgetService.summary(Q)).thenReturn(summary);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/budget?quarter=20264&taCostPerQuarter=13110.004"
                        + "&ulaRateDollarsPerHour=29.375"
                        + "&estimatedHoursPerULAPerQuarter=110&giftFundsForASEs=32200.5")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.estimatedCostPerULAPerQuarter").value(3231.80))
            .andReturn();

    assertEquals(new BigDecimal("13110.00"), budget.getTaCostPerQuarter());
    assertEquals(new BigDecimal("29.38"), budget.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("110.00"), budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("32200.50"), budget.getGiftFundsForASEs());
    // The subzero lines were not given, so they are as they were.
    assertEquals(new BigDecimal("0"), budget.getUnrestrictedBudget());
    InOrder inOrder = inOrder(budgetRepository, budgetService);
    inOrder.verify(budgetRepository).save(budget);
    inOrder.verify(budgetService).summary(Q);
    assertEquals(mapper.writeValueAsString(summary), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void each_of_the_rate_the_hours_and_the_other_funds_is_set_on_its_own_and_the_rest_kept()
      throws Exception {
    Budget budget = budget("1.00", "2.00", "3.00");
    budget.setUlaRateDollarsPerHour(new BigDecimal("10.00"));
    budget.setEstimatedHoursPerULAPerQuarter(new BigDecimal("20.00"));
    budget.setGiftFundsForASEs(new BigDecimal("30.00"));
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&ulaRateDollarsPerHour=11").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("11.00"), budget.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("20.00"), budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("30.00"), budget.getGiftFundsForASEs());

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20264&estimatedHoursPerULAPerQuarter=22").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("11.00"), budget.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("22.00"), budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("30.00"), budget.getGiftFundsForASEs());

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&giftFundsForASEs=0").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("11.00"), budget.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("22.00"), budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("0.00"), budget.getGiftFundsForASEs());

    // A subzero line leaves all three alone.
    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&tasOnlyBudget=5").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(new BigDecimal("11.00"), budget.getUlaRateDollarsPerHour());
    assertEquals(new BigDecimal("22.00"), budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(new BigDecimal("0.00"), budget.getGiftFundsForASEs());
    assertEquals(new BigDecimal("5.00"), budget.getTasOnlyBudget());
    assertEquals(new BigDecimal("1.00"), budget.getUnrestrictedBudget());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_negative_rate_hours_or_other_funds_is_a_400_and_nothing_is_read_or_saved()
      throws Exception {
    for (String field :
        List.of(
            "taCostPerQuarter",
            "ulaRateDollarsPerHour",
            "estimatedHoursPerULAPerQuarter",
            "giftFundsForASEs")) {
      MvcResult response =
          mockMvc
              .perform(
                  put("/api/admin/budget?quarter=20264&" + field + "=-0.01&tasOnlyBudget=5")
                      .with(csrf()))
              .andExpect(status().isBadRequest())
              .andReturn();
      assertEquals(field + " must not be negative", responseToJson(response).get("message"));
    }
    verify(budgetService, never()).budgetFor(any());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_rate_the_hours_and_the_other_funds_are_lines_counted_under_version()
      throws Exception {
    for (String line :
        List.of(
            "taCostPerQuarter",
            "ulaRateDollarsPerHour",
            "estimatedHoursPerULAPerQuarter",
            "giftFundsForASEs")) {
      Budget budget = versioned(5, 2);
      when(budgetService.budgetFor(Q)).thenReturn(budget);
      when(budgetService.summary(Q)).thenReturn(summary(budget));

      mockMvc
          .perform(put("/api/admin/budget?quarter=20264&version=5&" + line + "=7").with(csrf()))
          .andExpect(status().isOk());
      assertEquals(6, budget.getVersion(), line);
      assertEquals(2, budget.getConversionVersion(), line);

      // And a stale version refuses it, leaving the figure as it was.
      mockMvc
          .perform(put("/api/admin/budget?quarter=20264&version=5&" + line + "=8").with(csrf()))
          .andExpect(status().isConflict());
      assertEquals(6, budget.getVersion(), line);
    }
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_stale_version_leaves_the_rate_the_hours_and_the_other_funds_as_they_were()
      throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20264&version=4&taCostPerQuarter=0"
                    + "&ulaRateDollarsPerHour=1&estimatedHoursPerULAPerQuarter=2&giftFundsForASEs=3")
                .with(csrf()))
        .andExpect(status().isConflict());

    assertEquals(null, budget.getTaCostPerQuarter());
    assertEquals(null, budget.getUlaRateDollarsPerHour());
    assertEquals(null, budget.getEstimatedHoursPerULAPerQuarter());
    assertEquals(null, budget.getGiftFundsForASEs());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_summary_carries_the_rate_the_hours_the_other_funds_and_the_computed_cost()
      throws Exception {
    Budget budget = budget("1000.00", "0.00", "0.00");
    budget.setTaCostPerQuarter(new BigDecimal("13110.00"));
    budget.setUlaRateDollarsPerHour(new BigDecimal("29.38"));
    budget.setEstimatedHoursPerULAPerQuarter(new BigDecimal("110.00"));
    budget.setGiftFundsForASEs(new BigDecimal("32200.00"));
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(get("/api/admin/budget?quarter=20264"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.budget.taCostPerQuarter").value(13110.00))
        .andExpect(jsonPath("$.budget.ulaRateDollarsPerHour").value(29.38))
        .andExpect(jsonPath("$.budget.estimatedHoursPerULAPerQuarter").value(110.00))
        .andExpect(jsonPath("$.budget.giftFundsForASEs").value(32200.00))
        .andExpect(jsonPath("$.estimatedCostPerULAPerQuarter").value(3231.80));
  }

  // ---- the conversion factor (issue #358) ----

  @Test
  public void a_new_budget_converts_three_ulas_to_one_ta() {
    assertEquals(3.0, budget("0", "0", "0").getConversionTAtoULA());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_set_the_conversion_factor_and_the_other_lines_keep_their_values()
      throws Exception {
    Budget budget = budget("1.00", "2.00", "3.00");
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&conversionTAtoULA=2.5").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(2.5, budget.getConversionTAtoULA());
    assertEquals(new BigDecimal("2.00"), budget.getTasOnlyBudget());
    verify(budgetRepository).save(budget);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_save_without_a_conversion_factor_leaves_it_alone() throws Exception {
    Budget budget = budget("1.00", "2.00", "3.00");
    budget.setConversionTAtoULA(1.5);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&tasOnlyBudget=7").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(1.5, budget.getConversionTAtoULA());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_conversion_factor_that_is_not_greater_than_zero_is_a_400() throws Exception {
    for (String bad : List.of("0", "-1", "-0.5", "NaN", "Infinity", "0.0")) {
      MvcResult response =
          mockMvc
              .perform(put("/api/admin/budget?quarter=20264&conversionTAtoULA=" + bad).with(csrf()))
              .andExpect(status().isBadRequest())
              .andReturn();
      assertEquals(
          "conversionTAtoULA must be greater than zero", responseToJson(response).get("message"));
    }
    verify(budgetService, never()).budgetFor(any());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_conversion_factor_that_is_not_a_number_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&conversionTAtoULA=abc").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_stale_version_stops_a_conversion_factor_change_too() throws Exception {
    // Each count is checked whenever it is given, whatever fields come with it.
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20264&version=4&conversionVersion=2&conversionTAtoULA=2")
                .with(csrf()))
        .andExpect(status().isConflict());

    assertEquals(3.0, budget.getConversionTAtoULA());
    assertEquals(2, budget.getConversionVersion());
    verify(budgetRepository, never()).save(any());
  }

  // ---- the conversion factor's own count (issue #375) ----

  @Test
  public void a_new_budget_starts_both_counts_at_zero() {
    Budget budget = Budget.builder().quarter(Q).build();
    assertEquals(0, budget.getVersion());
    assertEquals(0, budget.getConversionVersion());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_factor_save_with_the_current_conversion_version_is_applied_and_counts_only_that()
      throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20264&conversionVersion=2&conversionTAtoULA=2.5")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(2.5, budget.getConversionTAtoULA());
    assertEquals(3, budget.getConversionVersion());
    assertEquals(5, budget.getVersion(), "the lines' version is not touched");
    verify(budgetRepository).save(budget);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_factor_save_with_a_stale_conversion_version_is_a_409_even_if_version_is_current()
      throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/budget?quarter=20264&version=5&conversionVersion=1"
                        + "&conversionTAtoULA=2.5")
                    .with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.version").value(5))
            .andExpect(jsonPath("$.conversionVersion").value(2))
            .andExpect(jsonPath("$.summary.budget.version").value(5))
            .andExpect(jsonPath("$.summary.budget.conversionVersion").value(2))
            .andReturn();

    assertEquals(
        "This budget was changed in another tab or window. Use theirs, or overwrite with yours.",
        responseToJson(response).get("message"));
    assertEquals(3.0, budget.getConversionTAtoULA());
    assertEquals(2, budget.getConversionVersion());
    assertEquals(5, budget.getVersion());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_line_save_with_a_stale_version_is_a_409_even_if_conversion_version_is_current()
      throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20264&version=4&conversionVersion=2&tasOnlyBudget=7")
                .with(csrf()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.version").value(5))
        .andExpect(jsonPath("$.conversionVersion").value(2));

    assertEquals(new BigDecimal("2.00"), budget.getTasOnlyBudget());
    assertEquals(5, budget.getVersion());
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_line_save_counts_the_lines_and_not_the_factor_whichever_line_it_is()
      throws Exception {
    for (String line : List.of("unrestrictedBudget", "tasOnlyBudget", "ulasOnlyBudget")) {
      Budget budget = versioned(5, 2);
      when(budgetService.budgetFor(Q)).thenReturn(budget);
      when(budgetService.summary(Q)).thenReturn(summary(budget));

      mockMvc
          .perform(put("/api/admin/budget?quarter=20264&version=5&" + line + "=7").with(csrf()))
          .andExpect(status().isOk());

      assertEquals(6, budget.getVersion(), line);
      assertEquals(2, budget.getConversionVersion(), line);
      assertEquals(3.0, budget.getConversionTAtoULA(), line);
    }
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_save_that_gives_lines_and_the_factor_counts_both() throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20264&version=5&conversionVersion=2"
                    + "&unrestrictedBudget=1&ulasOnlyBudget=2&conversionTAtoULA=4")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(6, budget.getVersion());
    assertEquals(3, budget.getConversionVersion());
    assertEquals(4.0, budget.getConversionTAtoULA());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_save_that_gives_nothing_counts_nothing() throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&version=5&conversionVersion=2").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(5, budget.getVersion());
    assertEquals(2, budget.getConversionVersion());
    verify(budgetRepository).save(budget);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_summary_carries_both_counts() throws Exception {
    Budget budget = versioned(5, 2);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(get("/api/admin/budget?quarter=20264"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.budget.version").value(5))
        .andExpect(jsonPath("$.budget.conversionVersion").value(2));
  }

  @Test
  public void logged_out_users_cannot_change_the_conversion_factor() throws Exception {
    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&conversionTAtoULA=2").with(csrf()))
        .andExpect(status().is(403));
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_the_conversion_factor() throws Exception {
    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&conversionTAtoULA=2").with(csrf()))
        .andExpect(status().is(403));
    verify(budgetRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_summary_carries_the_conversion_factor_under_that_name() throws Exception {
    Budget budget = budget("1000.00", "0.00", "0.00");
    budget.setConversionTAtoULA(2.0);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(get("/api/admin/budget?quarter=20264"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.budget.conversionTAtoULA").value(2.0));
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

  // ---- the version check (issue #277) ----

  private static Budget versioned(int version) {
    return versioned(version, 0);
  }

  private static Budget versioned(int version, int conversionVersion) {
    Budget budget = budget("1.00", "2.00", "3.00");
    budget.setVersion(version);
    budget.setConversionVersion(conversionVersion);
    return budget;
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_save_with_the_current_version_is_applied_and_counts_one_more() throws Exception {
    Budget budget = versioned(4);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    when(budgetService.summary(Q)).thenReturn(summary(budget));

    mockMvc
        .perform(put("/api/admin/budget?quarter=20264&version=4&tasOnlyBudget=7").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(new BigDecimal("7.00"), budget.getTasOnlyBudget());
    assertEquals(5, budget.getVersion());
    assertEquals(0, budget.getConversionVersion());
    verify(budgetRepository).save(budget);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_save_with_a_stale_version_changes_nothing_and_is_a_409_with_the_current_summary()
      throws Exception {
    Budget budget = versioned(5);
    when(budgetService.budgetFor(Q)).thenReturn(budget);
    Summary summary = summary(budget);
    when(budgetService.summary(Q)).thenReturn(summary);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/budget?quarter=20264&version=4&tasOnlyBudget=7").with(csrf()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.version").value(5))
            .andExpect(jsonPath("$.conversionVersion").value(0))
            .andExpect(jsonPath("$.summary.quarter").value(Q))
            .andReturn();

    assertEquals(
        "This budget was changed in another tab or window. Use theirs, or overwrite with yours.",
        responseToJson(response).get("message"));
    assertEquals(new BigDecimal("2.00"), budget.getTasOnlyBudget());
    assertEquals(5, budget.getVersion());
    verify(budgetRepository, never()).save(any());
  }

  // ---- the multi-tab warning (issue #277) ----

  private org.springframework.test.web.servlet.ResultActions heartbeat(
      String quarter, String clientId) throws Exception {
    return mockMvc.perform(
        post("/api/admin/budget/heartbeat?quarter=" + quarter)
            .header("X-Client-Id", clientId)
            .with(csrf()));
  }

  private void quarterExists(String quarter) {
    when(budgetService.budgetFor(quarter)).thenReturn(budget("0", "0", "0"));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void a_heartbeat_from_the_only_tab_finds_no_one_else() throws Exception {
    quarterExists("20301");
    heartbeat("20301", "only-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.heartbeatSeconds").value(5))
        .andExpect(jsonPath("$.newest").value(true));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void an_admin_sees_the_names_of_the_other_admins_on_the_same_quarter() throws Exception {
    quarterExists("20302");
    detector.record(
        "budget:20302",
        "their-tab",
        new edu.ucsb.cs.taapply.concurrency.ClientIdentity(
            "phtcon@ucsb.edu", "phtcon@ucsb.edu (Phill Conrad)"));

    heartbeat("20302", "my-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("phtcon@ucsb.edu (Phill Conrad)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void my_own_other_tab_is_marked_as_the_same_person() throws Exception {
    quarterExists("20303");
    heartbeat("20303", "first-tab");
    heartbeat("20303", "second-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void another_quarter_never_warns() throws Exception {
    quarterExists("20304");
    quarterExists("20305");
    heartbeat("20304", "tab-a");
    heartbeat("20305", "tab-b").andExpect(jsonPath("$.others.length()").value(0));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void a_save_counts_as_being_there_for_the_others_heartbeats() throws Exception {
    Budget budget = budget("0", "0", "0");
    when(budgetService.budgetFor("20306")).thenReturn(budget);
    when(budgetService.summary("20306")).thenReturn(summary(budget));

    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20306&tasOnlyBudget=1")
                .header("X-Client-Id", "saving-tab")
                .with(csrf()))
        .andExpect(status().isOk());

    heartbeat("20306", "idle-tab").andExpect(jsonPath("$.others.length()").value(1));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void a_tab_that_leaves_is_forgotten_at_once() throws Exception {
    quarterExists("20307");
    heartbeat("20307", "staying-tab");
    heartbeat("20307", "leaving-tab");

    mockMvc
        .perform(
            post("/api/admin/budget/leave?quarter=20307")
                .header("X-Client-Id", "leaving-tab")
                .with(csrf()))
        .andExpect(status().isNoContent());

    heartbeat("20307", "staying-tab").andExpect(jsonPath("$.others.length()").value(0));
  }

  @WithMockUser(
      username = "admin1",
      roles = {"ADMIN"})
  @Test
  public void a_quarter_with_no_recruitment_has_no_heartbeat() throws Exception {
    when(budgetService.budgetFor("20111"))
        .thenThrow(new EntityNotFoundException("No recruitment for quarter 20111"));
    heartbeat("20111", "a-tab").andExpect(status().isNotFound());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_caller_who_may_not_open_the_budget_gets_403_and_nothing_is_recorded()
      throws Exception {
    quarterExists("20308");
    heartbeat("20308", "probing-tab").andExpect(status().isForbidden());
    mockMvc
        .perform(
            put("/api/admin/budget?quarter=20308&tasOnlyBudget=1")
                .header("X-Client-Id", "probing-tab")
                .with(csrf()))
        .andExpect(status().isForbidden());

    assertEquals(
        0, detector.othersActive("budget:20308", "someone-else").size(), "nothing was recorded");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_caller_who_may_not_open_the_budget_cannot_remove_anyone_by_saying_goodbye()
      throws Exception {
    detector.record(
        "budget:20309",
        "admin-tab",
        new edu.ucsb.cs.taapply.concurrency.ClientIdentity("a@ucsb.edu", "a@ucsb.edu"));

    mockMvc
        .perform(
            post("/api/admin/budget/leave?quarter=20309")
                .header("X-Client-Id", "admin-tab")
                .with(csrf()))
        .andExpect(status().isForbidden());

    assertEquals(1, detector.othersActive("budget:20309", "someone-else").size());
  }

  @Test
  public void logged_out_users_cannot_heartbeat_or_leave() throws Exception {
    mockMvc
        .perform(post("/api/admin/budget/heartbeat?quarter=20310").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(post("/api/admin/budget/leave?quarter=20310").with(csrf()))
        .andExpect(status().is(403));
  }

  /** A signed-in admin whose account has the given name, or none. */
  private static org.springframework.test.web.servlet.request.RequestPostProcessor adminNamed(
      String email, String name) {
    return org.springframework.security.test.web.servlet.request
        .SecurityMockMvcRequestPostProcessors.oauth2Login()
        .authorities(
            new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))
        .attributes(
            attributes -> {
              attributes.put("sub", "sub-" + email);
              attributes.put("email", email);
              if (name != null) {
                attributes.put("name", name);
              }
            });
  }

  @Test
  public void an_admin_with_a_name_is_labelled_by_the_email_and_the_trimmed_name()
      throws Exception {
    quarterExists("20311");
    mockMvc
        .perform(
            post("/api/admin/budget/heartbeat?quarter=20311")
                .header("X-Client-Id", "named-tab")
                .with(adminNamed("named@example.org", "  Nora Named  "))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(
        List.of(
            new edu.ucsb.cs.taapply.concurrency.OtherClient(
                "named@example.org (Nora Named)", false, true)),
        detector.othersActive("budget:20311", "observer"));
  }

  @Test
  public void an_admin_with_no_name_or_a_blank_one_is_labelled_by_the_email_alone()
      throws Exception {
    quarterExists("20312");
    mockMvc
        .perform(
            post("/api/admin/budget/heartbeat?quarter=20312")
                .header("X-Client-Id", "nameless-tab")
                .with(adminNamed("nameless@example.org", null))
                .with(csrf()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/admin/budget/heartbeat?quarter=20312")
                .header("X-Client-Id", "blank-tab")
                .with(adminNamed("blank@example.org", "   "))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(
        List.of(
            new edu.ucsb.cs.taapply.concurrency.OtherClient("blank@example.org", false, true),
            new edu.ucsb.cs.taapply.concurrency.OtherClient("nameless@example.org", false, true)),
        detector.othersActive("budget:20312", "observer"));
  }
}
