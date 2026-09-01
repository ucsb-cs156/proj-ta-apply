package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = ApplicantRecruitmentsController.class)
@Import({edu.ucsb.cs.taapply.testconfig.TestConfig.class, ApplicationAccessService.class})
public class ApplicantRecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean UserRepository userRepository;

  private static Recruitment recruitment(
      long id,
      String quarter,
      RecruitmentType type,
      ApplicationStatus status,
      LocalDate opened,
      LocalDate closed) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .applicationStatus(status)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .actualOpeningDate(opened)
        .actualClosingDate(closed)
        .build();
  }

  private static final Recruitment OPEN_TA =
      recruitment(
          1L, "20262", RecruitmentType.TA, ApplicationStatus.OPEN, LocalDate.of(2026, 1, 5), null);
  private static final Recruitment OPEN_ULA =
      recruitment(
          2L, "20262", RecruitmentType.ULA, ApplicationStatus.OPEN, LocalDate.of(2026, 1, 5), null);
  private static final Recruitment UPCOMING_TA =
      recruitment(3L, "20263", RecruitmentType.TA, ApplicationStatus.CLOSED, null, null);
  private static final Recruitment CLOSED_TA =
      recruitment(
          4L,
          "20261",
          RecruitmentType.TA,
          ApplicationStatus.CLOSED,
          LocalDate.of(2025, 10, 1),
          LocalDate.of(2025, 11, 1));
  private static final Recruitment OLDER_CLOSED_TA =
      recruitment(
          5L,
          "20254",
          RecruitmentType.TA,
          ApplicationStatus.CLOSED,
          LocalDate.of(2025, 4, 1),
          LocalDate.of(2025, 5, 1));

  /** Descending by quarter, as the repository method promises. */
  private void seedAll() {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(UPCOMING_TA, OPEN_TA, OPEN_ULA, CLOSED_TA, OLDER_CLOSED_TA));
  }

  private String getJson(String url) throws Exception {
    MvcResult response = mockMvc.perform(get(url)).andExpect(status().isOk()).andReturn();
    return response.getResponse().getContentAsString();
  }

  // ---- authorization ----

  @Test
  public void logged_out_users_get_nothing() throws Exception {
    mockMvc.perform(get("/api/recruitments/open")).andExpect(status().is(403));
    mockMvc.perform(get("/api/recruitments/upcoming")).andExpect(status().is(403));
    mockMvc.perform(get("/api/recruitments/recentlyClosed")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_plain_user_gets_nothing() throws Exception {
    mockMvc.perform(get("/api/recruitments/open")).andExpect(status().is(403));
    mockMvc.perform(get("/api/recruitments/upcoming")).andExpect(status().is(403));
    mockMvc.perform(get("/api/recruitments/recentlyClosed")).andExpect(status().is(403));
  }

  /**
   * An instructor may reach the endpoint through the admin role but is not an applicant, so the
   * answer is an empty list rather than everyone else's recruitments.
   */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void a_non_applicant_sees_no_recruitments() throws Exception {
    seedAll();

    assertEquals("[]", getJson("/api/recruitments/open"));
    assertEquals("[]", getJson("/api/recruitments/upcoming"));
    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  // ---- open ----

  /** The ULA recruitment is open too, and must not appear. */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void a_grad_student_sees_only_open_ta_recruitments() throws Exception {
    seedAll();

    assertEquals(mapper.writeValueAsString(List.of(OPEN_TA)), getJson("/api/recruitments/open"));
  }

  @WithMockUser(roles = {"UNDERGRAD"})
  @Test
  public void an_undergrad_sees_only_open_ula_recruitments() throws Exception {
    seedAll();

    assertEquals(mapper.writeValueAsString(List.of(OPEN_ULA)), getJson("/api/recruitments/open"));
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void nothing_open_is_an_empty_list() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(CLOSED_TA, OPEN_ULA));

    assertEquals("[]", getJson("/api/recruitments/open"));
  }

  // ---- upcoming ----

  /** Created but never opened; the closed one that has opened before is not upcoming. */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void upcoming_is_the_closed_recruitment_that_has_never_opened() throws Exception {
    seedAll();

    assertEquals(
        mapper.writeValueAsString(List.of(UPCOMING_TA)), getJson("/api/recruitments/upcoming"));
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void an_open_recruitment_is_not_upcoming() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(OPEN_TA));

    assertEquals("[]", getJson("/api/recruitments/upcoming"));
  }

  // ---- recently closed ----

  /** Both have closed; only the most recent quarter is reported. */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void recently_closed_reports_only_the_most_recent() throws Exception {
    seedAll();

    assertEquals(
        mapper.writeValueAsString(List.of(CLOSED_TA)), getJson("/api/recruitments/recentlyClosed"));
  }

  /** A recruitment that has never opened has never closed either. */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void a_never_opened_recruitment_is_not_recently_closed() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc())
        .thenReturn(List.of(UPCOMING_TA));

    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void an_open_recruitment_is_not_recently_closed() throws Exception {
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(OPEN_TA));

    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  /**
   * A reopened recruitment still carries the closing date of its earlier round, so having closed
   * once is not enough to report it as closed now.
   */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void a_reopened_recruitment_is_not_recently_closed() throws Exception {
    Recruitment reopened =
        recruitment(
            6L,
            "20262",
            RecruitmentType.TA,
            ApplicationStatus.OPEN,
            LocalDate.of(2026, 1, 5),
            LocalDate.of(2026, 1, 25));
    when(recruitmentRepository.findAllByOrderByQuarterDescTypeAsc()).thenReturn(List.of(reopened));

    assertEquals("[]", getJson("/api/recruitments/recentlyClosed"));
  }

  // ---- applicable ----

  /** Everything of their type, whatever its state, so their own applications can be labelled. */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void applicable_is_every_recruitment_of_their_type() throws Exception {
    seedAll();

    assertEquals(
        mapper.writeValueAsString(List.of(UPCOMING_TA, OPEN_TA, CLOSED_TA, OLDER_CLOSED_TA)),
        getJson("/api/recruitments/applicable"));
  }

  @WithMockUser(roles = {"UNDERGRAD"})
  @Test
  public void applicable_excludes_the_other_type() throws Exception {
    seedAll();

    assertEquals(
        mapper.writeValueAsString(List.of(OPEN_ULA)), getJson("/api/recruitments/applicable"));
  }

  @Test
  public void logged_out_users_cannot_read_applicable_recruitments() throws Exception {
    mockMvc.perform(get("/api/recruitments/applicable")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_plain_user_cannot_read_applicable_recruitments() throws Exception {
    mockMvc.perform(get("/api/recruitments/applicable")).andExpect(status().is(403));
  }

  // ---- course choices ----

  private static RecruitmentCourse course(long id, String courseId, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(1L)
        .courseId(courseId)
        .enrollCode("EC" + id)
        .removed(removed)
        .build();
  }

  /**
   * A course with two lectures is two rows in the recruitment but one choice on the form, and a
   * removed row is not on offer at all.
   */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void course_choices_are_distinct_sorted_and_exclude_removed() throws Exception {
    seedAll();
    when(recruitmentCourseRepository.findByRecruitmentId(1L))
        .thenReturn(
            List.of(
                course(1L, "CMPSC   156", false),
                course(2L, "CMPSC   156", false),
                course(3L, "CMPSC     8", false),
                course(4L, "CMPSC   130A", true)));

    assertEquals(
        mapper.writeValueAsString(List.of("CMPSC     8", "CMPSC   156")),
        getJson("/api/recruitments/courses?recruitmentId=1"));
  }

  /** Not their type, so not their course list. */
  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void course_choices_are_empty_for_a_recruitment_of_the_other_type() throws Exception {
    seedAll();

    assertEquals("[]", getJson("/api/recruitments/courses?recruitmentId=2"));
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  @WithMockUser(roles = {"GRAD_STUDENT"})
  @Test
  public void course_choices_are_empty_for_a_recruitment_that_does_not_exist() throws Exception {
    seedAll();

    assertEquals("[]", getJson("/api/recruitments/courses?recruitmentId=99"));
  }

  @Test
  public void logged_out_users_cannot_read_course_choices() throws Exception {
    mockMvc.perform(get("/api/recruitments/courses?recruitmentId=1")).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void a_plain_user_cannot_read_course_choices() throws Exception {
    mockMvc.perform(get("/api/recruitments/courses?recruitmentId=1")).andExpect(status().is(403));
  }
}
