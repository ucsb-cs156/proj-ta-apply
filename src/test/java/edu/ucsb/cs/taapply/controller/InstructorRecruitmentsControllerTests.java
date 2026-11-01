package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.controller.InstructorRecruitmentsController.AllocationRow;
import edu.ucsb.cs.taapply.controller.InstructorRecruitmentsController.CandidateRankingPage;
import edu.ucsb.cs.taapply.controller.InstructorRecruitmentsController.CourseDetails;
import edu.ucsb.cs.taapply.controller.InstructorRecruitmentsController.InstructorRecruitment;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.CourseTargetsService;
import edu.ucsb.cs.taapply.services.CourseTargetsService.CourseTargets;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;

@WebMvcTest(controllers = InstructorRecruitmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class InstructorRecruitmentsControllerTests extends ControllerTestCase {

  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean UserRepository userRepository;
  @MockitoBean CurrentUserService currentUserService;
  @MockitoBean edu.ucsb.cs.taapply.repository.ApplicationRepository applicationRepository;
  @MockitoBean edu.ucsb.cs.taapply.repository.CandidateRankingRepository candidateRankingRepository;
  @MockitoBean CourseTargetsService courseTargetsService;

  private static final String EMAIL = "pconrad@ucsb.edu";
  private static final String URL = "/api/instructor/recruitments?email=" + EMAIL;

  private static Recruitment recruitment(long id, String quarter, RecruitmentType type) {
    return Recruitment.builder()
        .id(id)
        .quarter(quarter)
        .type(type)
        .applicationStatus(ApplicationStatus.OPEN)
        .tentativeOpeningDate(LocalDate.of(2026, 1, 5))
        .primaryConsiderationDate(LocalDate.of(2026, 1, 20))
        .actualOpeningDate(LocalDate.of(2026, 1, 6))
        .actualClosingDate(null)
        .build();
  }

  private static RecruitmentCourse row(
      long id, long recruitmentId, String courseId, String section, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(recruitmentId)
        .courseId(courseId)
        .section(section)
        .enrollCode("0" + id)
        .title("TITLE " + id)
        .instructor("CONRAD P")
        .removed(removed)
        .build();
  }

  private void instructorWithCatalogName(String catalogName) {
    when(instructorRepository.findByEmail(EMAIL))
        .thenReturn(
            Optional.of(Instructor.builder().email(EMAIL).catalogName(catalogName).build()));
  }

  private void currentUser(String email, boolean admin) {
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email(email).build())
                .roles(
                    admin
                        ? List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                        : List.of(new SimpleGrantedAuthority("ROLE_INSTRUCTOR")))
                .build());
  }

  @Test
  public void logged_out_users_cannot_ask() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void plain_users_cannot_ask() throws Exception {
    mockMvc.perform(get(URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_email_that_is_not_an_instructor_gets_an_empty_list() throws Exception {
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentCourseRepository, never()).findByInstructor(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_instructor_without_a_catalog_name_yet_gets_an_empty_list() throws Exception {
    instructorWithCatalogName(null);

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentCourseRepository, never()).findByInstructor(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_catalog_name_with_no_course_rows_gets_an_empty_list() throws Exception {
    instructorWithCatalogName("CONRAD P");
    when(recruitmentCourseRepository.findByInstructor("CONRAD P")).thenReturn(List.of());

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentRepository, never()).findAllById(any());
  }

  /** Only removed rows is the same as none: no recruitment is listed for them. */
  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void removed_rows_do_not_count() throws Exception {
    instructorWithCatalogName("CONRAD P");
    when(recruitmentCourseRepository.findByInstructor("CONRAD P"))
        .thenReturn(List.of(row(1L, 10L, "CMPSC   156", "0100", true)));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals("[]", response.getResponse().getContentAsString());
    verify(recruitmentRepository, never()).findAllById(any());
  }

  /**
   * Rows across three recruitments: the newest quarter first and TA before ULA within a quarter,
   * each with its courses in course-then-section order, removed rows left out.
   */
  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void an_instructor_gets_their_recruitments_newest_first_with_courses_in_order()
      throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse ula156 = row(1L, 12L, "CMPSC   156", "0100", false);
    RecruitmentCourse ta156b = row(2L, 11L, "CMPSC   156", "0200", false);
    RecruitmentCourse ta156a = row(3L, 11L, "CMPSC   156", "0100", false);
    RecruitmentCourse ta8 = row(4L, 11L, "CMPSC     8", null, false);
    RecruitmentCourse removed = row(5L, 11L, "CMPSC     1A", "0100", true);
    RecruitmentCourse old = row(6L, 10L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P"))
        .thenReturn(List.of(ula156, ta156b, ta156a, ta8, removed, old));
    Recruitment oldTa = recruitment(10L, "20254", RecruitmentType.TA);
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    Recruitment ula = recruitment(12L, "20261", RecruitmentType.ULA);
    when(recruitmentRepository.findAllById(Set.of(10L, 11L, 12L)))
        .thenReturn(List.of(ula, oldTa, ta));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    List<InstructorRecruitment> expected =
        List.of(
            InstructorRecruitment.of(ta, List.of(ta8, ta156a, ta156b)),
            InstructorRecruitment.of(ula, List.of(ula156)),
            InstructorRecruitment.of(oldTa, List.of(old)));
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
  }

  /** The record carries every field the recruitment cards show. */
  @Test
  public void the_record_copies_the_recruitment_fields() {
    Recruitment r =
        Recruitment.builder()
            .id(3L)
            .quarter("20262")
            .type(RecruitmentType.ULA)
            .applicationStatus(ApplicationStatus.CLOSED)
            .tentativeOpeningDate(LocalDate.of(2026, 3, 30))
            .primaryConsiderationDate(LocalDate.of(2026, 4, 15))
            .actualOpeningDate(LocalDate.of(2026, 4, 1))
            .actualClosingDate(LocalDate.of(2026, 5, 1))
            .reviewStatus("Open")
            .facultyReviewOpeningDate(LocalDate.of(2026, 4, 2))
            .facultyRankingDeadline(LocalDate.of(2026, 4, 20))
            .allocationsVisibleToFaculty(true)
            .build();
    RecruitmentCourse course = row(9L, 3L, "CMPSC    16", "0100", false);
    course.setAllocation(2);
    course.setEnrollmentEstimate(150);

    InstructorRecruitment ir = InstructorRecruitment.of(r, List.of(course));

    // Each accessor, since the JSON comes from them rather than from equals().
    assertEquals(3L, ir.id());
    assertEquals("20262", ir.quarter());
    assertEquals(RecruitmentType.ULA, ir.type());
    assertEquals(ApplicationStatus.CLOSED, ir.applicationStatus());
    assertEquals(LocalDate.of(2026, 3, 30), ir.tentativeOpeningDate());
    assertEquals(LocalDate.of(2026, 4, 15), ir.primaryConsiderationDate());
    assertEquals(LocalDate.of(2026, 4, 1), ir.actualOpeningDate());
    assertEquals(LocalDate.of(2026, 5, 1), ir.actualClosingDate());
    assertEquals("Open", ir.reviewStatus());
    assertEquals(LocalDate.of(2026, 4, 2), ir.facultyReviewOpeningDate());
    assertEquals(LocalDate.of(2026, 4, 20), ir.facultyRankingDeadline());
    assertEquals(List.of(course), ir.courses());
    assertEquals(
        new InstructorRecruitment(
            3L,
            "20262",
            RecruitmentType.ULA,
            ApplicationStatus.CLOSED,
            LocalDate.of(2026, 3, 30),
            LocalDate.of(2026, 4, 15),
            LocalDate.of(2026, 4, 1),
            LocalDate.of(2026, 5, 1),
            "Open",
            LocalDate.of(2026, 4, 2),
            LocalDate.of(2026, 4, 20),
            List.of(course),
            null),
        ir);
  }

  /** Admins may look an instructor up too, for support. */
  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_can_ask_about_an_instructor() throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse one = row(1L, 11L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P")).thenReturn(List.of(one));
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findAllById(Set.of(11L))).thenReturn(List.of(ta));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(List.of(InstructorRecruitment.of(ta, List.of(one)))),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructor_can_read_course_metadata_and_only_their_other_courses() throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setTentativeOpeningDate(LocalDate.of(2025, 12, 1));
    recruitment.setPrimaryConsiderationDate(LocalDate.of(2026, 1, 20));
    recruitment.setActualOpeningDate(LocalDate.of(2026, 1, 6));
    recruitment.setReviewStatus("Open");
    recruitment.setFacultyReviewOpeningDate(LocalDate.of(2026, 1, 25));
    recruitment.setFacultyRankingDeadline(LocalDate.of(2026, 2, 15));
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    RecruitmentCourse course = row(1L, 10L, "CMPSC   156", "0100", false);
    RecruitmentCourse sibling = row(2L, 10L, "CMPSC   156", "0200", false);
    sibling.setInstructor("CONRAD P");
    RecruitmentCourse earlierSibling = row(4L, 10L, "CMPSC     8", "0100", false);
    earlierSibling.setInstructor("CONRAD P");
    RecruitmentCourse anotherInstructor = row(3L, 10L, "CMPSC     8", "0100", false);
    anotherInstructor.setInstructor("SOMEONE ELSE");
    RecruitmentCourse removedSibling = row(5L, 10L, "CMPSC   157", "0100", true);
    removedSibling.setInstructor("CONRAD P");
    RecruitmentCourse staleSibling = row(6L, 10L, "CMPSC   158", "0100", false);
    staleSibling.setInstructor("CONRAD P");
    staleSibling.setStale(true);
    RecruitmentCourse cancelledSibling = row(7L, 10L, "CMPSC   159", "0100", false);
    cancelledSibling.setInstructor("CONRAD P");
    cancelledSibling.setStatus(RecruitmentCourse.CANCELLED);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));
    when(recruitmentCourseRepository.findByRecruitmentId(10L))
        .thenReturn(
            List.of(
                course,
                sibling,
                earlierSibling,
                anotherInstructor,
                removedSibling,
                staleSibling,
                cancelledSibling));

    MvcResult response =
        mockMvc
            .perform(
                get("/api/instructor/recruitments/10/courses/1/ranking")
                    .param("email", "attacker@example.com"))
            .andExpect(status().isOk())
            .andReturn();

    CandidateRankingPage expected =
        new CandidateRankingPage(
            10L,
            "20261",
            RecruitmentType.TA,
            LocalDate.of(2025, 12, 1),
            LocalDate.of(2026, 1, 20),
            LocalDate.of(2026, 1, 6),
            null,
            "Open",
            LocalDate.of(2026, 1, 25),
            LocalDate.of(2026, 2, 15),
            new CourseDetails(1L, "CMPSC   156", "0100", "TITLE 1", "CONRAD P"),
            List.of(
                new CourseDetails(4L, "CMPSC     8", "0100", "TITLE 4", "CONRAD P"),
                new CourseDetails(2L, "CMPSC   156", "0200", "TITLE 2", "CONRAD P")),
            null,
            true,
            null);
    assertEquals(mapper.writeValueAsString(expected), response.getResponse().getContentAsString());
    verify(instructorRepository).findByEmail(EMAIL);
    verify(instructorRepository, never()).findByEmail("attacker@example.com");
  }

  // ---- canRank (issue #202) ----

  private void rankingPageSetup(String reviewStatus) {
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus(reviewStatus);
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    RecruitmentCourse course = row(1L, 10L, "CMPSC   156", "0100", false);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));
    when(recruitmentCourseRepository.findByRecruitmentId(10L)).thenReturn(List.of(course));
  }

  private void adminWhoIsAlsoInstructor() {
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email(EMAIL).build())
                .roles(
                    List.of(
                        new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("ROLE_INSTRUCTOR")))
                .build());
  }

  private boolean canRankFrom(MvcResult response) throws Exception {
    return mapper.readTree(response.getResponse().getContentAsString()).get("canRank").asBoolean();
  }

  /** The bug of issue #202: the admin role must not hide the ranking boxes from the instructor. */
  @WithMockUser(roles = {"ADMIN", "INSTRUCTOR"})
  @Test
  public void an_admin_who_teaches_the_course_can_rank_while_reviews_are_open() throws Exception {
    adminWhoIsAlsoInstructor();
    instructorWithCatalogName("CONRAD P");
    rankingPageSetup("Open");

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    assertTrue(canRankFrom(response));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_who_does_not_teach_the_course_cannot_rank() throws Exception {
    currentUser(EMAIL, true);
    instructorWithCatalogName("SOMEONE ELSE");
    rankingPageSetup("Open");

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    assertFalse(canRankFrom(response));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_with_no_catalog_name_cannot_rank() throws Exception {
    currentUser(EMAIL, true);
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
    rankingPageSetup("Open");

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    assertFalse(canRankFrom(response));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_instructor_cannot_rank_once_reviews_are_closed() throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    rankingPageSetup("Closed");

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    assertFalse(canRankFrom(response));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void closed_review_metadata_is_available_to_the_course_instructor() throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.ULA);
    recruitment.setReviewStatus("Closed");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(1L))
        .thenReturn(Optional.of(row(1L, 10L, "CMPSC   156", "0100", false)));
    when(recruitmentCourseRepository.findByRecruitmentId(10L)).thenReturn(List.of());

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isOk())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.type")
                .value("ULA"))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath(
                    "$.reviewStatus")
                .value("Closed"));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructor_cannot_read_another_instructors_course() throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Open");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    RecruitmentCourse course = row(1L, 10L, "CMPSC   156", "0100", false);
    course.setInstructor("SOMEONE ELSE");
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value("This recruitment course is not assigned to the authenticated instructor."));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_can_read_any_course_without_an_instructor_mapping() throws Exception {
    currentUser(EMAIL, true);
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Closed");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(1L))
        .thenReturn(Optional.of(row(1L, 10L, "CMPSC   156", "0100", false)));

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isOk())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath(
                    "$.otherCourses")
                .isEmpty());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void not_started_reviews_are_unavailable_with_an_explicit_error() throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    when(recruitmentRepository.findById(10L))
        .thenReturn(Optional.of(recruitment(10L, "20261", RecruitmentType.TA)));
    when(recruitmentCourseRepository.findById(1L))
        .thenReturn(Optional.of(row(1L, 10L, "CMPSC   156", "0100", false)));

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value(
                    "Candidate rankings are unavailable because faculty reviews have not started."));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void course_from_another_recruitment_is_rejected() throws Exception {
    currentUser(EMAIL, false);
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Open");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(1L))
        .thenReturn(Optional.of(row(1L, 11L, "CMPSC   156", "0100", false)));

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isBadRequest())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value("Recruitment course 1 does not belong to recruitment 10"));
    verify(instructorRepository, never()).findByEmail(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void removed_course_is_unavailable_with_an_explicit_error() throws Exception {
    currentUser(EMAIL, false);
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Open");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(1L))
        .thenReturn(Optional.of(row(1L, 10L, "CMPSC   156", "0100", true)));

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value("This recruitment course has been removed or is no longer available."));
    verify(instructorRepository, never()).findByEmail(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void stale_course_is_unavailable_with_an_explicit_error() throws Exception {
    currentUser(EMAIL, false);
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Open");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    RecruitmentCourse stale = row(1L, 10L, "CMPSC   156", "0100", false);
    stale.setStale(true);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(stale));

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value("This recruitment course has been removed or is no longer available."));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void missing_course_returns_an_explicit_not_found_error() throws Exception {
    when(recruitmentRepository.findById(10L))
        .thenReturn(Optional.of(recruitment(10L, "20261", RecruitmentType.TA)));
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.empty());

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isNotFound())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value("RecruitmentCourse with id 1 not found"));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void missing_recruitment_returns_an_explicit_not_found_error() throws Exception {
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.empty());

    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isNotFound())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.message")
                .value("Recruitment with id 10 not found"));
    verify(recruitmentCourseRepository, never()).findById(any());
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void students_cannot_read_candidate_ranking_metadata() throws Exception {
    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden());
    verify(recruitmentRepository, never()).findById(any());
  }

  private void seedOpenRankingCourse() {
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Open");
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(1L))
        .thenReturn(Optional.of(row(1L, 10L, "CMPSC   156", "0100", false)));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void missing_current_user_or_user_record_is_rejected() throws Exception {
    seedOpenRankingCourse();
    when(currentUserService.getCurrentUser()).thenReturn(null);
    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden());

    when(currentUserService.getCurrentUser()).thenReturn(CurrentUser.builder().build());
    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden());
    verify(instructorRepository, never()).findByEmail(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void missing_instructor_mapping_cannot_grant_course_access() throws Exception {
    seedOpenRankingCourse();
    currentUser(EMAIL, false);
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden());
    instructorWithCatalogName(null);
    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void absent_authorities_do_not_grant_admin_bypass() throws Exception {
    seedOpenRankingCourse();
    when(currentUserService.getCurrentUser())
        .thenReturn(CurrentUser.builder().user(User.builder().email(EMAIL).build()).build());
    when(instructorRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
    mockMvc
        .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
        .andExpect(status().isForbidden());
  }

  // ---- allocations hidden from or shown to faculty (issue #178) ----

  private static RecruitmentCourse rowWithFigures(long id, long recruitmentId) {
    RecruitmentCourse course = row(id, recruitmentId, "CMPSC   156", "0100", false);
    course.setAllocation(3);
    course.setEnrollmentEstimate(120);
    course.setUnroundedAllocation(2.5);
    course.setEnrollment(100);
    course.setMaxEnroll(150);
    return course;
  }

  @Test
  public void withoutAllocation_blanks_only_the_planning_figures() {
    RecruitmentCourse course = rowWithFigures(9L, 3L);
    course.setStale(true);
    course.setManuallyAdded(true);

    RecruitmentCourse copy = InstructorRecruitment.withoutAllocation(course);

    assertNull(copy.getAllocation());
    assertNull(copy.getEnrollmentEstimate());
    assertNull(copy.getUnroundedAllocation());
    assertEquals(3, course.getAllocation());
    assertEquals(120, course.getEnrollmentEstimate());
    assertEquals(2.5, course.getUnroundedAllocation());
    assertEquals(
        course.toBuilder()
            .allocation(null)
            .enrollmentEstimate(null)
            .unroundedAllocation(null)
            .build(),
        copy);
    assertEquals(9L, copy.getId());
    assertEquals(3L, copy.getRecruitmentId());
    assertEquals("CMPSC   156", copy.getCourseId());
    assertEquals("0100", copy.getSection());
    assertEquals("09", copy.getEnrollCode());
    assertEquals("TITLE 9", copy.getTitle());
    assertEquals("CONRAD P", copy.getInstructor());
    assertEquals(100, copy.getEnrollment());
    assertEquals(150, copy.getMaxEnroll());
    assertTrue(copy.isStale());
    assertTrue(copy.isManuallyAdded());
    assertFalse(copy.isRemoved());
  }

  @Test
  public void allocationsVisible_is_true_only_for_an_explicit_true() {
    Recruitment r = recruitment(3L, "20261", RecruitmentType.TA);
    assertFalse(InstructorRecruitmentsController.allocationsVisible(r));
    r.setAllocationsVisibleToFaculty(null);
    assertFalse(InstructorRecruitmentsController.allocationsVisible(r));
    r.setAllocationsVisibleToFaculty(true);
    assertTrue(InstructorRecruitmentsController.allocationsVisible(r));
  }

  @Test
  public void the_record_blanks_the_allocation_of_every_course_while_hidden() {
    Recruitment r = recruitment(3L, "20261", RecruitmentType.TA);
    RecruitmentCourse a = rowWithFigures(9L, 3L);
    RecruitmentCourse b = rowWithFigures(10L, 3L);
    b.setSection("0200");

    InstructorRecruitment ir = InstructorRecruitment.of(r, List.of(a, b));

    assertEquals(
        List.of(
            InstructorRecruitment.withoutAllocation(a), InstructorRecruitment.withoutAllocation(b)),
        ir.courses());
    assertNull(ir.courses().get(0).getAllocation());
    assertNull(ir.courses().get(1).getAllocation());
    assertEquals("0200", ir.courses().get(1).getSection());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void while_hidden_the_instructor_endpoint_leaves_out_allocation_and_estimate()
      throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse course = rowWithFigures(1L, 11L);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P")).thenReturn(List.of(course));
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findAllById(Set.of(11L))).thenReturn(List.of(ta));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    String body = response.getResponse().getContentAsString();
    JsonNode courseJson = mapper.readTree(body).get(0).get("courses").get(0);
    assertTrue(courseJson.get("allocation").isNull());
    assertTrue(courseJson.get("enrollmentEstimate").isNull());
    assertTrue(courseJson.get("unroundedAllocation").isNull());
    assertEquals(1L, courseJson.get("id").asLong());
    assertEquals("CMPSC   156", courseJson.get("courseId").asText());
    assertEquals(100, courseJson.get("enrollment").asInt());
    assertFalse(body.contains("\"allocation\":3"));
    assertFalse(body.contains("120"));
    assertFalse(body.contains("2.5"));
    // Issue #224: the hiring figures stay on the server too.
    assertTrue(mapper.readTree(body).get(0).get("targets").isNull());
    verify(courseTargetsService, never()).targetsFor(any(), any(java.util.List.class));
    assertEquals(
        mapper.writeValueAsString(List.of(InstructorRecruitment.of(ta, List.of(course)))), body);
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void once_shown_the_instructor_endpoint_carries_the_allocation() throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse course = rowWithFigures(1L, 11L);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P")).thenReturn(List.of(course));
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    ta.setAllocationsVisibleToFaculty(true);
    when(recruitmentRepository.findAllById(Set.of(11L))).thenReturn(List.of(ta));
    Map<Long, CourseTargets> targets = Map.of(1L, new CourseTargets(1L, 3, 7, 6, 2, 4));
    when(courseTargetsService.targetsFor(11L, List.of(course))).thenReturn(targets);

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    String body = response.getResponse().getContentAsString();
    JsonNode courseJson = mapper.readTree(body).get(0).get("courses").get(0);
    assertEquals(3, courseJson.get("allocation").asInt());
    assertEquals(120, courseJson.get("enrollmentEstimate").asInt());
    assertEquals(2.5, courseJson.get("unroundedAllocation").asDouble());
    // Issue #224: released, so each course's hiring figures travel with it, keyed by course id.
    JsonNode targetsJson = mapper.readTree(body).get(0).get("targets").get("1");
    assertEquals(3, targetsJson.get("allocation").asInt());
    assertEquals(7, targetsJson.get("candidateCount").asInt());
    assertEquals(6, targetsJson.get("rankingTarget").asInt());
    assertEquals(2, targetsJson.get("rankedCount").asInt());
    assertEquals(4, targetsJson.get("stillNeeded").asInt());
    assertEquals(
        mapper.writeValueAsString(List.of(InstructorRecruitment.of(ta, List.of(course), targets))),
        body);
  }

  private RecruitmentCourse rankingPageSetup(boolean visible) {
    Recruitment recruitment = recruitment(10L, "20261", RecruitmentType.TA);
    recruitment.setReviewStatus("Open");
    recruitment.setAllocationsVisibleToFaculty(visible);
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    RecruitmentCourse course = rowWithFigures(1L, 10L);
    when(recruitmentCourseRepository.findById(1L)).thenReturn(Optional.of(course));
    when(recruitmentCourseRepository.findByRecruitmentId(10L)).thenReturn(List.of(course));
    return course;
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_ranking_page_hides_the_allocation_from_the_instructor_until_shown()
      throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    rankingPageSetup(false);

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    String body = response.getResponse().getContentAsString();
    assertTrue(mapper.readTree(body).get("allocation").isNull());
    assertFalse(body.contains("\"allocation\":3"), body);
    assertTrue(mapper.readTree(body).get("targets").isNull());
    verify(courseTargetsService, never()).targetsFor(any(), any(RecruitmentCourse.class));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_ranking_page_shows_the_allocation_to_the_instructor_once_shown()
      throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse course = rankingPageSetup(true);
    when(courseTargetsService.targetsFor(10L, course))
        .thenReturn(new CourseTargets(1L, 3, 5, 5, 1, 4));

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals(3, json.get("allocation").asInt());
    assertEquals(
        mapper.readTree(mapper.writeValueAsString(new CourseTargets(1L, 3, 5, 5, 1, 4))),
        json.get("targets"));
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void the_ranking_page_shows_the_allocation_to_an_admin_even_while_hidden()
      throws Exception {
    currentUser(EMAIL, true);
    RecruitmentCourse course = rankingPageSetup(false);
    when(courseTargetsService.targetsFor(10L, course))
        .thenReturn(new CourseTargets(1L, 3, 2, 2, 0, 2));

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals(3, json.get("allocation").asInt());
    assertEquals(1L, json.get("course").get("id").asLong());
    assertEquals(2, json.get("targets").get("rankingTarget").asInt());
    assertEquals(2, json.get("targets").get("stillNeeded").asInt());
  }

  // ---- per-course release (issue #224) ----

  @Test
  public void allocationVisible_is_true_for_a_released_course_or_when_all_are_shown() {
    Recruitment r = recruitment(3L, "20261", RecruitmentType.TA);
    RecruitmentCourse course = rowWithFigures(9L, 3L);
    assertFalse(InstructorRecruitmentsController.allocationVisible(r, course));
    course.setAllocationReleased(null);
    assertFalse(InstructorRecruitmentsController.allocationVisible(r, course));
    course.setAllocationReleased(true);
    assertTrue(InstructorRecruitmentsController.allocationVisible(r, course));
    course.setAllocationReleased(false);
    r.setAllocationsVisibleToFaculty(true);
    assertTrue(InstructorRecruitmentsController.allocationVisible(r, course));
  }

  @Test
  public void the_record_blanks_only_the_courses_that_are_not_released() {
    Recruitment r = recruitment(3L, "20261", RecruitmentType.TA);
    RecruitmentCourse hidden = rowWithFigures(9L, 3L);
    RecruitmentCourse released = rowWithFigures(10L, 3L);
    released.setAllocationReleased(true);

    InstructorRecruitment ir = InstructorRecruitment.of(r, List.of(hidden, released));

    assertNull(ir.courses().get(0).getAllocation());
    assertEquals(3, ir.courses().get(1).getAllocation());
    assertEquals(120, ir.courses().get(1).getEnrollmentEstimate());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void a_released_course_carries_its_targets_while_the_others_stay_blank() throws Exception {
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse hidden = rowWithFigures(1L, 11L);
    RecruitmentCourse released = rowWithFigures(2L, 11L);
    released.setSection("0200");
    released.setAllocationReleased(true);
    when(recruitmentCourseRepository.findByInstructor("CONRAD P"))
        .thenReturn(List.of(hidden, released));
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    when(recruitmentRepository.findAllById(Set.of(11L))).thenReturn(List.of(ta));
    when(courseTargetsService.targetsFor(11L, List.of(released)))
        .thenReturn(Map.of(2L, new CourseTargets(2L, 3, 4, 4, 0, 4)));

    MvcResult response = mockMvc.perform(get(URL)).andExpect(status().isOk()).andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString()).get(0);
    assertTrue(json.get("courses").get(0).get("allocation").isNull());
    assertEquals(3, json.get("courses").get(1).get("allocation").asInt());
    assertNull(json.get("targets").get("1"));
    assertEquals(4, json.get("targets").get("2").get("rankingTarget").asInt());
    // Only the released course is computed.
    verify(courseTargetsService).targetsFor(11L, List.of(released));
    verify(courseTargetsService, never()).targetsFor(11L, List.of(hidden, released));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_ranking_page_shows_a_released_course_while_all_allocations_stay_hidden()
      throws Exception {
    currentUser(EMAIL, false);
    instructorWithCatalogName("CONRAD P");
    RecruitmentCourse course = rankingPageSetup(false);
    course.setAllocationReleased(true);
    when(courseTargetsService.targetsFor(10L, course))
        .thenReturn(new CourseTargets(1L, 3, 6, 6, 2, 4));

    MvcResult response =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/courses/1/ranking"))
            .andExpect(status().isOk())
            .andReturn();

    JsonNode json = mapper.readTree(response.getResponse().getContentAsString());
    assertEquals(3, json.get("allocation").asInt());
    assertEquals(4, json.get("targets").get("stillNeeded").asInt());
  }

  // ---- GET /api/instructor/recruitments/{id}/allocations (issue #224) ----

  private static final String ALLOCATIONS_URL = "/api/instructor/recruitments/11/allocations";

  private Recruitment allocationsSetup(boolean shown) {
    Recruitment ta = recruitment(11L, "20261", RecruitmentType.TA);
    ta.setAllocationsVisibleToFaculty(shown);
    when(recruitmentRepository.findById(11L)).thenReturn(Optional.of(ta));
    RecruitmentCourse second = rowWithFigures(2L, 11L);
    second.setCourseId("CMPSC   156");
    second.setSection("0200");
    second.setInstructor("SOMEONE ELSE");
    second.setAllocation(1);
    RecruitmentCourse first = rowWithFigures(1L, 11L);
    RecruitmentCourse removed = rowWithFigures(3L, 11L);
    removed.setRemoved(true);
    RecruitmentCourse eight = rowWithFigures(4L, 11L);
    eight.setCourseId("CMPSC     8");
    eight.setAllocation(0);
    when(recruitmentCourseRepository.findByRecruitmentId(11L))
        .thenReturn(List.of(second, removed, first, eight));
    return ta;
  }

  @Test
  public void logged_out_users_cannot_read_the_allocations() throws Exception {
    mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"USER"})
  @Test
  public void plain_users_cannot_read_the_allocations() throws Exception {
    mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_get_403_while_the_admin_hides_all_allocations() throws Exception {
    currentUser(EMAIL, false);
    allocationsSetup(false);

    MvcResult response =
        mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().is(403)).andReturn();

    assertEquals(
        "The admin has not chosen to show this recruitment's allocations to all faculty.",
        responseToJson(response).get("message"));
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void instructors_get_every_non_removed_course_in_page_order_once_shown() throws Exception {
    currentUser(EMAIL, false);
    allocationsSetup(true);

    MvcResult response =
        mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().isOk()).andReturn();

    assertEquals(
        mapper.writeValueAsString(
            List.of(
                new AllocationRow(4L, "CMPSC     8", "0100", "CONRAD P", 0),
                new AllocationRow(1L, "CMPSC   156", "0100", "CONRAD P", 3),
                new AllocationRow(2L, "CMPSC   156", "0200", "SOMEONE ELSE", 1))),
        response.getResponse().getContentAsString());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void admins_read_the_allocations_even_while_hidden() throws Exception {
    currentUser(EMAIL, true);
    allocationsSetup(false);

    MvcResult response =
        mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().isOk()).andReturn();

    assertEquals(3, mapper.readTree(response.getResponse().getContentAsString()).size());
  }

  @WithMockUser(roles = {"ADMIN"})
  @Test
  public void an_admin_whose_roles_are_missing_is_treated_as_a_plain_viewer() throws Exception {
    when(currentUserService.getCurrentUser())
        .thenReturn(CurrentUser.builder().user(User.builder().email(EMAIL).build()).build());
    allocationsSetup(false);
    mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().is(403));

    when(currentUserService.getCurrentUser()).thenReturn(null);
    mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().is(403));
  }

  @WithMockUser(roles = {"INSTRUCTOR"})
  @Test
  public void the_allocations_of_an_unknown_recruitment_are_a_404() throws Exception {
    currentUser(EMAIL, false);
    when(recruitmentRepository.findById(11L)).thenReturn(Optional.empty());

    MvcResult response =
        mockMvc.perform(get(ALLOCATIONS_URL)).andExpect(status().isNotFound()).andReturn();

    assertEquals("Recruitment with id 11 not found", responseToJson(response).get("message"));
  }
}
