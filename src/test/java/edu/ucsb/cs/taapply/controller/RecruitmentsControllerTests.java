package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJob;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs156.jobs.services.JobService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = edu.ucsb.cs.taapply.controller.RecruitmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class RecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean JobService jobService;
  @MockitoBean PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;
  @MockitoBean UserRepository userRepository;

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

    verify(recruitmentRepository, never()).save(any());
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

    MvcResult response =
        mockMvc
            .perform(put("/api/admin/recruitments/status?id=1&status=OPEN").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    ArgumentCaptor<Recruitment> captor = ArgumentCaptor.forClass(Recruitment.class);
    verify(recruitmentRepository, times(1)).save(captor.capture());
    assertEquals(ApplicationStatus.OPEN, captor.getValue().getApplicationStatus());
    assertEquals(LocalDate.now(), captor.getValue().getActualOpeningDate());
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
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(put("/api/admin/recruitments/status?id=99&status=OPEN").with(csrf()))
        .andExpect(status().isNotFound());
    verify(recruitmentRepository, never()).save(any());
  }

  @Test
  public void logged_out_users_cannot_change_status() throws Exception {
    mockMvc
        .perform(put("/api/admin/recruitments/status?id=1&status=OPEN").with(csrf()))
        .andExpect(status().is(403));
  }

  // ---- delete ----

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
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc
        .perform(delete("/api/admin/recruitments/delete?id=1").with(csrf()))
        .andExpect(status().is(403));
    verify(recruitmentRepository, never()).delete(any());
  }
}
