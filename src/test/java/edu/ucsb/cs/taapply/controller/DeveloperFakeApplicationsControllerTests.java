package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.AuditTrail;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationOrigin;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.jobs.CreateFakeApplicationsJob;
import edu.ucsb.cs.taapply.jobs.CreateFakeApplicationsJobFactory;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.AuditTrailRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.fake.FakeCoverage;
import edu.ucsb.cs156.jobs.entities.Job;
import edu.ucsb.cs156.jobs.services.JobService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = DeveloperFakeApplicationsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class DeveloperFakeApplicationsControllerTests extends ControllerTestCase {

  @MockitoBean DeveloperModeService developerModeService;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean AuditTrailRepository auditTrailRepository;
  @MockitoBean CreateFakeApplicationsJobFactory createFakeApplicationsJobFactory;
  @MockitoBean JobService jobService;
  @MockitoBean UserRepository userRepository;

  private static final String CREATE = "/api/admin/developer/fakeApplications";

  private static final Recruitment RECRUITMENT =
      Recruitment.builder().id(7L).quarter("20261").type(RecruitmentType.TA).build();

  @BeforeEach
  void developerModeOnWithFiveCourses() {
    when(developerModeService.isOn()).thenReturn(true);
    when(recruitmentRepository.findById(7L)).thenReturn(Optional.of(RECRUITMENT));
    // Five that count, and a sixth the admin removed, which does not.
    List<RecruitmentCourse> courses =
        IntStream.rangeClosed(1, 5)
            .mapToObj(i -> RecruitmentCourse.builder().id((long) i).courseId("C" + i).build())
            .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
    courses.add(RecruitmentCourse.builder().id(6L).courseId("C6").removed(true).build());
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(courses);
  }

  private static String url(String path, String recruitment, String count, String coverage) {
    return path + "?recruitmentId=" + recruitment + "&count=" + count + "&coverage=" + coverage;
  }

  // ---- POST: who may ----

  @Test
  public void logged_out_users_cannot_create() throws Exception {
    mockMvc.perform(post(url(CREATE, "7", "20", "ALL")).with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_create() throws Exception {
    mockMvc.perform(post(url(CREATE, "7", "20", "ALL")).with(csrf())).andExpect(status().is(403));
    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_cannot_create() throws Exception {
    mockMvc.perform(post(url(CREATE, "7", "20", "ALL")).with(csrf())).andExpect(status().is(403));
  }

  // ---- POST: what it does ----

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_launches_the_job_for_a_count_in_range() throws Exception {
    CreateFakeApplicationsJob job = CreateFakeApplicationsJob.builder().build();
    Job launched = Job.builder().id(3L).status("running").build();
    when(createFakeApplicationsJobFactory.create(7L, 20, FakeCoverage.SPARSE)).thenReturn(job);
    when(jobService.runAsJob(job)).thenReturn(launched);

    MvcResult response =
        mockMvc
            .perform(post(url(CREATE, "7", "20", "SPARSE")).with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals(mapper.writeValueAsString(launched), response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_smallest_and_largest_counts_are_two_and_ten_per_course() throws Exception {
    CreateFakeApplicationsJob job = CreateFakeApplicationsJob.builder().build();
    when(createFakeApplicationsJobFactory.create(any(), anyInt(), any())).thenReturn(job);
    when(jobService.runAsJob(job)).thenReturn(Job.builder().id(1L).build());

    mockMvc.perform(post(url(CREATE, "7", "10", "ALL")).with(csrf())).andExpect(status().isOk());
    mockMvc.perform(post(url(CREATE, "7", "50", "ALL")).with(csrf())).andExpect(status().isOk());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_count_outside_that_range_is_a_400_and_launches_nothing() throws Exception {
    for (String count : List.of("9", "51", "0", "-5")) {
      MvcResult response =
          mockMvc
              .perform(post(url(CREATE, "7", count, "ALL")).with(csrf()))
              .andExpect(status().isBadRequest())
              .andReturn();
      assertEquals(
          Map.of(
              "type",
              "IllegalArgumentException",
              "message",
              "count must be between 10 and 50 for 5 course(s)"),
          responseToJson(response));
    }
    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_recruitment_with_no_courses_is_a_400() throws Exception {
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(
            List.of(RecruitmentCourse.builder().id(1L).courseId("C1").removed(true).build()));

    MvcResult response =
        mockMvc
            .perform(post(url(CREATE, "7", "10", "ALL")).with(csrf()))
            .andExpect(status().isBadRequest())
            .andReturn();

    assertEquals(
        Map.of(
            "type",
            "IllegalArgumentException",
            "message",
            "This recruitment has no courses to apply to"),
        responseToJson(response));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_unknown_coverage_is_a_400() throws Exception {
    mockMvc
        .perform(post(url(CREATE, "7", "20", "SOME")).with(csrf()))
        .andExpect(status().isBadRequest());
    verify(jobService, never()).runAsJob(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_missing_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc
            .perform(post(url(CREATE, "99", "20", "ALL")).with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals(
        Map.of("type", "EntityNotFoundException", "message", "Recruitment with id 99 not found"),
        responseToJson(response));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void with_developer_mode_off_create_is_a_404() throws Exception {
    when(developerModeService.isOn()).thenReturn(false);

    MvcResult response =
        mockMvc
            .perform(post(url(CREATE, "7", "20", "ALL")).with(csrf()))
            .andExpect(status().isNotFound())
            .andReturn();

    assertEquals(
        Map.of("type", "EntityNotFoundException", "message", "Developer mode is not on"),
        responseToJson(response));
    verify(jobService, never()).runAsJob(any());
  }

  // ---- DELETE ----

  private static Application app(long id, ApplicationOrigin origin) {
    return Application.builder().id(id).recruitmentId(7L).origin(origin).build();
  }

  @Test
  public void logged_out_users_cannot_delete() throws Exception {
    mockMvc.perform(delete(CREATE + "?recruitmentId=7").with(csrf())).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void regular_users_cannot_delete() throws Exception {
    mockMvc.perform(delete(CREATE + "?recruitmentId=7").with(csrf())).andExpect(status().is(403));
    verify(applicationRepository, never()).deleteAll(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_deletes_only_the_fake_applications_and_their_audit_rows() throws Exception {
    Application fakeOne = app(1L, ApplicationOrigin.DEVELOPER_MODE);
    Application real = app(2L, ApplicationOrigin.APPLICANT);
    Application test = app(3L, ApplicationOrigin.ADMIN_TEST);
    Application fakeTwo = app(4L, ApplicationOrigin.DEVELOPER_MODE);
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(fakeOne, real, test, fakeTwo));
    AuditTrail taRow = AuditTrail.builder().id(10L).build();
    AuditTrail ulaRow = AuditTrail.builder().id(11L).build();
    when(auditTrailRepository.findByTaApplicationIdOrderByIdAsc(1L)).thenReturn(List.of(taRow));
    when(auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(4L)).thenReturn(List.of(ulaRow));
    when(auditTrailRepository.findByTaApplicationIdOrderByIdAsc(4L)).thenReturn(List.of());
    when(auditTrailRepository.findByUlaApplicationIdOrderByIdAsc(1L)).thenReturn(List.of());

    MvcResult response =
        mockMvc
            .perform(delete(CREATE + "?recruitmentId=7").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("{\"deleted\":2}", response.getResponse().getContentAsString());
    verify(applicationRepository).deleteAll(List.of(fakeOne, fakeTwo));
    verify(auditTrailRepository).deleteAll(List.of(taRow));
    verify(auditTrailRepository).deleteAll(List.of(ulaRow));
    verify(auditTrailRepository, never()).findByTaApplicationIdOrderByIdAsc(2L);
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_when_there_are_no_fakes_deletes_nothing() throws Exception {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(7L))
        .thenReturn(List.of(app(2L, ApplicationOrigin.APPLICANT)));

    MvcResult response =
        mockMvc
            .perform(delete(CREATE + "?recruitmentId=7").with(csrf()))
            .andExpect(status().isOk())
            .andReturn();

    assertEquals("{\"deleted\":0}", response.getResponse().getContentAsString());
    verify(applicationRepository).deleteAll(List.of());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void with_developer_mode_off_delete_is_a_404() throws Exception {
    when(developerModeService.isOn()).thenReturn(false);

    mockMvc
        .perform(delete(CREATE + "?recruitmentId=7").with(csrf()))
        .andExpect(status().isNotFound());
    verify(applicationRepository, never()).deleteAll(any());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void deleting_for_a_missing_recruitment_is_a_404() throws Exception {
    when(recruitmentRepository.findById(99L)).thenReturn(Optional.empty());

    mockMvc
        .perform(delete(CREATE + "?recruitmentId=99").with(csrf()))
        .andExpect(status().isNotFound());
    verify(applicationRepository, never()).deleteAll(any());
  }
}
