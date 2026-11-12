package edu.ucsb.cs.taapply.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import edu.ucsb.cs.taapply.ControllerTestCase;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.repository.UserRepository;
import edu.ucsb.cs.taapply.services.CourseTargetsService;
import edu.ucsb.cs.taapply.services.CurrentUserService;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.RankingVersionService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The version check and the multi-tab warning on a course's rankings (issue #279): who may be
 * recorded and named, that only the very same course warns, and that a stale rank edit is refused.
 */
@WebMvcTest(controllers = InstructorRecruitmentsController.class)
@Import({
  edu.ucsb.cs.taapply.testconfig.TestConfig.class,
  DraftApplicationsControllerTests.DetectorConfig.class
})
public class RankingWarningControllerTests extends ControllerTestCase {
  @MockitoBean InstructorRepository instructorRepository;
  @MockitoBean RecruitmentRepository recruitmentRepository;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean ApplicationRepository applicationRepository;
  @MockitoBean CandidateRankingRepository candidateRankingRepository;
  @MockitoBean UserRepository userRepository;
  @MockitoBean CourseTargetsService courseTargetsService;
  @MockitoBean edu.ucsb.cs.taapply.services.BudgetCourseService budgetCourseService;
  @MockitoBean CurrentUserService currentUserService;
  @MockitoBean DeveloperModeService developerModeService;
  @MockitoBean RankingVersionService rankingVersionService;
  @Autowired DraftApplicationsControllerTests.ResettableDetector detector;

  private static final String COURSE = "/api/instructor/recruitments/10/courses/20";
  private static final String OTHER_COURSE = "/api/instructor/recruitments/10/courses/21";
  private static final String CLIENT_ID = "X-Client-Id";

  private Recruitment recruitment;

  @BeforeEach
  void setup() {
    detector.reset();
    recruitment =
        Recruitment.builder()
            .id(10L)
            .quarter("20261")
            .type(RecruitmentType.TA)
            .reviewStatus("Open")
            .build();
    when(recruitmentRepository.findById(10L)).thenReturn(Optional.of(recruitment));
    when(recruitmentCourseRepository.findById(20L))
        .thenReturn(Optional.of(course(20L, "CMPSC   156", "CONRAD P")));
    when(recruitmentCourseRepository.findById(21L))
        .thenReturn(Optional.of(course(21L, "CMPSC   130A", "CONRAD P")));
    when(recruitmentCourseRepository.findById(22L))
        .thenReturn(Optional.of(course(22L, "CMPSC   8", "SOMEONE ELSE")));
    when(applicationRepository.findByRecruitmentIdOrderByIdAsc(10L))
        .thenReturn(
            List.of(
                Application.builder()
                    .id(30L)
                    .recruitmentId(10L)
                    .email("student@ucsb.edu")
                    .firstChoiceCourse("CMPSC   156")
                    .build()));
    when(rankingVersionService.advance(anyLong(), anyInt())).thenReturn(true);
    when(candidateRankingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
  }

  private static RecruitmentCourse course(long id, String courseId, String instructor) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(10L)
        .courseId(courseId)
        .instructor(instructor)
        .build();
  }

  /** Signs in as this person: mapped to a catalog name if they are an instructor. */
  private void signInAs(String email, String fullName, String catalogName, String... roles) {
    when(currentUserService.getCurrentUser())
        .thenReturn(
            CurrentUser.builder()
                .user(User.builder().email(email).fullName(fullName).build())
                .roles(
                    java.util.Arrays.stream(roles)
                        .map(
                            role ->
                                (org.springframework.security.core.GrantedAuthority)
                                    new SimpleGrantedAuthority(role))
                        .toList())
                .build());
    when(instructorRepository.findByEmail(email))
        .thenReturn(
            catalogName == null
                ? Optional.empty()
                : Optional.of(Instructor.builder().email(email).catalogName(catalogName).build()));
  }

