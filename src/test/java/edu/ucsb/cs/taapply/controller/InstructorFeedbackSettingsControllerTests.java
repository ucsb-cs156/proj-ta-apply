package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.InstructorFeedbackSettings;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackSettingsRepository;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

@WebMvcTest(controllers = InstructorFeedbackSettingsController.class)
public class InstructorFeedbackSettingsControllerTests extends ControllerTestCase {

  @MockitoBean InstructorFeedbackSettingsRepository instructorFeedbackSettingsRepository;
  @MockitoBean BudgetRepository budgetRepository;
  @MockitoBean CurrentUserService currentUserService;

  private static final String ADMIN_EMAIL = "admin@ucsb.edu";

  private static InstructorFeedbackSettings version(long id, String editor, String notes) {
    return InstructorFeedbackSettings.builder()
        .id(id)
        .createdAt(LocalDateTime.of(2026, 11, 9, 10, 30, 0))
        .editorEmail(editor)
        .notesText(notes)
        .build();
  }

  private static final InstructorFeedbackSettings V1 =
      version(1L, null, "TAs cost ${estimatedCostPerTA}.");
  private static final InstructorFeedbackSettings V2 =
      version(2L, ADMIN_EMAIL, "# Notes\n\nA TA is ${taToUlaCostRatio} ULAs.");

