package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.*;
import edu.ucsb.cs.taapply.enums.*;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.*;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;

@WebMvcTest(controllers = InstructorRecruitmentsController.class)
@Import(edu.ucsb.cs.taapply.testconfig.TestConfig.class)
public class CandidateRankingsControllerTests extends ControllerTestCase {
  @org.springframework.test.context.bean.override.mockito.MockitoBean
  InstructorRepository instructorRepository;

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  RecruitmentRepository recruitmentRepository;

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  RecruitmentCourseRepository recruitmentCourseRepository;

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  ApplicationRepository applicationRepository;

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  CandidateRankingRepository candidateRankingRepository;

  @org.springframework.test.context.bean.override.mockito.MockitoBean UserRepository userRepository;

  @org.springframework.test.context.bean.override.mockito.MockitoBean
  CurrentUserService currentUserService;

  private static final String BASE = "/api/instructor/recruitments/10/courses/20/candidates";
  private Recruitment recruitment;
  private RecruitmentCourse course;
  private Application application;

  @BeforeEach
  void setup() {
    recruitment =
        Recruitment.builder()
            .id(10L)
            .quarter("20261")
            .type(RecruitmentType.TA)
            .reviewStatus("Open")
            .facultyRankingDeadline(java.time.LocalDate.of(2020, 1, 1))
            .build();
    course =
        RecruitmentCourse.builder()
            .id(20L)
            .recruitmentId(10L)
            .courseId("CMPSC   156")
            .section("0100")
            .instructor("CONRAD P")
            .build();
    application =
        Application.builder()
            .id(30L)
            .recruitmentId(10L)
            .email("student@ucsb.edu")
            .firstName("Ada")
            .lastName("Lovelace")
            .major("Computer Science")
            .classLevel(ClassLevel.PHD)
            .yearInProgram("2")
            .graduationDate("Spring 2028")
            .gpaMajor(3.8)
            .gpaOverall(3.7)
            .previousServiceAsUla(2)
            .videoLink("https://example.edu/video")
            .firstChoiceCourse("CMPSC   156")
            .adminComments("Private staff notes")
            .postApplicationComments("Applicant follow-up")
            .status(ApplicationReviewStatus.HIRED)
            .submittedAt(LocalDateTime.of(2026, 1, 2, 3, 4))
            .build();
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(20L)).thenReturn(Optional.of(course));
    when(instructorRepository.findByEmail("faculty@ucsb.edu"))
        .thenReturn(
            Optional.of(
                Instructor.builder().email("faculty@ucsb.edu").catalogName("CONRAD P").build()));
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email("faculty@ucsb.edu").build())
                .roles(List.of(new SimpleGrantedAuthority("ROLE_INSTRUCTOR")))
                .build());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(10L))
        .thenReturn(List.of(application));
  }

  private void assertJson(String expected, String actual) throws Exception {
    assertEquals(mapper.readTree(expected), mapper.readTree(actual));
  }

  @Test
  void anonymous_cannot_read_or_write() throws Exception {
    mockMvc.perform(get(BASE)).andExpect(status().isForbidden());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isForbidden());
    mockMvc
        .perform(get("/api/instructor/recruitments/10/admin-course-rankings"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    verifyNoInteractions(applicationRepository, candidateRankingRepository);
  }

  @Test
  @WithMockUser(roles = {"USER"})
  void students_cannot_read_or_write_even_with_an_instructor_mapping() throws Exception {
    mockMvc.perform(get(BASE)).andExpect(status().isForbidden());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isForbidden());
    mockMvc
        .perform(get("/api/instructor/recruitments/10/admin-course-rankings"))
        .andExpect(status().isForbidden());
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    verifyNoInteractions(applicationRepository, candidateRankingRepository);
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void exact_candidate_response_excludes_test_and_nonmatching_applications_and_uses_precedence()
      throws Exception {
    Application second =
        application.toBuilder()
            .id(31L)
            .firstChoiceCourse("OTHER")
            .secondChoiceCourse("CMPSC   156")
            .courseInterests(Map.of("CMPSC   156", CourseInterest.ENTHUSIASTIC))
            .build();
    Application enthusiastic = second.toBuilder().id(32L).secondChoiceCourse(null).build();
    Application consider =
        enthusiastic.toBuilder()
            .id(33L)
            .courseInterests(Map.of("CMPSC   156", CourseInterest.WOULD_CONSIDER))
            .build();
    Application ignored =
        consider.toBuilder()
            .id(34L)
            .courseInterests(Map.of("CMPSC   156", CourseInterest.NOT_INTERESTED))
            .build();
    Application absent = ignored.toBuilder().id(35L).courseInterests(Map.of()).build();
    Application test = application.toBuilder().id(36L).testApplication(true).build();
    application.setCourseInterests(Map.of("CMPSC   156", CourseInterest.WOULD_CONSIDER));
    application.setSecondChoiceCourse("CMPSC   156");
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(10L))
        .thenReturn(List.of(application, second, enthusiastic, consider, ignored, absent, test));
    when(candidateRankingRepository.findByRecruitmentCourseId(20L))
        .thenReturn(
            List.of(
                CandidateRanking.builder()
                    .id(1L)
                    .recruitmentCourseId(20L)
                    .applicationId(30L)
                    .rank(1)
                    .build(),
                CandidateRanking.builder()
                    .id(2L)
                    .recruitmentCourseId(20L)
                    .applicationId(31L)
                    .rank(null)
                    .build()));
    String actual =
        mockMvc
            .perform(get(BASE))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String expectedRow =
        """
        {"applicationId":30,"rank":1,"preference":"1st Choice","firstName":"Ada","lastName":"Lovelace",
        "email":"student@ucsb.edu","major":"Computer Science","classLevel":"PHD","yearInProgram":"2",
        "graduationDate":"Spring 2028","gpaMajor":3.8,"gpaOverall":3.7,"previousServiceAsUla":2,
        "videoLink":"https://example.edu/video"}
        """;
    var expected = mapper.createArrayNode();
    expected.add(mapper.readTree(expectedRow));
    for (int i = 0; i < 3; i++) {
      var row = mapper.readTree(expectedRow).deepCopy();
      ((com.fasterxml.jackson.databind.node.ObjectNode) row)
          .put("applicationId", 31 + i)
          .putNull("rank")
          .put("preference", List.of("2nd Choice", "Enthusiastic", "Would Consider").get(i));
      expected.add(row);
    }
    assertEquals(expected, mapper.readTree(actual));
    verify(candidateRankingRepository).findByRecruitmentCourseId(20L);
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void missing_class_level_and_empty_candidates_are_safe() throws Exception {
    application.setClassLevel(null);
    var response =
        mapper.readTree(
            mockMvc
                .perform(get(BASE))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertTrue(response.get(0).get("classLevel").isNull());
    assertTrue(response.get(0).get("rank").isNull());
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(10L)).thenReturn(List.of());
    assertJson(
        "[]",
        mockMvc
            .perform(get(BASE))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void saves_immediately_updates_existing_row_clears_and_permits_ties_past_deadline()
      throws Exception {
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(10L))
        .thenReturn(List.of(application, application.toBuilder().id(31L).build()));
    String first =
        mockMvc
            .perform(
                put(BASE + "/30/rank")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"rank\":2}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertJson("{\"rank\":2}", first);
    ArgumentCaptor<CandidateRanking> captured = ArgumentCaptor.forClass(CandidateRanking.class);
    verify(candidateRankingRepository).save(captured.capture());
    CandidateRanking saved = captured.getValue();
    assertNull(saved.getId());
    assertEquals(20L, saved.getRecruitmentCourseId());
    assertEquals(30L, saved.getApplicationId());
    assertEquals(2, saved.getRank());
    saved.setId(99L);
    when(candidateRankingRepository.findByRecruitmentCourseIdAndApplicationId(20L, 30L))
        .thenReturn(Optional.of(saved));
    mockMvc
        .perform(
            put(BASE + "/31/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":2}"))
        .andExpect(status().isOk());
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isOk());
    assertEquals(1, saved.getRank());
    assertJson(
        "{\"rank\":null}",
        mockMvc
            .perform(
                put(BASE + "/30/rank")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"rank\":null}"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
    assertNull(saved.getRank());
    assertEquals(99L, saved.getId());
    verify(candidateRankingRepository, times(4)).save(any());
  }

  @ParameterizedTest
  @ValueSource(strings = {"0", "-1", "2", "1.5", "\"1\"", "true", "2147483648", "{}"})
  @WithMockUser(roles = {"INSTRUCTOR"})
  void rejects_invalid_ranks(String value) throws Exception {
    mockMvc
        .perform(
            put(BASE + "/30/rank")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rank\":" + value + "}"))
        .andExpect(status().isBadRequest());
    verify(candidateRankingRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void rejects_missing_rank_and_ineligible_or_other_recruitment_applications() throws Exception {
    mockMvc
        .perform(put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest());
    mockMvc
        .perform(
            put(BASE + "/999/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    mockMvc.perform(get(BASE + "/999")).andExpect(status().isForbidden());
    application.setTestApplication(true);
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isForbidden());
    mockMvc
        .perform(
            put(BASE + "/30/rank")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rank\":null}"))
        .andExpect(status().isForbidden());
    verify(candidateRankingRepository, never()).save(any());
  }

  @ParameterizedTest
  @ValueSource(strings = {"Closed", "NotStarted"})
  @WithMockUser(roles = {"INSTRUCTOR"})
  void closure_and_not_started_block_edits(String reviewStatus) throws Exception {
    recruitment.setReviewStatus(reviewStatus);
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    verify(candidateRankingRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"ADMIN", "INSTRUCTOR"})
  void admins_read_closed_pages_but_never_edit_even_with_dual_role() throws Exception {
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email("faculty@ucsb.edu").build())
                .roles(
                    List.of(
                        new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("ROLE_INSTRUCTOR")))
                .build());
    course.setInstructor("OTHER FACULTY");
    recruitment.setReviewStatus("Closed");
    mockMvc.perform(get(BASE)).andExpect(status().isOk());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isOk());
    recruitment.setReviewStatus("Open");
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    verify(candidateRankingRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void admin_counts_only_entered_ranks_for_real_eligible_applications_in_visible_course_scope()
      throws Exception {
    application.setRecruitmentId(10L);
    application.setFirstChoiceCourse("CMPSC   156");
    Application otherCourseApplication =
        application.toBuilder().id(31L).firstChoiceCourse("OTHER").build();
    Application testApplication = application.toBuilder().id(32L).testApplication(true).build();
    Application ineligibleApplication =
        application.toBuilder().id(33L).firstChoiceCourse("OTHER").build();
    Application otherRecruitmentApplication =
        application.toBuilder().id(34L).recruitmentId(11L).build();
    RecruitmentCourse removedCourse =
        RecruitmentCourse.builder()
            .id(21L)
            .recruitmentId(10L)
            .courseId("OTHER")
            .section("0100")
            .instructor("UNMAPPED")
            .removed(true)
            .build();
    RecruitmentCourse zeroRankingCourse =
        RecruitmentCourse.builder()
            .id(22L)
            .recruitmentId(10L)
            .courseId("ZZZZ    100")
            .section("0100")
            .build();
    RecruitmentCourse otherRecruitmentCourse =
        RecruitmentCourse.builder()
            .id(23L)
            .recruitmentId(11L)
            .courseId("AAAA    100")
            .section("0100")
            .build();
    when(recruitmentCourseRepository.findByRecruitmentId(10L))
        .thenReturn(List.of(course, removedCourse, zeroRankingCourse, otherRecruitmentCourse));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(10L))
        .thenReturn(
            List.of(
                application,
                otherCourseApplication,
                testApplication,
                ineligibleApplication,
                otherRecruitmentApplication));
    when(candidateRankingRepository.findByRecruitmentCourseId(20L))
        .thenReturn(
            List.of(
                CandidateRanking.builder().applicationId(30L).rank(2).build(),
                CandidateRanking.builder().applicationId(32L).rank(1).build(),
                CandidateRanking.builder().applicationId(33L).rank(1).build(),
                CandidateRanking.builder().applicationId(30L).rank(null).build(),
                CandidateRanking.builder().applicationId(999L).rank(1).build(),
                CandidateRanking.builder().applicationId(null).rank(1).build(),
                CandidateRanking.builder().applicationId(34L).rank(1).build()));
    when(candidateRankingRepository.findByRecruitmentCourseId(21L))
        .thenReturn(List.of(CandidateRanking.builder().applicationId(31L).rank(1).build()));
    when(candidateRankingRepository.findByRecruitmentCourseId(22L)).thenReturn(List.of());
    when(candidateRankingRepository.findByRecruitmentCourseId(23L))
        .thenReturn(List.of(CandidateRanking.builder().applicationId(34L).rank(1).build()));
    Instructor mapped =
        Instructor.builder().email("faculty@ucsb.edu").catalogName("CONRAD P").build();
    Instructor withoutCatalogName =
        Instructor.builder().email("unmapped@ucsb.edu").catalogName(null).build();
    Instructor duplicate =
        Instructor.builder().email("another@ucsb.edu").catalogName("CONRAD P").build();
    when(instructorRepository.findAll())
        .thenReturn(
            List.of(mapped, withoutCatalogName),
            List.of(mapped, withoutCatalogName),
            List.of(mapped, duplicate, withoutCatalogName));

    String visible =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/admin-course-rankings"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertJson(
        """
        [
          {"recruitmentCourseId":20,"rankingCount":1,"instructorEmail":"faculty@ucsb.edu"},
          {"recruitmentCourseId":22,"rankingCount":0,"instructorEmail":null}
        ]
        """,
        visible);
    verify(recruitmentCourseRepository).findByRecruitmentId(10L);
    verify(applicationRepository).findByRecruitmentIdOrderByIdAsc(10L);
    verify(candidateRankingRepository).findByRecruitmentCourseId(20L);
    verify(candidateRankingRepository).findByRecruitmentCourseId(22L);
    verify(candidateRankingRepository, never()).findByRecruitmentCourseId(21L);
    verify(candidateRankingRepository, never()).findByRecruitmentCourseId(23L);

    String withRemoved =
        mockMvc
            .perform(
                get("/api/instructor/recruitments/10/admin-course-rankings")
                    .param("includeRemoved", "true"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertJson(
        """
        [
          {"recruitmentCourseId":20,"rankingCount":1,"instructorEmail":"faculty@ucsb.edu"},
          {"recruitmentCourseId":21,"rankingCount":1,"instructorEmail":null},
          {"recruitmentCourseId":22,"rankingCount":0,"instructorEmail":null}
        ]
        """,
        withRemoved);

    String ambiguousMapping =
        mockMvc
            .perform(get("/api/instructor/recruitments/10/admin-course-rankings"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertJson(
        """
        [
          {"recruitmentCourseId":20,"rankingCount":1,"instructorEmail":null},
          {"recruitmentCourseId":22,"rankingCount":0,"instructorEmail":null}
        ]
        """,
        ambiguousMapping);
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void admin_ranking_summary_requires_an_existing_recruitment() throws Exception {
    when(recruitmentRepository.findById(999L)).thenReturn(Optional.empty());
    mockMvc
        .perform(get("/api/instructor/recruitments/999/admin-course-rankings"))
        .andExpect(status().isNotFound());
    verifyNoInteractions(applicationRepository, candidateRankingRepository);
    verify(recruitmentCourseRepository, never()).findByRecruitmentId(any());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void instructors_cannot_open_removed_or_stale_courses() throws Exception {
    course.setStale(true);
    mockMvc.perform(get(BASE)).andExpect(status().isForbidden());
    verifyNoInteractions(applicationRepository, candidateRankingRepository);
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void admins_can_read_historical_unavailable_courses_but_cannot_edit_them() throws Exception {
    course.setStale(true);
    recruitment.setReviewStatus("Closed");
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email("admin@ucsb.edu").build())
                .roles(List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
                .build());
    application.setFirstChoiceCourse("CMPSC   156");

    mockMvc.perform(get(BASE)).andExpect(status().isOk());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isOk());
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    verify(candidateRankingRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void section_ownership_and_membership_are_enforced_on_every_endpoint() throws Exception {
    course.setInstructor("OTHER FACULTY");
    mockMvc.perform(get(BASE)).andExpect(status().isForbidden());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isForbidden());
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isForbidden());
    course.setInstructor("CONRAD P");
    course.setRecruitmentId(11L);
    mockMvc.perform(get(BASE)).andExpect(status().isBadRequest());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isBadRequest());
    mockMvc
        .perform(
            put(BASE + "/30/rank").contentType(MediaType.APPLICATION_JSON).content("{\"rank\":1}"))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(applicationRepository, candidateRankingRepository);
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void missing_authenticated_user_and_missing_mapping_are_denied_on_direct_candidate_requests()
      throws Exception {
    when(currentUserService.getCurrentUser()).thenReturn(null);
    mockMvc.perform(get(BASE)).andExpect(status().isForbidden());
    when(currentUserService.getCurrentUser()).thenReturn(CurrentUser.builder().user(null).build());
    mockMvc.perform(get(BASE + "/30")).andExpect(status().isForbidden());
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email("faculty@ucsb.edu").build())
                .roles(null)
                .build());
    mockMvc.perform(get(BASE)).andExpect(status().isOk());
    when(instructorRepository.findByEmail("faculty@ucsb.edu")).thenReturn(Optional.empty());
    mockMvc.perform(get(BASE)).andExpect(status().isForbidden());
    verify(candidateRankingRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void same_application_has_independent_section_rankings_in_the_api() throws Exception {
    RecruitmentCourse other =
        RecruitmentCourse.builder()
            .id(21L)
            .recruitmentId(10L)
            .courseId("CMPSC   156")
            .section("0200")
            .instructor("CONRAD P")
            .build();
    when(recruitmentCourseRepository.findById(21L)).thenReturn(Optional.of(other));
    when(candidateRankingRepository.findByRecruitmentCourseId(20L))
        .thenReturn(
            List.of(
                CandidateRanking.builder()
                    .applicationId(30L)
                    .recruitmentCourseId(20L)
                    .rank(1)
                    .build()));
    when(candidateRankingRepository.findByRecruitmentCourseId(21L))
        .thenReturn(
            List.of(
                CandidateRanking.builder()
                    .applicationId(30L)
                    .recruitmentCourseId(21L)
                    .rank(null)
                    .build()));
    String otherBase = "/api/instructor/recruitments/10/courses/21/candidates";
    var firstResponse =
        mapper.readTree(
            mockMvc
                .perform(get(BASE))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    var secondResponse =
        mapper.readTree(
            mockMvc
                .perform(get(otherBase))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    assertEquals(1, firstResponse.get(0).get("rank").intValue());
    assertTrue(secondResponse.get(0).get("rank").isNull());
    assertEquals(30, secondResponse.get(0).get("applicationId").longValue());
    mockMvc
        .perform(
            put(otherBase + "/30/rank")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rank\":1}"))
        .andExpect(status().isOk());
    ArgumentCaptor<CandidateRanking> captured = ArgumentCaptor.forClass(CandidateRanking.class);
    verify(candidateRankingRepository).save(captured.capture());
    assertEquals(21L, captured.getValue().getRecruitmentCourseId());
    assertEquals(30L, captured.getValue().getApplicationId());
    assertEquals(1, captured.getValue().getRank());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void nullable_applicant_follow_up_comments_are_returned_without_admin_comments()
      throws Exception {
    application.setPostApplicationComments(null);
    application.setTentativeAssignmentId(20L);
    String body =
        mockMvc
            .perform(get(BASE + "/30"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var response = mapper.readTree(body);
    assertTrue(response.has("postApplicationComments"));
    assertTrue(response.get("postApplicationComments").isNull());
    assertFalse(response.has("adminComments"));
    assertFalse(response.get("answers").has("adminComments"));
    assertFalse(response.get("answers").has("postApplicationComments"));
    // The admin's tentative assignment (issue #179) is not for faculty eyes at this stage.
    assertEquals(-1, body.indexOf("entativeAssignment"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void full_application_answers_have_an_independent_exact_contract_and_no_admin_fields()
      throws Exception {
    application.setMiddleName("M");
    application.setPrevExperience("Tutored students");
    application.setComments("Student comment");
    application.setAvailabilityCommentsFirstChoice("Available");
    application.setAvailabilityCommentsSecondChoice("Maybe");
    application.setAvailableForLecturesFirstChoice(true);
    application.setAvailableForLecturesSecondChoice(true);
    application.setAvailableForDiscussionFirstChoice(true);
    application.setAvailableForDiscussionSecondChoice(true);
    application.setSecondChoiceCourse("CMPSC    16");
    application.setCourseInterests(Map.of("CMPSC    24", CourseInterest.ENTHUSIASTIC));
    application.setTopicProficiencies(Map.of("Java", 5));
    application.setInterests(Map.of("Teaching", 3));
    application.setPriorCoursework(
        List.of(
            PriorCoursework.builder()
                .ucsbCourse(true)
                .courseNumber("CMPSC   156")
                .courseTitle("App development")
                .term("F25")
                .grade("A")
                .build(),
            PriorCoursework.builder()
                .ucsbCourse(false)
                .otherSchool("Partner University")
                .courseNumber("CS 101")
                .courseTitle("Computing")
                .term("S24")
                .grade("A-")
                .build()));
    application.setResidencyStatus(ResidencyStatus.F1_STUDENT_VISA);
    application.setLanguageExam(LanguageExamStatus.PASSED_F1_OR_J1_VISA);
    application.setLanguageExamDatePassed("F25");
    application.setPermNumber("A123456");
    application.setBsMsStudent(true);
    application.setEmployeeId("EMP123");
    application.setPriorUcsbEmployment(true);
    application.setI9Appointment(false);
    application.setWantsTaEligibility(true);
    application.setChangingMajor(false);
    application.setTrainingCommitmentExplanation("Training answer");
    application.setStudentStatusNextQuarter(StudentStatus.UNDERGRADUATE);
    application.setOtherCampusJob(OtherCampusJob.NOT_SURE);
    application.setTrainingCommitment(TrainingCommitment.AGREE);
    application.setNoticeVersionId(9L);
    String actual =
        mockMvc
            .perform(get(BASE + "/30"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertJson(
        """
        {"id":30,"recruitmentId":10,"email":"student@ucsb.edu","submittedAt":"2026-01-02T03:04:00",
        "postApplicationComments":"Applicant follow-up",
        "answers":{"firstName":"Ada","middleName":"M","lastName":"Lovelace","major":"Computer Science",
        "gpaMajor":3.8,"gpaOverall":3.7,"yearInProgram":"2","graduationDate":"Spring 2028",
        "priorCoursework":[{"ucsbCourse":true,"otherSchool":null,"courseNumber":"CMPSC   156",
        "courseTitle":"App development","term":"F25","grade":"A"},
        {"ucsbCourse":false,"otherSchool":"Partner University","courseNumber":"CS 101",
        "courseTitle":"Computing","term":"S24","grade":"A-"}],
        "topicProficiencies":{"Java":5},"interests":{"Teaching":3},"prevExperience":"Tutored students",
        "comments":"Student comment","firstChoiceCourse":"CMPSC   156","secondChoiceCourse":"CMPSC    16",
        "availableForLecturesFirstChoice":true,"availableForLecturesSecondChoice":true,
        "availableForDiscussionFirstChoice":true,"availableForDiscussionSecondChoice":true,
        "availabilityCommentsFirstChoice":"Available","availabilityCommentsSecondChoice":"Maybe",
        "courseInterests":{"CMPSC    24":"ENTHUSIASTIC"},"residencyStatus":"F1_STUDENT_VISA",
        "languageExam":"PASSED_F1_OR_J1_VISA","languageExamDatePassed":"F25","classLevel":"PHD",
        "videoLink":"https://example.edu/video","previousServiceAsUla":2,"permNumber":"A123456",
        "bsMsStudent":true,"studentStatusNextQuarter":"UNDERGRADUATE","wantsTaEligibility":true,
        "otherCampusJob":"NOT_SURE","priorUcsbEmployment":true,"employeeId":"EMP123","i9Appointment":false,
        "trainingCommitment":"AGREE","trainingCommitmentExplanation":"Training answer",
        "changingMajor":false,"noticeVersionId":9}}
        """,
        actual);
    assertFalse(actual.contains("adminComments"));
    assertFalse(actual.contains("status"));
    assertFalse(actual.contains("testApplication"));
  }
}
