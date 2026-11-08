package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJob;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.AllocationVisibilityService;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.RecruitmentAuditService;
import edu.ucsb.cs156.jobs.services.JobService;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

  @MockitoBean DeveloperModeService developerModeService;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean JobService jobService;
  @MockitoBean PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;
  @MockitoBean UserRepository userRepository;
  @MockitoBean RecruitmentAuditService recruitmentAuditService;
  @MockitoBean AllocationService allocationService;
  @MockitoBean AllocationVisibilityService allocationVisibilityService;
  @MockitoBean AssignmentsService assignmentsService;

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
    when(recruitmentAuditService.saveAndRecordCreated(any())).thenReturn(saved);
    PopulateRecruitmentCoursesJob populateJob = PopulateRecruitmentCoursesJob.builder().build();
    when(populateRecruitmentCoursesJobFactory.create(saved)).thenReturn(populateJob);

    MvcResult response =
        mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk()).andReturn();

    // Issue #139: the creation goes in the recruitment audit trail, and issue #377: the save and
    // that row are written together by the audit service, so the controller saves nothing itself.
    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentAuditService, times(1)).saveAndRecordCreated(captor.capture());
    verify(recruitmentRepository, never()).save(any());
    assertEquals("20261", captor.getValue().getQuarter());
    assertEquals(RecruitmentType.TA, captor.getValue().getType());
    // Applications never open themselves.
    assertEquals(ApplicationStatus.CLOSED, captor.getValue().getApplicationStatus());
    assertNull(captor.getValue().getActualOpeningDate());
    assertEquals("NotStarted", captor.getValue().getReviewStatus());
    assertNull(captor.getValue().getFacultyReviewOpeningDate());
    assertNull(captor.getValue().getFacultyRankingDeadline());

    verify(jobService, times(1)).runAsJob(populateJob);
    assertEquals(mapper.writeValueAsString(saved), response.getResponse().getContentAsString());
  }

  /** "The TA recruitment for W26" has to be unambiguous, which iteration 4 will rely on. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_duplicate_quarter_and_type_is_a_400_and_launches_nothing() throws Exception {
    when(recruitmentRepository.existsByQuarterAndType("20261", RecruitmentType.TA))
        .thenReturn(true);

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isBadRequest());

    verify(recruitmentAuditService, never()).saveAndRecordCreated(any());
    verify(jobService, never()).runAsJob(any());
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

    verify(recruitmentAuditService, never()).saveAndRecordCreated(any());
  }

  // ---- the hiring target of a new recruitment (issue #384) ----

  private static Recruitment earlier(long id, String quarter, RecruitmentType type, int target) {
    Recruitment recruitment = recruitment(id, quarter, type);
    recruitment.setTotalHiringTarget(target);
    return recruitment;
  }

  /**
   * The Create Recruitment form: the new TA recruitment's target is the one of the TA recruitment
   * in the most recent earlier quarter.
   */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_new_recruitment_takes_the_hiring_target_of_its_types_most_recent_earlier_one()
      throws Exception {
    when(recruitmentRepository.findFirstByQuarterLessThanAndTypeOrderByQuarterDesc(
            "20261", RecruitmentType.TA))
        .thenReturn(Optional.of(earlier(3L, "20254", RecruitmentType.TA, 12)));
    Recruitment saved = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentAuditService.saveAndRecordCreated(any())).thenReturn(saved);
    when(populateRecruitmentCoursesJobFactory.create(saved))
        .thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk());

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentAuditService).saveAndRecordCreated(captor.capture());
    assertEquals(12, captor.getValue().getTotalHiringTarget());
    // Everything else is as for any new recruitment.
    assertEquals("20261", captor.getValue().getQuarter());
    assertEquals(ApplicationStatus.CLOSED, captor.getValue().getApplicationStatus());
    verify(recruitmentRepository)
        .findFirstByQuarterLessThanAndTypeOrderByQuarterDesc("20261", RecruitmentType.TA);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void with_no_earlier_recruitment_of_its_type_a_new_one_has_the_default_target()
      throws Exception {
    when(recruitmentRepository.findFirstByQuarterLessThanAndTypeOrderByQuarterDesc(any(), any()))
        .thenReturn(Optional.empty());
    Recruitment saved = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentAuditService.saveAndRecordCreated(any())).thenReturn(saved);
    when(populateRecruitmentCoursesJobFactory.create(saved))
        .thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk());

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentAuditService).saveAndRecordCreated(captor.capture());
    assertEquals(1, captor.getValue().getTotalHiringTarget());
  }

  /**
   * Developer Mode's auto-create posts a TA and then a ULA recruitment for the quarter to this same
   * endpoint: each copies the target of its own type, from whichever earlier quarter last had one.
   */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void auto_created_ta_and_ula_recruitments_each_copy_their_own_types_target()
      throws Exception {
    when(recruitmentRepository.findFirstByQuarterLessThanAndTypeOrderByQuarterDesc(
            "20261", RecruitmentType.TA))
        .thenReturn(Optional.of(earlier(3L, "20254", RecruitmentType.TA, 12)));
    when(recruitmentRepository.findFirstByQuarterLessThanAndTypeOrderByQuarterDesc(
            "20261", RecruitmentType.ULA))
        .thenReturn(Optional.of(earlier(4L, "20252", RecruitmentType.ULA, 30)));
    when(recruitmentAuditService.saveAndRecordCreated(any()))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(populateRecruitmentCoursesJobFactory.create(any()))
        .thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk());
    mockMvc
        .perform(post(CREATE_URL.replace("type=TA", "type=ULA")).with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalHiringTarget").value(30));

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentAuditService, times(2)).saveAndRecordCreated(captor.capture());
    assertEquals(RecruitmentType.TA, captor.getAllValues().get(0).getType());
    assertEquals(12, captor.getAllValues().get(0).getTotalHiringTarget());
    assertEquals(RecruitmentType.ULA, captor.getAllValues().get(1).getType());
    assertEquals(30, captor.getAllValues().get(1).getTotalHiringTarget());
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

    assertEquals(ApplicationStatus.OPEN, r.getApplicationStatus());
    assertEquals(LocalDate.now(), r.getActualOpeningDate());
    // Issue #139: the snapshot is taken before the change and the differences recorded with the
    // save (one transaction, issue #377), so the trail shows the status and the stamped date.
    InOrder inOrder = inOrder(recruitmentAuditService);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentAuditService).saveAndRecordChanges(before, r);
    verify(recruitmentRepository, never()).save(any());
    // The updated recruitment comes back, so the page can render the new state.
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
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

    verify(recruitmentAuditService, times(1)).saveAndRecordChanges(any(), any());
    assertEquals(original, r.getActualOpeningDate());
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

    verify(recruitmentAuditService, times(1)).saveAndRecordChanges(any(), any());
    assertEquals(ApplicationStatus.CLOSED, r.getApplicationStatus());
    // Overwritten, unlike the opening date.
    assertEquals(LocalDate.now(), r.getActualClosingDate());
  }

  /** Issue #281: a Close from a page that is a few seconds stale must not stamp the date again. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void closing_an_already_closed_recruitment_changes_and_records_nothing() throws Exception {
    LocalDate original = LocalDate.of(2026, 1, 1);
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setActualClosingDate(original);
    r.setApplicationStatus(ApplicationStatus.CLOSED);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/recruitments/status?id=1&status=CLOSED").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(original, r.getActualClosingDate());
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void opening_an_already_open_recruitment_changes_and_records_nothing() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setApplicationStatus(ApplicationStatus.OPEN);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(put("/api/admin/recruitments/status?id=1&status=OPEN").with(csrf()))
        .andExpect(status().isOk());

    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_status_on_an_unknown_recruitment_is_a_404() throws Exception {
    // (issue #139) nothing is recorded for a recruitment that does not exist
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(put("/api/admin/recruitments/status?id=99&status=OPEN").with(csrf()))
        .andExpect(status().isNotFound());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
    verify(recruitmentRepository, never()).bumpAssignmentsVersion(any());
    verify(recruitmentAuditService, never()).snapshot(any());
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
    InOrder inOrder = inOrder(recruitmentAuditService);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentAuditService).saveAndRecordChanges(before, r);
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void opening_reviews_without_a_deadline_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=Open").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void changing_a_deadline_without_a_date_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/facultyRankingDeadline?id=1").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_review_status_is_a_400() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/reviewStatus?id=1&status=open").with(csrf()))
        .andExpect(status().isBadRequest());
    verify(recruitmentRepository, never()).findById(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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

    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);

    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    mockMvc
        .perform(
            put("/api/admin/recruitments/facultyRankingDeadline?id=1"
                    + "&facultyRankingDeadline=2026-02-15")
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.facultyRankingDeadline").value("2026-02-15"));
    verify(recruitmentAuditService, times(1)).snapshot(any());
    verify(recruitmentAuditService, times(1)).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    List<Application> fifteen = new ArrayList<>();
    for (int i = 0; i < 15; i++) {
      fifteen.add(Application.builder().recruitmentId(1L).email("a" + i + "@ucsb.edu").build());
    }
    // Test and fake applications do not count while Developer Mode is off (issue #219).
    fifteen.add(Application.builder().origin(ApplicationOrigin.ADMIN_TEST).build());
    fifteen.add(Application.builder().origin(ApplicationOrigin.DEVELOPER_MODE).build());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(1L)).thenReturn(fifteen);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(2L)).thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitments/applicationCounts"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("{\"1\":15,\"2\":0}", response.getResponse().getContentAsString());
  }

  /** Issue #318: a cancelled application and the new one that followed it are one applicant. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_applicant_who_cancelled_and_applied_again_counts_once() throws Exception {
    when(recruitmentRepository.findAll())
        .thenReturn(List.of(recruitment(1L, "20261", RecruitmentType.TA)));
    Application cancelled =
        Application.builder().email("a@ucsb.edu").status(ApplicationReviewStatus.CANCELLED).build();
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(1L))
        .thenReturn(
            List.of(
                cancelled,
                Application.builder().email("a@ucsb.edu").attemptNumber(2).build(),
                Application.builder().email("b@ucsb.edu").build()));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitments/applicationCounts"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("{\"1\":2}", response.getResponse().getContentAsString());
  }

  /** Developer Mode counts test and fake applications as real, so every feature can be tried. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void test_and_fake_applications_count_in_developer_mode() throws Exception {
    when(developerModeService.isOn()).thenReturn(true);
    when(recruitmentRepository.findAll())
        .thenReturn(List.of(recruitment(1L, "20261", RecruitmentType.TA)));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(1L))
        .thenReturn(
            List.of(
                Application.builder().email("a@ucsb.edu").build(),
                Application.builder()
                    .email("b@ucsb.edu")
                    .origin(ApplicationOrigin.ADMIN_TEST)
                    .build(),
                Application.builder()
                    .email("c@ucsb.edu")
                    .origin(ApplicationOrigin.DEVELOPER_MODE)
                    .build()));

    MvcResult response =
        mockMvc
            .perform(get("/api/admin/recruitments/applicationCounts"))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("{\"1\":3}", response.getResponse().getContentAsString());
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

    // Issue #139: the deletion is recorded so the trail says the recruitment existed; issue #377:
    // the row and the delete are one transaction in the audit service, not two calls from here.
    verify(recruitmentAuditService, times(1)).deleteAndRecord(r);
    verify(recruitmentRepository, never()).delete(any());
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
    verify(recruitmentAuditService, never()).deleteAndRecord(any());
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/recruitments/delete?id=1").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentAuditService, never()).deleteAndRecord(any());
  }

  // ---- the cost per position moved to the Budget (issue #388) ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_cost_per_position_endpoint_is_gone() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/avgCostPerPosition?id=1&avgCostPerPosition=5")
                .with(csrf()))
        .andExpect(status().isNotFound());
    verify(recruitmentRepository, never()).save(any());
  }

  // ---- PUT /api/admin/recruitments/assignmentsPublished (issues #180 and #237) ----

  /**
   * Every prerequisite of releasing hiring decisions met: ranking and applications closed, one
   * assigned.
   */
  private void releasable(Recruitment r) {
    r.setReviewStatus("Closed");
    r.setApplicationStatus(ApplicationStatus.CLOSED);
    when(assignmentsService.anyAssigned(r.getId())).thenReturn(true);
  }

  private String publishRefusal(Recruitment r) throws Exception {
    when(recruitmentRepository.findById(r.getId())).thenReturn(Optional.of(r));
    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/assignmentsPublished?id="
                        + r.getId()
                        + "&published=true")
                    .with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
    assertNotEquals(true, r.getAssignmentsPublished());
    return (String) responseToJson(response).get("message");
  }

  @Test
  public void logged_out_users_cannot_publish_assignments() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=true").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_publish_assignments() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=true").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    releasable(r);
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
    inOrder.verify(recruitmentAuditService).saveAndRecordChanges(before, r);
    // Issue #280: a page that has not seen this is out of date.
    inOrder.verify(recruitmentRepository).bumpAssignmentsVersion(1L);
    verify(recruitmentRepository, never()).save(any());
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
    verify(recruitmentAuditService).saveAndRecordChanges(before, r);
    verify(recruitmentRepository).bumpAssignmentsVersion(1L);
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
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unset_published_flag_counts_as_unpublished() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    releasable(r);
    r.setAssignmentsPublished(null);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=false").with(csrf()))
        .andExpect(status().isOk());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());

    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=true").with(csrf()))
        .andExpect(status().isOk());
    assertEquals(true, r.getAssignmentsPublished());
    verify(recruitmentAuditService).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  // ---- PUT /api/admin/recruitments/totalHiringTarget (issue #174) ----

  @Test
  public void logged_out_users_cannot_change_the_hiring_target() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=5").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_change_the_hiring_target() throws Exception {
    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=5").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_new_recruitment_expects_to_hire_one() {
    assertEquals(1, recruitment(1L, "20261", RecruitmentType.TA).getTotalHiringTarget());
  }

  /**
   * Saved and returned, and (issue #391) written to the audit trail: the snapshot is taken before
   * the change, and the save and its rows go through the audit service in one transaction.
   */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admin_can_change_the_hiring_target_and_the_change_is_audited() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    RecruitmentAuditService.Snapshot before =
        new RecruitmentAuditService.Snapshot(1L, Map.of("totalHiringTarget", "1"));
    when(recruitmentAuditService.snapshot(r)).thenReturn(before);

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=12")
                    .with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(12, r.getTotalHiringTarget());
    assertEquals(mapper.writeValueAsString(r), response.getResponse().getContentAsString());
    // The snapshot comes first, then the audited save; the controller itself saves nothing.
    // Issue #176: every section's share depends on the target, recomputed after the save.
    InOrder inOrder = inOrder(recruitmentAuditService, allocationService);
    inOrder.verify(recruitmentAuditService).snapshot(r);
    inOrder.verify(recruitmentAuditService).saveAndRecordChanges(before, r);
    inOrder.verify(allocationService).recompute(r);
    verify(recruitmentRepository, never()).save(any());
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
    verify(recruitmentAuditService, times(1)).saveAndRecordChanges(any(), eq(r));
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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

    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
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

  /**
   * The endpoint looks the recruitment up and hands it to the shared service, which saves and
   * audits the change (see AllocationVisibilityServiceTests); the response is the recruitment the
   * service returns.
   */
  private void assertVisibilityChange(
      AllocationVisibility from, AllocationVisibility to, RecruitmentType type) throws Exception {
    Recruitment r = recruitment(1L, "20261", type);
    r.setAllocationVisibility(from);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(allocationVisibilityService.change(r, to))
        .thenAnswer(
            invocation -> {
              r.setAllocationVisibility(to);
              return r;
            });

    MvcResult response =
        mockMvc
            .perform(put(VISIBILITY_URL + "?id=1&visibility=" + to.name()).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    verify(allocationVisibilityService).change(r, to);
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
  public void choosing_the_visibility_it_already_has_returns_the_recruitment_as_it_is()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(allocationVisibilityService.change(r, AllocationVisibility.OWN_COURSES)).thenReturn(r);

    MvcResult response =
        mockMvc
            .perform(put(VISIBILITY_URL + "?id=1&visibility=OWN_COURSES").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(AllocationVisibility.OWN_COURSES, r.getAllocationVisibility());
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
    verify(allocationVisibilityService, never()).change(any(), any());
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
    when(recruitmentAuditService.saveAndRecordCreated(any())).thenReturn(saved);
    when(populateRecruitmentCoursesJobFactory.create(saved))
        .thenReturn(PopulateRecruitmentCoursesJob.builder().build());

    mockMvc.perform(post(CREATE_URL).with(csrf())).andExpect(status().isOk());

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentAuditService).saveAndRecordCreated(captor.capture());
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
  public void publishing_stamps_each_time_and_taking_it_back_keeps_the_last_stamp()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    releasable(r);
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

  // ---- releasing hiring decisions needs its prerequisites (issue #237) ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void publishing_while_faculty_ranking_is_not_closed_is_refused() throws Exception {
    for (String reviewStatus : List.of("NotStarted", "Open")) {
      Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
      releasable(r);
      r.setReviewStatus(reviewStatus);
      assertEquals("Close Faculty Ranking before releasing hiring decisions.", publishRefusal(r));
    }
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void publishing_while_applications_are_open_is_refused() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    releasable(r);
    r.setApplicationStatus(ApplicationStatus.OPEN);
    assertEquals("Close Applications before releasing hiring decisions.", publishRefusal(r));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void publishing_with_nobody_assigned_is_refused() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    releasable(r);
    when(assignmentsService.anyAssigned(1L)).thenReturn(false);
    assertEquals(
        "Assign candidates to slots before releasing hiring decisions.", publishRefusal(r));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_first_unmet_prerequisite_is_the_one_named() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setReviewStatus("Open");
    r.setApplicationStatus(ApplicationStatus.OPEN);
    when(assignmentsService.anyAssigned(1L)).thenReturn(false);
    assertEquals("Close Faculty Ranking before releasing hiring decisions.", publishRefusal(r));

    r.setReviewStatus("Closed");
    assertEquals("Close Applications before releasing hiring decisions.", publishRefusal(r));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void taking_published_assignments_back_is_never_refused() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setAssignmentsPublished(true);
    r.setReviewStatus("Open");
    r.setApplicationStatus(ApplicationStatus.OPEN);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));
    when(recruitmentAuditService.snapshot(r))
        .thenReturn(new RecruitmentAuditService.Snapshot(1L, Map.of()));

    mockMvc
        .perform(
            put("/api/admin/recruitments/assignmentsPublished?id=1&published=false").with(csrf()))
        .andExpect(status().isOk());

    assertEquals(false, r.getAssignmentsPublished());
    verify(assignmentsService, never()).anyAssigned(any());
  }

  // ---- compare-and-set on the hiring target (issue #277; the cost moved to the Budget, #388) ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_hiring_target_save_that_expects_the_stored_value_is_applied() throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setTotalHiringTarget(7);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    mockMvc
        .perform(
            put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=9&expected=7")
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(9, r.getTotalHiringTarget());
    verify(recruitmentAuditService).saveAndRecordChanges(any(), eq(r));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_hiring_target_save_that_expects_a_stale_value_is_a_409_and_changes_nothing()
      throws Exception {
    Recruitment r = recruitment(1L, "20261", RecruitmentType.TA);
    r.setTotalHiringTarget(8);
    when(recruitmentRepository.findById(1L)).thenReturn(Optional.of(r));

    MvcResult response =
        mockMvc
            .perform(
                put("/api/admin/recruitments/totalHiringTarget?id=1&totalHiringTarget=9&expected=7")
                    .with(csrf()))
            .andExpect(status().isConflict())
            .andReturn();

    assertEquals(
        "The hiring target was changed in another tab or window.",
        responseToJson(response).get("message"));
    assertEquals(8, r.getTotalHiringTarget());
    // Issue #391: refused before the snapshot, so nothing is saved or audited.
    verify(recruitmentAuditService, never()).snapshot(any());
    verify(recruitmentAuditService, never()).saveAndRecordChanges(any(), any());
    verify(allocationService, never()).recompute(any());
  }
}
