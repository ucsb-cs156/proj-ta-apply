package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJob;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.RecruitmentAuditService;
import edu.ucsb.cs156.jobs.services.JobService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.RecruitmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class RecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean JobService jobService;
  @MockitoBean PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;
  @MockitoBean UserRepository userRepository;
  @MockitoBean RecruitmentAuditService recruitmentAuditService;
  @MockitoBean AllocationService allocationService;

  private static final String CREATE_URL =
      "/api/admin/recruitments/post?quarter=20261&type=TA"
          + "&tentativeOpeningDate=2026-01-05&primaryConsiderationDate=2026-01-20";

  private static Recruitment recruitment(long id, String quarter, RecruitmentType type) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .applicationStatus(ApplicationStatus.CLOSED)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .build();
  }

  // ---- create ----

  @Test
  public void logged_out_users_cannot_create() throws Exception {
    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_create() throws Exception {
    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_create() throws Exception {
    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().is(403));
  }

  /** Creating one fills its course list straight away, so the admin has no second step. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void creating_a_recruitment_saves_it_closed_and_launches_populate() throws Exception {
    Recruitment saved = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.existsByQuarterAndType("20261", RecruitmentType.TA))
        .thenReturn(false);
    when(recruitmentRepository.save(any())).thenReturn(saved);
    PopulateRecruitmentCoursesJob populateJob = PopulateRecruitmentCoursesJob.builder().build();
    when(populateRecruitmentCoursesJobFactory.create(saved)).thenReturn(populateJob);

    MvcResult response =
        mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk()).andReturn();

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentRepository, times(1)).save(captor.capture());
    assertEquals("20261", captor.getValue().getQuarter());
    assertEquals(RecruitmentType.TA, captor.getValue().getType());
    // Applications never open themselves.
    assertEquals(ApplicationStatus.CLOSED, captor.getValue().getApplicationStatus());
    assertNull(captor.getValue().getActualOpeningDate());
    assertEquals("NotStarted", captor.getValue().getReviewStatus());
    assertNull(captor.getValue().getFacultyReviewOpeningDate());
    assertNull(captor.getValue().getFacultyRankingDeadline());

    verify(jobService, times(1)).runAsJob(populateJob);
    // Issue #139: the creation goes in the recruitment audit trail.
    verify(recruitmentAuditService, times(1)).recordCreated(saved);
    assertEquals(mapper.writeValueAsString(saved), response.getResponse().getContentAsString());
  }

  /** "The TA recruitment for W26" has to be unambiguous, which iteration 4 will rely on. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_duplicate_quarter_and_type_is_a_400_and_launches_nothing() throws Exception {
    when(recruitmentRepository.existsByQuarterAndType("20261", RecruitmentType.TA))
        .thenReturn(true);

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isBadRequest());

    verify(recruitmentRepository, never()).save(any());
    verify(jobService, never()).runAsJob(any());
    verify(recruitmentAuditService, never()).recordCreated(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_malformed_quarter_is_a_400() throws Exception {
    mockMvc
        .perform(
            post("/api/admin/recruitments/post?quarter=bogus&type=TA"
                    + "&tentativeOpeningDate=2026-01-05&primaryConsiderationDate=2026-01-20")
                .with(csrf()))
        .andExpect(status().isBadRequest());

    verify(recruitmentRepository, never()).save(any());
  }

  // ---- list ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_list_recruitments_most_recent_first() throws Exception {
    List<Recruitment> expected =
        List.of(
            recruitment(2L, "20262", RecruitmentType.TA),
            recruitment(1L, "20261", RecruitmentType.TA));
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(expected);

    MvcResult response =
        mockMvc.perform(get("/api/admin/recruitments/all")).andExpect(status().isOk()).andReturn();

    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  @Test
  public void logged_out_users_cannot_list() throws Exception {
    mockMvc.perform(get("/api/admin/recruitments/all")).andExpect(status().is(403));
  }

  // ---- status ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void opening_stamps_the_actual_opening_date() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("applicationStatus", "CLOSED"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/recruitments/status?id=1&status=OPEN").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentRepository, times(1)).save(captor.capture());
    assertEquals(ApplicationStatus.OPEN, captor.getValue().getApplicationStatus());
    assertEquals(LocalDate.now(), captor.getValue().getActualOpeningDate());
    // Issue #139: the snapshot is taken before the change and the differences recorded after
    // the save, so the trail shows the status and the stamped date.
    InOrder inOrder = inOrder(recruitmentAuditService, recruitmentRepository);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentRepository).save(r);
    inOrder.verify(recruitmentAuditService).recordChanges(before, r);
    assertEquals(ApplicationStatus.OPEN, r.getApplicationStatus());
    // The updated recruitment comes back, so the page can render the new state.
    assertEquals(
        mapper.writeValueAsString(captor.getValue()), response.getResponse().getContentAsString());
  }

  /**
   * The opening date is what applicants were told; re-opening must not rewrite it. This is the
   * "first open, last close" rule.
   */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void re_opening_leaves_the_original_opening_date_alone() throws Exception {
    LocalDate original = LocalDate.of(2026, 1, 7);
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setActualOpeningDate(original);
    r.setApplicationStatus(ApplicationStatus.CLOSED);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(put("/api/admin/recruitments/status?id=1&status=OPEN").with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentRepository, times(1)).save(captor.capture());
    assertEquals(original, captor.getValue().getActualOpeningDate());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void closing_stamps_the_closing_date_every_time() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setActualClosingDate(LocalDate.of(2026, 1, 1));
    r.setApplicationStatus(ApplicationStatus.OPEN);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(put("/api/admin/recruitments/status?id=1&status=CLOSED").with(csrf()))
        .andExpect(status().isOk());

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentRepository, times(1)).save(captor.capture());
    assertEquals(ApplicationStatus.CLOSED, captor.getValue().getApplicationStatus());
    // Overwritten, unlike the opening date.
    assertEquals(LocalDate.now(), captor.getValue().getActualClosingDate());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_status_on_an_unknown_recruitment_is_a_404() throws Exception {
    // (issue #139) nothing is recorded for a recruitment that does not exist
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(put("/api/admin/recruitments/status?id=99&status=OPEN").with(csrf()))
        .andExpect(status().isNotFound());
    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
  }

  @Test
  public void logged_out_users_cannot_change_status() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/status?id=1&status=OPEN").with(csrf()))
        .andExpect(status().is(403));
  }

  // ---- faculty review lifecycle ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void opening_faculty_reviews_requires_a_deadline_and_records_the_first_opening()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("reviewStatus", "NotStarted"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                        + "&facultyRankingDeadline=2026-03-01")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("Open", r.getReviewStatus());
    assertEquals(LocalDate.now(), r.getFacultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 3, 1), r.getFacultyRankingDeadline());
    InOrder inOrder = inOrder(recruitmentAuditService, recruitmentRepository);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentRepository).save(r);
    inOrder.verify(recruitmentAuditService).recordChanges(before, r);
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void reopening_reviews_preserves_the_first_opening_date_and_updates_deadline()
      throws Exception {
    LocalDate originalOpeningDate = LocalDate.of(2026, 1, 10);
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Closed");
    r.setFacultyReviewOpeningDate(originalOpeningDate);
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("reviewStatus", "Closed"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(
            put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                    + "&facultyRankingDeadline=2026-04-01")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals("Open", r.getReviewStatus());
    assertEquals(originalOpeningDate, r.getFacultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 4, 1), r.getFacultyRankingDeadline());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void closing_reviews_does_not_clear_dates_and_is_audited() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Open");
    r.setFacultyReviewOpeningDate(LocalDate.of(2026, 1, 10));
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("reviewStatus", "Open"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Closed").with(csrf()))
        .andExpect(status().isOk());

    assertEquals("Closed", r.getReviewStatus());
    assertEquals(LocalDate.of(2026, 1, 10), r.getFacultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 2, 1), r.getFacultyRankingDeadline());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void setting_the_review_status_to_not_started_keeps_existing_review_dates()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Closed");
    r.setFacultyReviewOpeningDate(LocalDate.of(2026, 1, 10));
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("reviewStatus", "Closed"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=NotStarted").with(csrf()))
        .andExpect(status().isOk());

    assertEquals("NotStarted", r.getReviewStatus());
    assertEquals(LocalDate.of(2026, 1, 10), r.getFacultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 2, 1), r.getFacultyRankingDeadline());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_open_review_with_a_missing_first_open_date_is_repaired() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Open");
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("reviewStatus", "Open"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(
            put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                    + "&facultyRankingDeadline=2026-02-01")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(LocalDate.now(), r.getFacultyReviewOpeningDate());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_open_review_can_change_its_deadline_without_changing_its_opening_date()
      throws Exception {
    LocalDate openingDate = LocalDate.of(2026, 1, 10);
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Open");
    r.setFacultyReviewOpeningDate(openingDate);
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("facultyRankingDeadline", "2026-02-01"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(
            put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals("Open", r.getReviewStatus());
    assertEquals(openingDate, r.getFacultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 2, 15), r.getFacultyRankingDeadline());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void opening_reviews_without_a_deadline_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Open").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_a_deadline_without_a_date_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/facultyRankingDeadline?id=1").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_review_status_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=open").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void opening_reviews_with_an_invalid_date_is_a_400() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                    + "&facultyRankingDeadline=not-a-date")
                .with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void unchanged_review_status_and_deadline_do_not_save_or_audit() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Open");
    r.setFacultyReviewOpeningDate(LocalDate.of(2026, 1, 10));
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(
            put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                    + "&facultyRankingDeadline=2026-02-01")
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.reviewStatus").value("Open"))
        .andExpect(jsonPath("$.facultyRankingDeadline").value("2026-02-01"));

    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_the_deadline_is_audited_but_an_unchanged_date_is_not() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("facultyRankingDeadline", "2026-02-01"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(
            put("/api/admin/recruitments/facultyRankingDeadline?id=1"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.facultyRankingDeadline").value("2026-02-15"));
    assertEquals(LocalDate.of(2026, 2, 15), r.getFacultyRankingDeadline());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);

    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    mockMvc
        .perform(
            put("/api/admin/recruitments/facultyRankingDeadline?id=1"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.facultyRankingDeadline").value("2026-02-15"));
    verify(recruitmentRepository, times(1)).save(any());
    verify(recruitmentAuditService, times(1)).snapshot(any());
    verify(recruitmentAuditService, times(1)).recordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void review_status_and_deadline_updates_of_a_missing_recruitment_are_404s()
      throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=99&status=Closed").with(csrf()))
        .andExpect(status().isNotFound());
    mockMvc
        .perform(
            put("/api/admin/recruitments/facultyRankingDeadline?id=99"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().isNotFound());
    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).snapshot(any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_change_faculty_review_status_or_deadline() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Closed").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/admin/recruitments/facultyRankingDeadline?id=1"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @Test
  public void non_admin_users_cannot_change_faculty_review_status_or_deadline() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Closed").with(csrf()))
        .andExpect(status().is(403));
    mockMvc
        .perform(
            put("/api/admin/recruitments/facultyRankingDeadline?id=1"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  // ---- delete ----

  // ---- GET /applicationCounts ----

  @Test
  public void logged_out_users_cannot_get_application_counts() throws Exception {
    mockMvc.perform(get("/api/admin/recruitments/applicationCounts")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_get_application_counts() throws Exception {
    mockMvc.perform(get("/api/admin/recruitments/applicationCounts")).andExpect(status().is(403));
  }

  /** Issue #108: every recruitment is listed, test applications left out, none as 0. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_gets_the_application_count_of_every_recruitment() throws Exception {
    when(recruitmentRepository.findAll())
        .thenReturn(
            List.of(
                recruitment(2L, "20261", RecruitmentType.ULA),
                recruitment(1L, "20261", RecruitmentType.TA)));
    when(applicationRepository.countByRecruitmentIdAndTestApplicationFalse(1L)).thenReturn(15L);
    when(applicationRepository.countByRecruitmentIdAndTestApplicationFalse(2L)).thenReturn(0L);

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitments/applicationCounts"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("{\"1\":15,\"2\":0}", response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_delete_a_recruitment() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(delete("/api/admin/recruitments/delete?id=1").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(recruitmentRepository, times(1)).delete(r);
    // Issue #139: recorded before the row goes, so the trail says the recruitment existed.
    InOrder inOrder = inOrder(recruitmentAuditService, recruitmentRepository);
    inOrder.verify(recruitmentAuditService).recordDeleted(r);
    inOrder.verify(recruitmentRepository).delete(r);
    Map<String, Object> json = responseToJson(response);
    assertEquals("Recruitment with id 1 deleted", json.get("message"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(delete("/api/admin/recruitments/delete?id=99").with(csrf()))
        .andExpect(status().isNotFound());
    verify(recruitmentRepository, never()).delete(any());
    verify(recruitmentAuditService, never()).recordDeleted(any());
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/recruitments/delete?id=1").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).delete(any());
  }

  // ---- PUT /api/admin/recruitments/avgCostPerPosition (issue #177) ----

  @Test
  public void logged_out_users_cannot_change_the_cost_per_position() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/avgCostPerPosition?id=1&avgCostPerPosition=5")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_the_cost_per_position() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/avgCostPerPosition?id=1&avgCostPerPosition=5")
                .with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_new_recruitment_has_no_cost_per_position() {
    assertNull(recruitment(1L, "20261", RecruitmentType.TA).getAvgCostPerPosition());
  }

  /** A planning figure: saved to the cent, returned, not audited, and no shares to recompute. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_set_the_cost_per_position() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/avgCostPerPosition?id=1&avgCostPerPosition=12345.675")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(new BigDecimal("12345.68"), r.getAvgCostPerPosition());
    verify(recruitmentRepository, times(1)).save(r);
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
    verify(allocationService, never()).recompute(any());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_cost_per_position_of_zero_is_allowed() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.ULA);
    r.setAvgCostPerPosition(new BigDecimal("9.99"));
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(
            put("/api/admin/recruitments/avgCostPerPosition?id=1&avgCostPerPosition=0")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(new BigDecimal("0.00"), r.getAvgCostPerPosition());
    verify(recruitmentRepository, times(1)).save(r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_negative_cost_per_position_is_a_400() throws Exception {
    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/avgCostPerPosition?id=1&avgCostPerPosition=-0.01")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        "avgCostPerPosition must not be negative", responseToJson(response).get("message"));
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void setting_the_cost_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/avgCostPerPosition?id=99&avgCostPerPosition=5")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 99 not found", json.get("message"));
    verify(recruitmentRepository, never()).save(any());
  }

  // ---- PUT /api/admin/recruitments/assignmentsPublished (issue #180) ----

  @Test
  public void logged_out_users_cannot_publish_assignments() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=true").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_publish_assignments() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=true").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_new_recruitment_has_unpublished_assignments() {
    assertEquals(false, recruitment(1L, "20261", RecruitmentType.TA).getAssignmentsPublished());
  }

  /** A lifecycle change faculty see: snapshot, save, then the audit row. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_publish_assignments_and_it_is_audited() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("assignmentsPublished", "false"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/assignmentsPublished?id=1&published=true")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(true, r.getAssignmentsPublished());
    InOrder inOrder = inOrder(recruitmentAuditService, recruitmentRepository);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentRepository).save(r);
    inOrder.verify(recruitmentAuditService).recordChanges(before, r);
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_take_published_assignments_back() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.ULA);
    r.setAssignmentsPublished(true);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("assignmentsPublished", "true"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=false").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(false, r.getAssignmentsPublished());
    verify(recruitmentRepository).save(r);
    verify(recruitmentAuditService).recordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void publishing_what_is_already_published_changes_and_records_nothing() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setAssignmentsPublished(true);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/assignmentsPublished?id=1&published=true")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(true, r.getAssignmentsPublished());
    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unset_published_flag_counts_as_unpublished() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setAssignmentsPublished(null);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=false").with(csrf()))
        .andExpect(status().isOk());
    verify(recruitmentRepository, never()).save(any());

    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=true").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(true, r.getAssignmentsPublished());
    verify(recruitmentRepository).save(r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void publishing_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/assignmentsPublished?id=99&published=true")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 99 not found", json.get("message"));
    verify(recruitmentRepository, never()).save(any());
  }

  // ---- PUT /api/admin/recruitments/totalHiringTarget (issue #174) ----

  @Test
  public void logged_out_users_cannot_change_the_hiring_target() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=5").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_the_hiring_target() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=5").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_new_recruitment_expects_to_hire_one() {
    assertEquals(1, recruitment(1L, "20261", RecruitmentType.TA).getTotalHiringTarget());
  }

  /** A planning figure: saved, returned, and not written to the audit trail. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_change_the_hiring_target() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=12")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(12, r.getTotalHiringTarget());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
    // Issue #176: every section's share depends on the target, recomputed after the save.
    InOrder inOrder = inOrder(recruitmentRepository, allocationService);
    inOrder.verify(recruitmentRepository).save(r);
    inOrder.verify(allocationService).recompute(r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_hiring_target_of_one_is_allowed() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setTotalHiringTarget(7);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=1").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(1, r.getTotalHiringTarget());
    verify(recruitmentRepository, times(1)).save(r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_hiring_target_below_one_is_a_400() throws Exception {
    for (String bad : List.of("0", "-3")) {
      MvcResult response =
          mockMvc
              .perform(
                  put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=" + bad)
                      .with(csrf()))
              .andExpect(status().isBadRequest())
              .andReturn();
      Map<String, Object> json = responseToJson(response);
      assertEquals("totalHiringTarget must be at least 1", json.get("message"));
    }
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
    verify(allocationService, never()).recompute(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_hiring_target_that_is_not_a_number_is_a_400() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=five")
                .with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_the_hiring_target_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/totalHiringTarget?id=99&totalHiringTarget=5")
                    .with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    verify(recruitmentRepository, never()).save(any());
    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
  }

  // ---- PUT /api/admin/recruitments/allocationVisibility (issues #178 and #224) ----

  private static final String VISIBILITY_URL = "/api/admin/recruitments/allocationVisibility";

  @Test
  public void logged_out_users_cannot_change_the_allocation_visibility() throws Exception {
    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=OWN_COURSES").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).findById(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_the_allocation_visibility() throws Exception {
    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=ALL_COURSES").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).findById(any());
  }

  @Test
  public void a_new_recruitment_shows_allocations_to_admins_only() {
    assertEquals(
        AllocationVisibility.ADMINS_ONLY,
        recruitment(1L, "20261", RecruitmentType.TA).getAllocationVisibility());
  }

  /** Each change is saved and then recorded in the audit trail, in that order. */
  private void assertVisibilityChange(
      AllocationVisibility from, AllocationVisibility to, RecruitmentType type) throws Exception {
    Recruitment r = recruitment(1L, "20261", type);
    r.setAllocationVisibility(from);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("allocationVisibility", from.name()));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    MvcResult response =
        mockMvc
            .perform(put(VISIBILITY_URL + "?id=1&visibility=" + to.name()).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(to, r.getAllocationVisibility());
    InOrder inOrder = inOrder(recruitmentAuditService, recruitmentRepository);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentRepository).save(r);
    inOrder.verify(recruitmentAuditService).recordChanges(before, r);
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
    assertTrue(
        response
            .getResponse()
            .getContentAsString()
            .contains("\"allocationVisibility\":\"" + to.name() + "\""));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void releasing_allocations_to_each_faculty_member_is_saved_and_audited() throws Exception {
    assertVisibilityChange(
        AllocationVisibility.ADMINS_ONLY, AllocationVisibility.OWN_COURSES, RecruitmentType.TA);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void showing_all_allocations_to_all_faculty_is_saved_and_audited() throws Exception {
    assertVisibilityChange(
        AllocationVisibility.OWN_COURSES, AllocationVisibility.ALL_COURSES, RecruitmentType.ULA);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void withdrawing_allocations_from_faculty_is_saved_and_audited() throws Exception {
    assertVisibilityChange(
        AllocationVisibility.ALL_COURSES, AllocationVisibility.ADMINS_ONLY, RecruitmentType.TA);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void choosing_the_visibility_it_already_has_neither_saves_nor_audits() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(put(VISIBILITY_URL + "?id=1&visibility=OWN_COURSES").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(AllocationVisibility.OWN_COURSES, r.getAllocationVisibility());
    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_the_visibility_of_an_unknown_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(put(VISIBILITY_URL + "?id=99&visibility=OWN_COURSES").with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    Map<String, Object> json = responseToJson(response);
    assertEquals("EntityNotFoundException", json.get("type"));
    assertEquals("Recruitment with id 99 not found", json.get("message"));
    verify(recruitmentRepository, never()).save(any());
    verify(recruitmentAuditService, never()).recordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_visibility_that_is_not_one_of_the_three_is_a_400() throws Exception {
    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=EVERYONE").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_missing_visibility_is_a_400() throws Exception {
    mockMvc.perform(put(VISIBILITY_URL + "?id=1").with(csrf())).andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentRepository, never()).save(any());
  }

  // ---- The dates the Recruitment Steps diagram shows (issue #231) ----

  /** True when the stamp was written during the test, i.e. within the last minute. */
  private static boolean justNow(LocalDateTime stamp) {
    return stamp != null
        && !stamp.isBefore(LocalDateTime.now().minusMinutes(1))
        && !stamp.isAfter(LocalDateTime.now().plusMinutes(1));
  }

  private static final LocalDateTime LONG_AGO = LocalDateTime.of(2020, 1, 1, 12, 0);

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void creating_a_recruitment_stamps_when_it_was_created() throws Exception {
    Recruitment saved = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.existsByQuarterAndType("20261", RecruitmentType.TA))
        .thenReturn(false);
    when(recruitmentRepository.save(any())).thenReturn(saved);
    when(populateRecruitmentCoursesJobFactory.create(saved))
        .thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk());

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentRepository).save(captor.capture());
    assertTrue(justNow(captor.getValue().getCreatedAt()));
    assertNull(captor.getValue().getAllocationsReleasedAt());
    assertNull(captor.getValue().getFacultyReviewClosedAt());
    assertNull(captor.getValue().getAssignmentsPublishedAt());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void closing_reviews_stamps_when_they_were_closed_and_opening_them_does_not()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(recruitmentAuditService.snapshot(r))
        .thenReturn(new RecruitmentAuditService.Snapshot(1L, Map.of()));

    mockMvc
        .perform(
            put("/api/admin/recruitments/reviewStatus?id=1&status=Open"
                    + "&facultyRankingDeadline=2026-02-01")
                .with(csrf()))
        .andExpect(status().isOk());
    assertNull(r.getFacultyReviewClosedAt());

    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Closed").with(csrf()))
        .andExpect(status().isOk());
    assertTrue(justNow(r.getFacultyReviewClosedAt()));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void closing_reviews_again_after_reopening_them_restamps() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Open");
    r.setFacultyReviewOpeningDate(LocalDate.of(2026, 1, 10));
    r.setFacultyRankingDeadline(LocalDate.of(2026, 2, 1));
    r.setFacultyReviewClosedAt(LONG_AGO);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(recruitmentAuditService.snapshot(r))
        .thenReturn(new RecruitmentAuditService.Snapshot(1L, Map.of()));

    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Closed").with(csrf()))
        .andExpect(status().isOk());

    assertTrue(justNow(r.getFacultyReviewClosedAt()));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void leaving_admins_only_stamps_the_first_release_and_later_changes_keep_it()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(recruitmentAuditService.snapshot(r))
        .thenReturn(new RecruitmentAuditService.Snapshot(1L, Map.of()));

    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=OWN_COURSES").with(csrf()))
        .andExpect(status().isOk());
    LocalDateTime first = r.getAllocationsReleasedAt();
    assertTrue(justNow(first));

    // Widening it, and even withdrawing it, leave the date of the first release alone.
    r.setAllocationsReleasedAt(LONG_AGO);
    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=ALL_COURSES").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(LONG_AGO, r.getAllocationsReleasedAt());
    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=ADMINS_ONLY").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(LONG_AGO, r.getAllocationsReleasedAt());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void withdrawing_before_any_release_stamps_nothing() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(recruitmentAuditService.snapshot(r))
        .thenReturn(new RecruitmentAuditService.Snapshot(1L, Map.of()));

    mockMvc
        .perform(put(VISIBILITY_URL + "?id=1&visibility=ADMINS_ONLY").with(csrf()))
        .andExpect(status().isOk());

    assertNull(r.getAllocationsReleasedAt());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void publishing_stamps_each_time_and_taking_it_back_keeps_the_last_stamp()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(recruitmentAuditService.snapshot(r))
        .thenReturn(new RecruitmentAuditService.Snapshot(1L, Map.of()));
    String url = "/api/admin/recruitments/assignmentsPublished?id=1&published=";

    mockMvc.perform(put(url + "true").with(csrf())).andExpect(status().isOk());
    assertTrue(justNow(r.getAssignmentsPublishedAt()));

    r.setAssignmentsPublishedAt(LONG_AGO);
    mockMvc.perform(put(url + "false").with(csrf())).andExpect(status().isOk());
    assertEquals(LONG_AGO, r.getAssignmentsPublishedAt());

    mockMvc.perform(put(url + "true").with(csrf())).andExpect(status().isOk());
    assertTrue(justNow(r.getAssignmentsPublishedAt()));
  }
}
