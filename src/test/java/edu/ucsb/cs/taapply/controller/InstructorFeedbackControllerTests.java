package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Budget;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.InstructorFeedback;
import edu.ucsb.cs.taapply.entity.InstructorFeedbackSettings;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.BudgetRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackRepository;
import edu.ucsb.cs.taapply.repository.InstructorFeedbackSettingsRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.BudgetCreationService;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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

@WebMvcTest(controllers = InstructorFeedbackController.class)
public class InstructorFeedbackControllerTests extends ControllerTestCase {

  @MockitoBean InstructorFeedbackRepository instructorFeedbackRepository;
  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean BudgetRepository budgetRepository;
  @MockitoBean BudgetCreationService budgetCreationService;
  @MockitoBean InstructorFeedbackSettingsRepository instructorFeedbackSettingsRepository;
  @MockitoBean CurrentUserService currentUserService;

  private static final String EMAIL = "pconrad@ucsb.edu";
  private static final String CATALOG = "CONRAD P";

  // W26 has a TA recruitment (10) and a ULA recruitment (11); S26 a TA recruitment alone (12).
  private Recruitment w26Ta;
  private Recruitment w26Ula;
  private Recruitment s26Ta;

  private static Recruitment recruitment(
      long id, String quarter, RecruitmentType type, AllocationVisibility visibility) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .allocationVisibility(visibility)
        .build();
  }

  private static RecruitmentCourse row(long id, long recruitmentId, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .courseId("CMPSC   156")
        .enrollCode("0" + id)
        .section("0100")
        .instructor(CATALOG)
        .removed(removed)
        .build();
  }

  @BeforeEach
  void signedIn() {
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email(EMAIL).build())
                .roles(List.of(new SimpleGrantedAuthority("ROLE_INSTRUCTOR")))
                .build());
    when(instructorRepository.findByEmail(EMAIL))
        .thenReturn(Optional.of(Instructor.builder().email(EMAIL).catalogName(CATALOG).build()));
    w26Ta = recruitment(10, "20261", RecruitmentType.TA, AllocationVisibility.OWN_COURSES);
    w26Ula = recruitment(11, "20261", RecruitmentType.ULA, AllocationVisibility.ALL_COURSES);
    s26Ta = recruitment(12, "20262", RecruitmentType.TA, AllocationVisibility.ADMINS_ONLY);
  }

  /** The caller teaches these rows; their recruitments are the given ones. */
  private void teaches(List<RecruitmentCourse> rows, Recruitment... recruitments) {
    when(recruitmentCourseRepository.findByInstructor(CATALOG)).thenReturn(rows);
    when(recruitmentRepository.findAllById(any())).thenReturn(List.of(recruitments));
  }

  /** Course 2 is in W26 TA, course 5 the same course in W26 ULA, course 6 in S26 TA. */
  private void teachesTheUsualCourses() {
    teaches(List.of(row(2, 10, false), row(5, 11, false), row(6, 12, false)), w26Ta, w26Ula, s26Ta);
  }

  private ResultActions save(long courseId, String body) throws Exception {
    return mockMvc.perform(
        put("/api/instructor/feedback?recruitmentCourseId=" + courseId)
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private void noRowYet() {
    when(instructorFeedbackRepository.findByQuarterAndEmailAndRecruitmentCourseId(
            any(), any(), any()))
        .thenReturn(Optional.empty());
    when(instructorFeedbackRepository.save(any())).thenAnswer(call -> call.getArgument(0));
  }

  private InstructorFeedback saved() {
    ArgumentCaptor<InstructorFeedback> captor = ArgumentCaptor.forClass(InstructorFeedback.class);
    verify(instructorFeedbackRepository).save(captor.capture());
    return captor.getValue();
  }

  // ---- who may ask ----

  @Test
  public void logged_out_users_cannot_ask() throws Exception {
    mockMvc.perform(get("/api/instructor/feedback")).andExpect(status().is(403));
    mockMvc
        .perform(get("/api/instructor/feedback/costs?quarter=20261"))
        .andExpect(status().is(403));
    save(2, "{}").andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER", "ADMIN"})
  @Test
  public void users_and_admins_who_are_not_instructors_cannot_ask() throws Exception {
    mockMvc.perform(get("/api/instructor/feedback")).andExpect(status().is(403));
    mockMvc
        .perform(get("/api/instructor/feedback/costs?quarter=20261"))
        .andExpect(status().is(403));
    save(2, "{}").andExpect(status().is(403));
    verify(instructorFeedbackRepository, never()).save(any());
  }

  // ---- GET ----

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_instructor_gets_their_own_rows() throws Exception {
    InstructorFeedback mine =
        InstructorFeedback.builder()
            .id(1L)
            .quarter("20261")
            .email(EMAIL)
            .recruitmentCourseId(2L)
            .differentTACount(true)
            .numTAsPreferred(3)
            .comments("More, please")
            .lastUpdated(LocalDateTime.of(2026, 11, 8, 14, 5, 0))
            .build();
    when(instructorFeedbackRepository.findByEmail(EMAIL)).thenReturn(List.of(mine));

    MvcResult response =
        mockMvc.perform(get("/api/instructor/feedback")).andExpect(status().isOk()).andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals(1, json.size());
    JsonNode row = json.get(0);
    assertEquals("20261", row.get("quarter").asText());
    assertEquals(2, row.get("recruitmentCourseId").asInt());
    assertFalse(row.get("allocReasonable").asBoolean());
    assertTrue(row.get("differentTACount").asBoolean());
    assertFalse(row.get("differentULACount").asBoolean());
    assertFalse(row.get("otherConcerns").asBoolean());
    assertEquals(3, row.get("numTAsPreferred").asInt());
    assertTrue(row.get("numULAsPreferred").isNull());
    assertEquals("More, please", row.get("comments").asText());
    assertEquals("2026-11-08T14:05:00", row.get("lastUpdated").asText());
  }

  // ---- costs ----

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_costs_are_the_two_figures_of_the_quarters_budget() throws Exception {
    teachesTheUsualCourses();
    when(budgetRepository.findById("20261"))
        .thenReturn(
            Optional.of(
                Budget.builder()
                    .quarter("20261")
                    .unrestrictedBudget(new BigDecimal("99999.00"))
                    .taCostPerQuarter(new BigDecimal("12000.00"))
                    .ulaRateDollarsPerHour(new BigDecimal("20.00"))
                    .estimatedHoursPerULAPerQuarter(new BigDecimal("100.00"))
                    .build()));

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/feedback/costs?quarter=20261"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals("20261", json.get("quarter").asText());
    assertEquals(
        0, new BigDecimal("12000.00").compareTo(json.get("estimatedCostPerTA").decimalValue()));
    assertEquals(
        0, new BigDecimal("2000.00").compareTo(json.get("estimatedCostPerULA").decimalValue()));
    // Nothing else of the budget.
    assertEquals(3, json.size());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void costs_not_entered_are_null() throws Exception {
    teachesTheUsualCourses();
    when(budgetRepository.findById("20261"))
        .thenReturn(Optional.of(Budget.builder().quarter("20261").build()));

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/feedback/costs?quarter=20261"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertTrue(json.get("estimatedCostPerTA").isNull());
    assertTrue(json.get("estimatedCostPerULA").isNull());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_quarter_without_a_budget_has_null_costs() throws Exception {
    teachesTheUsualCourses();
    when(budgetRepository.findById("20261")).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/feedback/costs?quarter=20261"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals("20261", json.get("quarter").asText());
    assertTrue(json.get("estimatedCostPerTA").isNull());
    assertTrue(json.get("estimatedCostPerULA").isNull());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void no_costs_for_a_quarter_whose_allocations_are_withheld() throws Exception {
    teachesTheUsualCourses();

    mockMvc
        .perform(get("/api/instructor/feedback/costs?quarter=20262"))
        .andExpect(status().is(403));
    verify(budgetRepository, never()).findById(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void no_costs_for_a_quarter_the_caller_does_not_teach_in() throws Exception {
    teachesTheUsualCourses();

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/feedback/costs?quarter=20264"))
            .andExpect(status().is(403))
            .andReturn();

    assertEquals(
        "The authenticated instructor teaches no course in 20264",
        responseToJson(response).get("message"));
    verify(budgetRepository, never()).findById(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void no_costs_for_an_instructor_without_a_catalog_name() throws Exception {
    when(instructorRepository.findByEmail(EMAIL))
        .thenReturn(Optional.of(Instructor.builder().email(EMAIL).build()));
    when(recruitmentRepository.findAllById(any())).thenReturn(List.of());

    mockMvc
        .perform(get("/api/instructor/feedback/costs?quarter=20261"))
        .andExpect(status().is(403));
    verify(recruitmentCourseRepository, never()).findByInstructor(any());
  }

  // ---- PUT: who and when ----

  /** The newest Instructor Feedback Settings version asks for feedback, or not (issue #430). */
  private void asking(boolean askForFeedback) {
    when(instructorFeedbackSettingsRepository.findFirstByOrderByIdDesc())
        .thenReturn(
            Optional.of(
                InstructorFeedbackSettings.builder()
                    .id(4L)
                    .notesText("Notes")
                    .askForFeedback(askForFeedback)
                    .build()));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void saves_are_refused_while_the_settings_do_not_ask_for_feedback() throws Exception {
    teachesTheUsualCourses();
    noRowYet();
    asking(false);

    MvcResult response =
        save(2, "{\"allocReasonable\": true}").andExpect(status().is(403)).andReturn();

    assertEquals(
        "Feedback on TA/ULA allocations is not being collected at this time: an admin has turned"
            + " it off on the Instructor Feedback Settings page.",
        responseToJson(response).get("message"));
    verify(instructorFeedbackRepository, never()).save(any());
    verify(budgetCreationService, never()).findOrCreate(any());
  }

  /** Turning the setting off hides the form and refuses saves, but what was saved is kept. */
  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void stored_feedback_can_still_be_read_while_the_settings_do_not_ask() throws Exception {
    asking(false);
    InstructorFeedback stored =
        InstructorFeedback.builder()
            .quarter("20261")
            .email(EMAIL)
            .recruitmentCourseId(2L)
            .allocReasonable(true)
            .build();
    when(instructorFeedbackRepository.findByEmail(EMAIL)).thenReturn(List.of(stored));

    MvcResult response =
        mockMvc.perform(get("/api/instructor/feedback")).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(stored)), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void saves_are_accepted_while_the_settings_ask_for_feedback() throws Exception {
    teachesTheUsualCourses();
    noRowYet();
    asking(true);

    save(2, "{\"allocReasonable\": true}").andExpect(status().isOk());

    assertTrue(saved().isAllocReasonable());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_first_save_creates_the_row_for_the_quarter_email_and_course() throws Exception {
    teachesTheUsualCourses();
    noRowYet();
    LocalDateTime before = LocalDateTime.now(edu.ucsb.cs.taapply.time.AppTime.ZONE);

    MvcResult response =
        save(2, "{\"allocReasonable\": true}").andExpect(status().isOk()).andReturn();

    InstructorFeedback row = saved();
    assertEquals("20261", row.getQuarter());
    assertEquals(EMAIL, row.getEmail());
    assertEquals(2L, row.getRecruitmentCourseId());
    assertTrue(row.isAllocReasonable());
    assertFalse(row.isDifferentTACount());
    assertFalse(row.isDifferentULACount());
    assertFalse(row.isOtherConcerns());
    assertNull(row.getNumTAsPreferred());
    assertNull(row.getNumULAsPreferred());
    assertNull(row.getComments());
    // Stamped now, in Pacific wall-clock time.
    assertTrue(Duration.between(before, row.getLastUpdated()).abs().getSeconds() < 60);
    verify(instructorFeedbackRepository)
        .findByQuarterAndEmailAndRecruitmentCourseId("20261", EMAIL, 2L);
    verify(budgetCreationService).findOrCreate("20261");
    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertTrue(json.get("allocReasonable").asBoolean());
    assertEquals("20261", json.get("quarter").asText());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_later_save_changes_only_the_fields_in_the_body() throws Exception {
    teachesTheUsualCourses();
    InstructorFeedback existing =
        InstructorFeedback.builder()
            .id(7L)
            .quarter("20261")
            .email(EMAIL)
            .recruitmentCourseId(2L)
            .allocReasonable(true)
            .differentTACount(true)
            .numTAsPreferred(3)
            .numULAsPreferred(4)
            .comments("old")
            .lastUpdated(LocalDateTime.of(2026, 1, 1, 0, 0))
            .build();
    when(instructorFeedbackRepository.findByQuarterAndEmailAndRecruitmentCourseId(
            "20261", EMAIL, 2L))
        .thenReturn(Optional.of(existing));
    when(instructorFeedbackRepository.save(any())).thenAnswer(call -> call.getArgument(0));

    save(2, "{\"differentULACount\": true, \"otherConcerns\": true}").andExpect(status().isOk());

    InstructorFeedback row = saved();
    assertEquals(7L, row.getId());
    assertTrue(row.isAllocReasonable());
    assertTrue(row.isDifferentTACount());
    assertTrue(row.isDifferentULACount());
    assertTrue(row.isOtherConcerns());
    assertEquals(3, row.getNumTAsPreferred());
    assertEquals(4, row.getNumULAsPreferred());
    assertEquals("old", row.getComments());
    assertTrue(row.getLastUpdated().isAfter(LocalDateTime.of(2026, 1, 1, 0, 0)));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void every_field_can_be_set_and_cleared() throws Exception {
    teachesTheUsualCourses();
    noRowYet();

    save(
            2,
            "{\"allocReasonable\": false, \"differentTACount\": true, \"differentULACount\": true,"
                + " \"otherConcerns\": true, \"numTAsPreferred\": 0, \"numULAsPreferred\": 5,"
                + " \"comments\": \"Thanks\"}")
        .andExpect(status().isOk());

    InstructorFeedback row = saved();
    assertFalse(row.isAllocReasonable());
    assertTrue(row.isDifferentTACount());
    assertTrue(row.isDifferentULACount());
    assertTrue(row.isOtherConcerns());
    assertEquals(0, row.getNumTAsPreferred());
    assertEquals(5, row.getNumULAsPreferred());
    assertEquals("Thanks", row.getComments());
  }

  @Test
  public void null_clears_a_count_or_the_comments_and_false_unchecks_a_box() {
    InstructorFeedback row =
        InstructorFeedback.builder()
            .allocReasonable(true)
            .differentTACount(true)
            .differentULACount(true)
            .otherConcerns(true)
            .numTAsPreferred(1)
            .numULAsPreferred(2)
            .comments("x")
            .build();
    JsonNodeFactory f = JsonNodeFactory.instance;
    InstructorFeedbackController.apply(
        row,
        f.objectNode()
            .put("allocReasonable", false)
            .put("differentTACount", false)
            .put("differentULACount", false)
            .put("otherConcerns", false)
            .putNull("numTAsPreferred")
            .putNull("numULAsPreferred")
            .putNull("comments"));
    assertFalse(row.isAllocReasonable());
    assertFalse(row.isDifferentTACount());
    assertFalse(row.isDifferentULACount());
    assertFalse(row.isOtherConcerns());
    assertNull(row.getNumTAsPreferred());
    assertNull(row.getNumULAsPreferred());
    assertNull(row.getComments());
  }

  @Test
  public void an_empty_body_changes_nothing() {
    InstructorFeedback row =
        InstructorFeedback.builder()
            .allocReasonable(true)
            .differentTACount(true)
            .differentULACount(true)
            .otherConcerns(true)
            .numTAsPreferred(1)
            .numULAsPreferred(2)
            .comments("x")
            .build();
    InstructorFeedbackController.apply(row, JsonNodeFactory.instance.objectNode());
    assertTrue(row.isAllocReasonable());
    assertTrue(row.isDifferentTACount());
    assertTrue(row.isDifferentULACount());
    assertTrue(row.isOtherConcerns());
    assertEquals(1, row.getNumTAsPreferred());
    assertEquals(2, row.getNumULAsPreferred());
    assertEquals("x", row.getComments());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_course_the_caller_does_not_teach_is_refused() throws Exception {
    teachesTheUsualCourses();

    MvcResult response =
        save(99, "{\"allocReasonable\": true}").andExpect(status().is(403)).andReturn();

    assertEquals(
        "This recruitment course is not assigned to the authenticated instructor.",
        responseToJson(response).get("message"));
    verify(instructorFeedbackRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_removed_course_is_refused() throws Exception {
    teaches(List.of(row(2, 10, true), row(5, 11, false)), w26Ta, w26Ula);

    save(2, "{\"allocReasonable\": true}").andExpect(status().is(403));
    verify(instructorFeedbackRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_instructor_without_an_instructor_row_is_refused() throws Exception {
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

    save(2, "{\"allocReasonable\": true}").andExpect(status().is(403));
    verify(instructorFeedbackRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_quarter_with_both_recruitments_needs_both_released() throws Exception {
    w26Ula.setAllocationVisibility(AllocationVisibility.ADMINS_ONLY);
    teachesTheUsualCourses();

    MvcResult response =
        save(2, "{\"allocReasonable\": true}").andExpect(status().is(403)).andReturn();

    assertEquals(
        "Feedback opens once the quarter's allocations have been released to faculty.",
        responseToJson(response).get("message"));
    verify(instructorFeedbackRepository, never()).save(any());
    verify(budgetCreationService, never()).findOrCreate(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_ta_only_quarter_needs_the_ta_allocations_released() throws Exception {
    teachesTheUsualCourses();

    save(6, "{\"allocReasonable\": true}").andExpect(status().is(403));

    s26Ta.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    noRowYet();
    save(6, "{\"allocReasonable\": true}").andExpect(status().isOk());
    assertEquals("20262", saved().getQuarter());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_recruitment_of_the_quarter_the_caller_does_not_teach_in_does_not_count()
      throws Exception {
    // W26 has a ULA recruitment too, still withheld, but the caller has no course in it: only the
    // TA recruitment counts, as on the home page.
    teaches(List.of(row(2, 10, false)), w26Ta);
    noRowYet();

    save(2, "{\"otherConcerns\": true}").andExpect(status().isOk());
    assertTrue(saved().isOtherConcerns());
    verify(recruitmentRepository).findAllById(Set.of(10L));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_ula_row_may_be_named_too() throws Exception {
    teachesTheUsualCourses();
    noRowYet();

    save(5, "{\"differentULACount\": true}").andExpect(status().isOk());
    InstructorFeedback row = saved();
    assertEquals(5L, row.getRecruitmentCourseId());
    assertEquals("20261", row.getQuarter());
  }

  // ---- PUT: values ----

  private void refused(String body, String message) throws Exception {
    teachesTheUsualCourses();
    noRowYet();
    MvcResult response = save(2, body).andExpect(status().is(400)).andReturn();
    assertEquals(message, responseToJson(response).get("message"));
    verify(instructorFeedbackRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_box_must_be_true_or_false() throws Exception {
    refused("{\"allocReasonable\": \"yes\"}", "allocReasonable must be true or false.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_box_may_not_be_null() throws Exception {
    refused("{\"otherConcerns\": null}", "otherConcerns must be true or false.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_count_may_not_be_negative() throws Exception {
    refused(
        "{\"numTAsPreferred\": -1}", "numTAsPreferred must be a whole number, 0 or more, or null.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_count_must_be_whole() throws Exception {
    refused(
        "{\"numULAsPreferred\": 1.5}",
        "numULAsPreferred must be a whole number, 0 or more, or null.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_count_must_be_a_number() throws Exception {
    refused(
        "{\"numULAsPreferred\": \"3\"}",
        "numULAsPreferred must be a whole number, 0 or more, or null.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_count_must_fit_in_an_int() throws Exception {
    refused(
        "{\"numTAsPreferred\": 3000000000}",
        "numTAsPreferred must be a whole number, 0 or more, or null.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_comments_must_be_text() throws Exception {
    refused("{\"comments\": 5}", "comments must be text or null.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_comments_may_not_be_longer_than_2048_characters() throws Exception {
    refused(
        "{\"comments\": \"" + "x".repeat(2049) + "\"}", "comments may be at most 2048 characters.");
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void comments_of_exactly_2048_characters_are_kept() throws Exception {
    teachesTheUsualCourses();
    noRowYet();

    save(2, "{\"comments\": \"" + "x".repeat(2048) + "\"}").andExpect(status().isOk());
    assertEquals(2048, saved().getComments().length());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_body_must_be_an_object() throws Exception {
    refused("[]", "The body must be a JSON object.");
  }

  @Test
  public void a_missing_body_is_refused() {
    InstructorFeedback row = InstructorFeedback.builder().build();
    IllegalArgumentException e =
        assertThrows(
            IllegalArgumentException.class, () -> InstructorFeedbackController.apply(row, null));
    assertEquals("The body must be a JSON object.", e.getMessage());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void one_bad_value_changes_nothing() throws Exception {
    InstructorFeedback row = InstructorFeedback.builder().numTAsPreferred(2).build();
    assertThrows(
        IllegalArgumentException.class,
        () ->
            InstructorFeedbackController.apply(
                row,
                mapper.readTree(
                    "{\"allocReasonable\": true, \"differentTACount\": true,"
                        + " \"differentULACount\": true, \"otherConcerns\": true,"
                        + " \"numTAsPreferred\": 5, \"numULAsPreferred\": 1,"
                        + " \"comments\": 7}")));
    assertFalse(row.isAllocReasonable());
    assertFalse(row.isDifferentTACount());
    assertFalse(row.isDifferentULACount());
    assertFalse(row.isOtherConcerns());
    assertEquals(2, row.getNumTAsPreferred());
    assertNull(row.getNumULAsPreferred());
  }
}