  private ResultActions heartbeat(String course, String clientId) throws Exception {
    var request = post(course + "/ranking/heartbeat");
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  private ResultActions leave(String course, String clientId) throws Exception {
    var request = post(course + "/ranking/leave");
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  private ResultActions rank(String course, int version, String clientId) throws Exception {
    var request =
        put(course + "/candidates/30/rank?version=" + version)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"rank\":1}");
    return mockMvc.perform(clientId == null ? request : request.header(CLIENT_ID, clientId));
  }

  private int others(String course, String observer) {
    return detector.othersActive("ranking:" + course, observer).size();
  }

  // ---- the version check

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_rank_edit_from_the_current_version_is_saved_and_returns_the_next_version()
      throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");

    rank(COURSE, 4, null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rank").value(1))
        .andExpect(jsonPath("$.version").value(5));

    verify(rankingVersionService).advance(20L, 4);
    verify(candidateRankingRepository).save(any());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_stale_rank_edit_is_refused_with_the_current_version_and_changes_nothing()
      throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");
    when(rankingVersionService.advance(20L, 4)).thenReturn(false);
    when(rankingVersionService.current(20L)).thenReturn(6);

    rank(COURSE, 4, null)
        .andExpect(status().isConflict())
        .andExpect(
            jsonPath("$.message")
                .value(
                    "Rankings for this course changed while you were editing; your change has not"
                        + " been saved."))
        .andExpect(jsonPath("$.version").value(6));

    verify(candidateRankingRepository, never()).save(any());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void an_invalid_rank_does_not_use_up_a_version() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");

    mockMvc
        .perform(
            put(COURSE + "/candidates/30/rank?version=4")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rank\":9}"))
        .andExpect(status().isBadRequest());

    verify(rankingVersionService, never()).advance(anyLong(), anyInt());
  }

  // ---- who is recorded

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_save_that_names_its_client_counts_as_ranking_the_course() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");

    rank(COURSE, 0, "typing-tab").andExpect(status().isOk());

    var others = detector.othersActive("ranking:20", "observer");
    assertEquals(1, others.size());
    assertEquals("faculty@ucsb.edu (Fay Faculty)", others.get(0).label());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_save_without_a_client_records_nobody() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");

    rank(COURSE, 0, null).andExpect(status().isOk());

