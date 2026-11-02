package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.OtherClient;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.RecruitmentCoursesRefreshService;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import edu.ucsb.cs.taapply.testconfig.ResettableDetectorConfig;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The multi-tab warning and the version check for the Courses edit page (issue #278): the heartbeat
 * and leave endpoints keyed {@code courses-edit:<recruitmentId>}, the saves that name their client,
 * and the allocation versions that refuse a stale edit.
 */
@WebMvcTest(controllers = RecruitmentCoursesController.class)
@Import({edu.ucsb.cs.taapply.testconfig.TestConfig.class, ResettableDetectorConfig.class})
public class RecruitmentCoursesConcurrencyTests extends ControllerTestCase {

  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean UCSBCurriculumService ucsbCurriculumService;
  @MockitoBean RecruitmentCoursesRefreshService recruitmentCoursesRefreshService;
  @MockitoBean AllocationService allocationService;
  @MockitoBean UserRepository userRepository;
  @Autowired ResettableDetectorConfig.Resettable detector;

  private static final String CLIENT_ID = "X-Client-Id";
  private static final String KEY = "courses-edit:7";
  private static final ClientIdentity OTHER_ADMIN =
      new ClientIdentity("other@example.org", "other@example.org (Other Admin)");

  private Recruitment recruitment;
  private RecruitmentCourse course;

  @BeforeEach
  public void setUp() {
    detector.reset();
    recruitment = Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();
    course = RecruitmentCourse.builder().id(1L).recruitmentId(7L).courseId("CMPSC   156").build();
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));
  }

  private ResultActions as(
      org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
      String clientId)
      throws Exception {
    return mockMvc.perform(
        (clientId == null ? request : request.header(CLIENT_ID, clientId)).with(csrf()));
  }

  private ResultActions heartbeat(long recruitmentId, String clientId) throws Exception {
    return as(post("/api/recruitmentcourses/heartbeat?recruitmentId=" + recruitmentId), clientId);
  }

  // ---- heartbeat ----

  @Test
  public void logged_out_users_cannot_heartbeat() throws Exception {
    heartbeat(7L, "tab").andExpect(status().isForbidden());
    assertEquals(List.of(), detector.othersActive(KEY, "observer"));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void a_caller_without_access_is_forbidden_names_no_one_and_records_nothing()
      throws Exception {
    detector.record(KEY, "admins-tab", OTHER_ADMIN);

    String body =
        heartbeat(7L, "intruder")
            .andExpect(status().isForbidden())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertFalse(body.contains("Other Admin"));
    assertEquals(
        List.of(new OtherClient("other@example.org (Other Admin)", false)),
        detector.othersActive(KEY, "observer"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_alone_sees_no_one_and_is_told_how_often_to_beat() throws Exception {
    heartbeat(7L, "only-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.heartbeatSeconds").value(5))
        .andExpect(jsonPath("$.newest").value(true));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_sees_the_names_of_the_others_on_the_same_recruitment() throws Exception {
    detector.record(KEY, "admins-tab", OTHER_ADMIN);

    heartbeat(7L, "my-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("other@example.org (Other Admin)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_second_tab_of_the_same_admin_is_the_same_person() throws Exception {
    heartbeat(7L, "first").andExpect(status().isOk());
    heartbeat(7L, "second")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_different_recruitment_never_warns() throws Exception {
    Recruitment other = Recruitment.builder().id(8L).build();
    when(recruitmentRepository.findById(8L)).thenReturn(Optional.of(other));
    detector.record("courses-edit:8", "elsewhere", OTHER_ADMIN);

    heartbeat(7L, "my-tab").andExpect(jsonPath("$.others.length()").value(0));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_heartbeat_for_an_unknown_recruitment_is_a_404_and_records_nothing()
      throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    heartbeat(99L, "tab").andExpect(status().isNotFound());
    assertEquals(List.of(), detector.othersActive("courses-edit:99", "observer"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_heartbeat_that_names_no_client_finds_no_one_and_is_not_recorded() throws Exception {
    heartbeat(7L, null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.newest").value(false));
    assertEquals(List.of(), detector.othersActive(KEY, "observer"));
  }

  // ---- leave ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_who_leaves_stops_being_counted_at_once() throws Exception {
    heartbeat(7L, "gone").andExpect(status().isOk());

    as(post("/api/recruitmentcourses/leave?recruitmentId=7"), "gone")
        .andExpect(status().isNoContent());

    assertEquals(List.of(), detector.othersActive(KEY, "observer"));
  }

  @WithMockUser(roles = {"USER", "INSTRUCTOR"})
  @Test
  public void a_caller_without_access_cannot_make_an_admin_leave() throws Exception {
    detector.record(KEY, "admins-tab", OTHER_ADMIN);

    as(post("/api/recruitmentcourses/leave?recruitmentId=7"), "admins-tab")
        .andExpect(status().isForbidden());

    assertEquals(1, detector.othersActive(KEY, "observer").size());
  }

  // ---- saves name their client ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_allocation_save_counts_as_being_there() throws Exception {
    as(put("/api/recruitmentcourses/allocation?id=1&allocation=2"), "typing")
        .andExpect(status().isOk());

    assertEquals(1, detector.othersActive(KEY, "observer").size());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_estimate_save_counts_as_being_there() throws Exception {
    as(put("/api/recruitmentcourses/enrollmentEstimate?id=1&enrollmentEstimate=5"), "typing")
        .andExpect(status().isOk());

    assertEquals(1, detector.othersActive(KEY, "observer").size());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void filling_the_estimates_counts_as_being_there() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());

    as(put("/api/recruitmentcourses/enrollmentEstimates?recruitmentId=7&source=MAX"), "typing")
        .andExpect(status().isOk());

    assertEquals(1, detector.othersActive(KEY, "observer").size());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void auto_allocate_counts_as_being_there() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());

    as(post("/api/recruitmentcourses/autoAllocate?recruitmentId=7"), "typing")
        .andExpect(status().isOk());

    assertEquals(1, detector.othersActive(KEY, "observer").size());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_save_that_names_no_client_is_not_recorded() throws Exception {
    as(put("/api/recruitmentcourses/allocation?id=1&allocation=2"), null)
        .andExpect(status().isOk());

    assertEquals(List.of(), detector.othersActive(KEY, "observer"));
  }

  // ---- the version check ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_allocation_edit_bumps_the_rows_version() throws Exception {
    course.setAllocationVersion(4);

    as(put("/api/recruitmentcourses/allocation?id=1&allocation=3&expectedVersion=4"), "tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.allocation").value(3))
        .andExpect(jsonPath("$.allocationVersion").value(5));

    assertEquals(5, course.getAllocationVersion());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_edit_made_from_an_old_row_version_is_refused_and_changes_nothing()
      throws Exception {
    course.setAllocationVersion(4);
    course.setAllocation(1);

    as(put("/api/recruitmentcourses/allocation?id=1&allocation=3&expectedVersion=3"), "tab")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.reloadAll").value(false))
        .andExpect(
            jsonPath("$.message")
                .value("This allocation was changed in another tab or window. Reload to see it."))
        .andExpect(jsonPath("$.allocationBulkVersion").isEmpty())
        .andExpect(jsonPath("$.course.allocation").value(1))
        .andExpect(jsonPath("$.course.allocationVersion").value(4));

    assertEquals(1, course.getAllocation());
    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_edit_made_from_an_old_bulk_version_is_refused_and_says_to_reload_everything()
      throws Exception {
    recruitment.setAllocationBulkVersion(2);

    as(
            put(
                "/api/recruitmentcourses/allocation?id=1&allocation=3&expectedVersion=0"
                    + "&expectedBulkVersion=1"),
            "tab")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.reloadAll").value(true))
        .andExpect(
            jsonPath("$.message")
                .value(
                    "All the allocations were changed in another tab or window. Reload to see"
                        + " them."))
        .andExpect(jsonPath("$.allocationBulkVersion").value(2));

    verify(recruitmentCourseRepository, never()).save(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_edit_that_carries_current_versions_is_accepted() throws Exception {
    recruitment.setAllocationBulkVersion(2);

    as(
            put(
                "/api/recruitmentcourses/allocation?id=1&allocation=3&expectedVersion=0"
                    + "&expectedBulkVersion=2"),
            "tab")
        .andExpect(status().isOk());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void auto_allocate_bumps_the_recruitments_bulk_version() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    recruitment.setAllocationBulkVersion(2);

    as(post("/api/recruitmentcourses/autoAllocate?recruitmentId=7"), "tab")
        .andExpect(status().isOk());

    assertEquals(3, recruitment.getAllocationBulkVersion());
    verify(recruitmentRepository).save(recruitment);
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
  public void an_admin_is_labelled_by_the_email_and_the_trimmed_name_or_the_email_alone()
      throws Exception {
    mockMvc
        .perform(
            post("/api/recruitmentcourses/heartbeat?recruitmentId=7")
                .header(CLIENT_ID, "named-tab")
                .with(adminNamed("named@example.org", " Nora Named "))
                .with(csrf()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/recruitmentcourses/heartbeat?recruitmentId=7")
                .header(CLIENT_ID, "nameless-tab")
                .with(adminNamed("nameless@example.org", null))
                .with(csrf()))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            post("/api/recruitmentcourses/heartbeat?recruitmentId=7")
                .header(CLIENT_ID, "blank-tab")
                .with(adminNamed("blank@example.org", "   "))
                .with(csrf()))
        .andExpect(status().isOk());

    assertEquals(
        List.of(
            new OtherClient("blank@example.org", false),
            new OtherClient("named@example.org (Nora Named)", false),
            new OtherClient("nameless@example.org", false)),
        detector.othersActive(KEY, "observer"));
  }
}