  @BeforeEach
  void signedIn() {
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email(ADMIN_EMAIL).build())
                .roles(List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
                .build());
  }

  private ResultActions save(String body) throws Exception {
    return mockMvc.perform(
        post("/api/admin/instructorFeedbackSettings")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private InstructorFeedbackSettings saved() {
    ArgumentCaptor<InstructorFeedbackSettings> captor =
        ArgumentCaptor.forClass(InstructorFeedbackSettings.class);
    verify(instructorFeedbackSettingsRepository).save(captor.capture());
    return captor.getValue();
  }

  private void savesEcho() {
    when(instructorFeedbackSettingsRepository.save(any())).thenAnswer(call -> call.getArgument(0));
  }

  // ---- who may ask ----

  @Test
  public void logged_out_users_are_refused_everywhere() throws Exception {
    mockMvc.perform(get("/api/instructor/feedback/settings")).andExpect(status().is(403));
    mockMvc.perform(get("/api/admin/instructorFeedbackSettings/all")).andExpect(status().is(403));
    mockMvc
        .perform(get("/api/admin/instructorFeedbackSettings/costs?quarter=20261"))
        .andExpect(status().is(403));
    save("{\"notesText\":\"x\"}").andExpect(status().is(403));
    verify(instructorFeedbackSettingsRepository, never()).save(any());
  }

  /** Instructors read the settings in force, but not the history, and cannot save. */
  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void instructors_cannot_see_the_history_the_preview_costs_or_save() throws Exception {
    mockMvc.perform(get("/api/admin/instructorFeedbackSettings/all")).andExpect(status().is(403));
    mockMvc
        .perform(get("/api/admin/instructorFeedbackSettings/costs?quarter=20261"))
        .andExpect(status().is(403));
    save("{\"notesText\":\"x\"}").andExpect(status().is(403));
    verify(instructorFeedbackSettingsRepository, never()).save(any());
  }

  /** The current settings are for instructors: an admin who is not one is refused. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void admins_who_are_not_instructors_cannot_read_the_instructors_endpoint()
      throws Exception {
    mockMvc.perform(get("/api/instructor/feedback/settings")).andExpect(status().is(403));
  }

  // ---- current ----

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void current_is_the_newest_version_as_a_one_element_list() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(V2));

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/feedback/settings"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(V2)), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void current_is_empty_when_there_is_no_version() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/feedback/settings"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
  }

  // ---- history ----

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_history_is_every_version_newest_first() throws Exception {
    when(instructorFeedbackSettingsRepository.findAllByOrderByIdDesc()).thenReturn(List.of(V2, V1));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/instructorFeedbackSettings/all"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(V2, V1)), response.getResponse().getContentAsString());
    JsonNode first = mapper.readTree(response.getResponse().getContentAsString()).get(0);
    assertEquals(2, first.get("id").asInt());
    assertEquals("2026-11-09T10:30:00", first.get("createdAt").asText());
    assertEquals(ADMIN_EMAIL, first.get("editorEmail").asText());
    assertEquals("# Notes\n\nA TA is ${taToUlaCostRatio} ULAs.", first.get("notesText").asText());
  }

  // ---- save ----

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void saving_appends_a_new_version_with_the_trimmed_text_the_time_and_the_editor()
      throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(V1));
    when(instructorFeedbackSettingsRepository.save(any()))
        .thenAnswer(
            call -> {
              InstructorFeedbackSettings row = call.getArgument(0);
              row.setId(3L);
              return row;
            });

    LocalDateTime before = LocalDateTime.now(edu.ucsb.cs.taapply.time.AppTime.ZONE);
    MvcResult response =
        save("{\"notesText\":\"  # New notes\\n\\n${quarter}  \"}")
            .andExpect(status().isOk())
            .andReturn();

    InstructorFeedbackSettings row = saved();
    assertEquals("# New notes\n\n${quarter}", row.getNotesText());
    assertEquals(ADMIN_EMAIL, row.getEditorEmail());
    assertTrue(
        Duration.between(before, row.getCreatedAt()).abs().getSeconds() < 60,
        "created now, in Pacific time");
    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals(3, json.get("id").asInt());
    assertEquals("# New notes\n\n${quarter}", json.get("notesText").asText());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void a_new_version_never_reuses_the_id_of_the_newest() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(V2));
    savesEcho();

    save("{\"notesText\":\"Changed\"}").andExpect(status().isOk());

    assertNull(saved().getId());
  }

  /**
   * A field the body leaves out keeps the newest version's value (issue #430 saves one at once).
   */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void notes_left_out_are_copied_from_the_newest_version() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(V2));
    savesEcho();

    save("{}").andExpect(status().isOk());

    InstructorFeedbackSettings row = saved();
    assertEquals(V2.getNotesText(), row.getNotesText());
    assertEquals(ADMIN_EMAIL, row.getEditorEmail());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void notes_may_be_a_million_characters_but_no_more() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(V2));
    savesEcho();

    save("{\"notesText\":\"" + "x".repeat(1_000_000) + "\"}").andExpect(status().isOk());
    assertEquals(1_000_000, saved().getNotesText().length());

    MvcResult response =
        save("{\"notesText\":\"" + "x".repeat(1_000_001) + "\"}")
            .andExpect(status().is(400))
            .andReturn();
    assertEquals(
        "The notes may be at most 1000000 characters", responseToJson(response).get("message"));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void blank_notes_are_refused() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.of(V2));

    MvcResult response = save("{\"notesText\":\"  \\n \"}").andExpect(status().is(400)).andReturn();

    assertEquals("The notes cannot be blank", responseToJson(response).get("message"));
    verify(instructorFeedbackSettingsRepository, never()).save(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void notes_left_out_with_no_version_to_copy_are_refused() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.empty());

    save("{\"notesText\":null}").andExpect(status().is(400));

    verify(instructorFeedbackSettingsRepository, never()).save(any());
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_first_version_can_be_saved_when_there_is_none() throws Exception {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(Optional.empty());
    savesEcho();

    save("{\"notesText\":\"First\"}").andExpect(status().isOk());

    assertEquals("First", saved().getNotesText());
  }

  // ---- the preview's costs ----

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_preview_costs_are_the_two_figures_of_the_quarters_budget() throws Exception {
    when(budgetRepository.findById("20261"))
        .thenReturn(
            Optional.of(
                Budget.builder()
                    .quarter("20261")
                    .taCostPerQuarter(new BigDecimal("12000.00"))
                    .ulaRateDollarsPerHour(new BigDecimal("20.00"))
                    .estimatedHoursPerULAPerQuarter(new BigDecimal("100.00"))
                    .build()));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/instructorFeedbackSettings/costs?quarter=20261"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals("20261", json.get("quarter").asText());
    assertEquals(
        0, new BigDecimal("12000.00").compareTo(json.get("estimatedCostPerTA").decimalValue()));
    assertEquals(
        0, new BigDecimal("2000.00").compareTo(json.get("estimatedCostPerULA").decimalValue()));
    assertEquals(3, json.size());
  }

  /** No budget is created for the preview: a quarter without one is two nulls. */
  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void the_preview_costs_of_a_quarter_without_a_budget_are_null() throws Exception {
    when(budgetRepository.findById("20262")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/instructorFeedbackSettings/costs?quarter=20262"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals("20262", json.get("quarter").asText());
    assertTrue(json.get("estimatedCostPerTA").isNull());
    assertTrue(json.get("estimatedCostPerULA").isNull());
    verify(budgetRepository, never()).save(any());
  }
}