    assertEquals(0, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_stale_save_still_counts_as_being_there() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");
    when(rankingVersionService.advance(20L, 0)).thenReturn(false);

    rank(COURSE, 0, "typing-tab").andExpect(status().isConflict());

    assertEquals(1, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void an_instructor_of_another_course_is_refused_and_not_recorded_when_saving() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");

    rank(COURSE.replace("/20", "/22"), 0, "intruder-tab").andExpect(status().isForbidden());

    assertEquals(0, others("22", "observer"));
    verify(candidateRankingRepository, never()).save(any());
  }

  // ---- the heartbeat

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_lone_tab_finds_no_one_and_is_told_how_often_to_beat() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, "only-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.heartbeatSeconds").value(5))
        .andExpect(jsonPath("$.newest").value(true));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_second_tab_of_the_same_instructor_is_named_as_the_same_person() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, "first-tab");
    heartbeat(COURSE, "second-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("faculty@ucsb.edu (Fay Faculty)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(true));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_name_that_is_blank_is_left_out_of_the_label() throws Exception {
    signInAs("faculty@ucsb.edu", "   ", "CONRAD P", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, "first-tab");
    heartbeat(COURSE, "second-tab")
        .andExpect(jsonPath("$.others[0].label").value("faculty@ucsb.edu"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void two_instructors_of_a_co_taught_course_see_each_other_by_name() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "fay-tab");
    signInAs("coteacher@ucsb.edu", "Co Teacher", "CONRAD P", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, "co-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("faculty@ucsb.edu (Fay Faculty)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false));
  }

  @Test
  @WithMockUser(roles = {"ADMIN", "INSTRUCTOR"})
  void an_admin_who_teaches_the_course_and_an_instructor_see_each_other() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "fay-tab");
    signInAs("admin@ucsb.edu", "Ada Admin", "CONRAD P", "ROLE_ADMIN", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, "admin-tab")
        .andExpect(jsonPath("$.others.length()").value(1))
        .andExpect(jsonPath("$.others[0].label").value("faculty@ucsb.edu (Fay Faculty)"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void another_course_never_warns_even_for_the_same_instructor() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "tab-on-156");

    heartbeat(OTHER_COURSE, "tab-on-130a")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0));
    assertEquals(1, others("20", "observer"));
    assertEquals(1, others("21", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void an_instructor_of_another_course_gets_403_and_is_neither_recorded_nor_told_who_is_there()
      throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "fay-tab");
    signInAs("other@ucsb.edu", "Olive Other", "SOMEONE ELSE", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, "intruder-tab").andExpect(status().isForbidden());

    assertEquals(1, others("20", "observer"));
    assertEquals(0, detector.othersActive("ranking:20", "fay-tab").size());
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void an_admin_who_does_not_teach_the_course_is_ranking_it_too() throws Exception {
    // Issue #439: an admin may change any course's rankings, so they warn and are warned like
    // an instructor of the course.
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "fay-tab");
    signInAs("admin@ucsb.edu", "Ada Admin", null, "ROLE_ADMIN");

    heartbeat(COURSE, "admin-tab")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others[0].label").value("faculty@ucsb.edu (Fay Faculty)"))
        .andExpect(jsonPath("$.others[0].samePerson").value(false));

    assertEquals(2, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"ADMIN"})
  void an_admin_is_still_ranking_once_reviews_are_closed_but_not_a_course_off_offer()
      throws Exception {
    signInAs("admin@ucsb.edu", "Ada Admin", null, "ROLE_ADMIN");
    recruitment.setReviewStatus("Closed");

    heartbeat(COURSE, "admin-tab").andExpect(status().isOk());
    assertEquals(1, others("20", "observer"));

    RecruitmentCourse removed = course(20L, "CMPSC   156", "CONRAD P");
    removed.setRemoved(true);
    when(recruitmentCourseRepository.findById(20L)).thenReturn(Optional.of(removed));
    heartbeat(COURSE, "second-tab").andExpect(status().isForbidden());
    assertEquals(1, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void no_one_is_warned_once_reviews_are_closed() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");
    recruitment.setReviewStatus("Closed");

    heartbeat(COURSE, "tab").andExpect(status().isForbidden());

    assertEquals(0, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"USER"})
  void a_student_cannot_send_a_heartbeat_or_a_goodbye() throws Exception {
    signInAs("student@ucsb.edu", null, null, "ROLE_USER");

    heartbeat(COURSE, "tab").andExpect(status().isForbidden());
    leave(COURSE, "tab").andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_heartbeat_without_a_client_id_records_nobody() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");

    heartbeat(COURSE, null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.others.length()").value(0))
        .andExpect(jsonPath("$.newest").value(false));

    assertEquals(0, others("20", "observer"));
  }

  // ---- the goodbye

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_tab_that_leaves_is_forgotten_at_once_by_the_other() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "staying-tab");
    heartbeat(COURSE, "leaving-tab").andExpect(jsonPath("$.others.length()").value(1));

    leave(COURSE, "leaving-tab").andExpect(status().isNoContent());

    heartbeat(COURSE, "staying-tab").andExpect(jsonPath("$.others.length()").value(0));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_goodbye_from_someone_with_no_access_forgets_nobody() throws Exception {
    signInAs("faculty@ucsb.edu", "Fay Faculty", "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "fay-tab");
    signInAs("other@ucsb.edu", null, "SOMEONE ELSE", "ROLE_INSTRUCTOR");

    leave(COURSE, "fay-tab").andExpect(status().isForbidden());

    assertEquals(1, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_goodbye_names_the_course_it_leaves() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "same-id");
    heartbeat(OTHER_COURSE, "same-id");

    leave(COURSE, "same-id").andExpect(status().isNoContent());

    assertEquals(0, others("20", "observer"));
    assertEquals(1, others("21", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void a_goodbye_without_a_client_id_is_accepted_and_forgets_nobody() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");
    heartbeat(COURSE, "a-tab");

    leave(COURSE, null).andExpect(status().isNoContent());

    assertEquals(1, others("20", "observer"));
  }

  @Test
  @WithMockUser(roles = {"INSTRUCTOR"})
  void the_candidates_carry_the_version_they_were_read_at() throws Exception {
    signInAs("faculty@ucsb.edu", null, "CONRAD P", "ROLE_INSTRUCTOR");
    when(rankingVersionService.current(20L)).thenReturn(7);

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                COURSE + "/candidates"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].rankingVersion").value(7));
  }
}
