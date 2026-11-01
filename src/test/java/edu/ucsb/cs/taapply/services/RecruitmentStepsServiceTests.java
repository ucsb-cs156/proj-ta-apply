package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService.Link;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService.Step;
import edu.ucsb.cs.taapply.services.RecruitmentStepsService.Steps;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(classes = {RecruitmentStepsService.class})
@ActiveProfiles("test")
public class RecruitmentStepsServiceTests {

  @Autowired RecruitmentStepsService service;
  @MockitoBean RecruitmentCourseRepository recruitmentCourseRepository;
  @MockitoBean AssignmentsService assignmentsService;

  private static final String COURSES = "/admin/recruitments/7/courses";

  /** A recruitment that has only just been created: nothing done but step 1. */
  private static Recruitment fresh() {
    return Recruitment.builder()
        .id(7L)
        .quarter("20264")
        .type(RecruitmentType.TA)
        .tentativeOpeningDate(LocalDate.of(2026, 9, 1))
        .primaryConsiderationDate(LocalDate.of(2026, 9, 15))
        .createdAt(LocalDateTime.of(2026, 8, 20, 14, 30))
        .build();
  }

  @BeforeEach
  public void nothingAllocatedOrAssigned() {
    when(recruitmentCourseRepository.findByRecruitmentId(7L)).thenReturn(List.of());
    when(assignmentsService.realApplications(7L)).thenReturn(List.of());
  }

  private Step step(Recruitment recruitment, int number) {
    return service.stepsFor(recruitment).steps().get(number - 1);
  }

  private static RecruitmentCourse course(long id, int allocation, boolean removed) {
    return RecruitmentCourse.builder()
        .id(id)
        .recruitmentId(7L)
        .courseId("CMPSC   " + id)
        .enrollCode("EC" + id)
        .allocation(allocation)
        .removed(removed)
        .build();
  }

  private static Application assignedTo(long id, Long courseId) {
    return Application.builder().id(id).tentativeAssignmentId(courseId).build();
  }

  // ---- the whole thing ----

  @Test
  public void a_fresh_recruitment_has_nine_steps_and_only_the_first_is_done() {
    Steps steps = service.stepsFor(fresh());

    assertEquals(7L, steps.recruitmentId());
    assertEquals(RecruitmentType.TA, steps.type());
    assertEquals(9, steps.steps().size());
    for (int i = 0; i < 9; i++) {
      assertEquals(i + 1, steps.steps().get(i).number());
    }
    assertEquals(
        List.of(true, false, false, false, false, false, false, false, false),
        steps.steps().stream().map(Step::done).toList());
    assertEquals(
        List.of(
            "Created: 2026-08-20",
            "Tentative: 2026-09-01",
            "Hiring Target: 1",
            "Prim. Consid: 2026-09-15",
            "Not released yet",
            "Not opened yet",
            "Not closed yet",
            "Still to assign: 1",
            "Not released yet"),
        steps.steps().stream().map(Step::label).toList());
  }

  @Test
  public void the_response_keeps_the_type_and_leaves_out_what_does_not_apply() throws Exception {
    Recruitment ula = fresh();
    ula.setType(RecruitmentType.ULA);
    Steps steps = service.stepsFor(ula);
    assertEquals(RecruitmentType.ULA, steps.type());

    JsonNode json = new ObjectMapper().valueToTree(steps);
    JsonNode first = json.get("steps").get(0);
    // Step 1 is a bare number, flag and label.
    assertEquals(List.of("number", "done", "label"), List.copyOf(fieldNames(first)));
    assertEquals("ULA", json.get("type").asText());
    // Step 9 is the only one with a tentative flag.
    assertTrue(json.get("steps").get(8).has("tentative"));
    assertFalse(json.get("steps").get(7).has("tentative"));
    assertEquals("publishAssignments", json.get("steps").get(8).get("action").asText());
    assertFalse(json.get("steps").get(8).has("href"));
  }

  private static List<String> fieldNames(JsonNode node) {
    java.util.ArrayList<String> names = new java.util.ArrayList<>();
    node.fieldNames().forEachRemaining(names::add);
    return names;
  }

  // ---- step 1 ----

  @Test
  public void step_1_is_always_done_and_says_when_when_it_is_known() {
    assertEquals(
        new Step(1, true, "Created: 2026-08-20", null, null, null, null, null), step(fresh(), 1));

    Recruitment legacy = fresh();
    legacy.setCreatedAt(null);
    assertEquals(new Step(1, true, "Created", null, null, null, null, null), step(legacy, 1));
  }

  // ---- steps 2 and 4: applications ----

  @Test
  public void step_2_offers_to_open_until_applications_have_opened() {
    assertEquals(
        new Step(2, false, "Tentative: 2026-09-01", null, "openApplications", null, null, null),
        step(fresh(), 2));

    Recruitment noDate = fresh();
    noDate.setTentativeOpeningDate(null);
    assertEquals("Tentative: not set", step(noDate, 2).label());
  }

  @Test
  public void step_2_is_done_once_opened_and_then_offers_to_close() {
    Recruitment open = fresh();
    open.setApplicationStatus(ApplicationStatus.OPEN);
    open.setActualOpeningDate(LocalDate.of(2026, 9, 2));

    assertEquals(
        new Step(2, true, "Opened: 2026-09-02", null, "closeApplications", null, null, null),
        step(open, 2));
    // Closing again later does not make step 2 undone, and the modal turns back to opening.
    open.setApplicationStatus(ApplicationStatus.CLOSED);
    assertTrue(step(open, 2).done());
    assertEquals("openApplications", step(open, 2).action());
  }

  @Test
  public void step_4_shows_the_primary_consideration_date_until_applications_are_closed() {
    assertEquals(
        new Step(4, false, "Prim. Consid: 2026-09-15", null, "openApplications", null, null, null),
        step(fresh(), 4));

    Recruitment noDate = fresh();
    noDate.setPrimaryConsiderationDate(null);
    assertEquals("Prim. Consid: not set", step(noDate, 4).label());

    Recruitment open = fresh();
    open.setApplicationStatus(ApplicationStatus.OPEN);
    open.setActualOpeningDate(LocalDate.of(2026, 9, 2));
    assertFalse(step(open, 4).done());
    assertEquals("closeApplications", step(open, 4).action());
  }

  @Test
  public void step_4_is_done_when_closed_after_having_been_closed_once() {
    Recruitment closed = fresh();
    closed.setActualOpeningDate(LocalDate.of(2026, 9, 2));
    closed.setActualClosingDate(LocalDate.of(2026, 9, 20));

    assertEquals(
        new Step(4, true, "Closed: 2026-09-20", null, "openApplications", null, null, null),
        step(closed, 4));
  }

  @Test
  public void step_4_is_not_done_when_applications_were_reopened_after_closing() {
    Recruitment reopened = fresh();
    reopened.setActualOpeningDate(LocalDate.of(2026, 9, 2));
    reopened.setActualClosingDate(LocalDate.of(2026, 9, 20));
    reopened.setApplicationStatus(ApplicationStatus.OPEN);

    Step step = step(reopened, 4);
    assertFalse(step.done());
    assertEquals("Prim. Consid: 2026-09-15", step.label());
  }

  // ---- step 3: budget / allocations ----

  @Test
  public void step_3_is_done_when_the_allocations_add_up_to_the_target() {
    Recruitment r = fresh();
    r.setTotalHiringTarget(8);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(course(1, 5, false), course(2, 3, false)));

    Step step = step(r, 3);
    assertTrue(step.done());
    assertEquals("Hiring Target: 8", step.label());
    assertNull(step.href());
    assertNull(step.action());
    assertEquals(
        List.of(new Link("Budget", "/admin/budget/F26"), new Link("Allocations", COURSES)),
        step.titleLinks());
  }

  @Test
  public void step_3_is_not_done_when_the_allocations_fall_short_or_overshoot() {
    Recruitment r = fresh();
    r.setTotalHiringTarget(8);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(course(1, 5, false), course(2, 2, false)));
    assertFalse(step(r, 3).done());

    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(course(1, 5, false), course(2, 4, false)));
    assertFalse(step(r, 3).done());
  }

  @Test
  public void removed_courses_do_not_count_toward_the_allocations() {
    Recruitment r = fresh();
    r.setTotalHiringTarget(8);
    when(recruitmentCourseRepository.findByRecruitmentId(7L))
        .thenReturn(List.of(course(1, 8, false), course(2, 6, true)));

    assertTrue(step(r, 3).done());
  }

  @Test
  public void the_budget_link_writes_the_quarter_as_admins_do() {
    for (String[] pair :
        new String[][] {
          {"20261", "W26"}, {"20262", "S26"}, {"20263", "M26"}, {"20264", "F26"}, {"20311", "W31"}
        }) {
      Recruitment r = fresh();
      r.setQuarter(pair[0]);
      assertEquals("/admin/budget/" + pair[1], step(r, 3).titleLinks().get(0).href());
    }
  }

  // ---- step 5: release allocations ----

  @Test
  public void step_5_is_done_when_the_visibility_is_not_admins_only() {
    Recruitment r = fresh();
    r.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    r.setAllocationsReleasedAt(LocalDateTime.of(2026, 10, 3, 9, 0));
    assertEquals(
        new Step(5, true, "Released: 2026-10-03", null, "allocationVisibility", null, null, null),
        step(r, 5));

    r.setAllocationVisibility(AllocationVisibility.ALL_COURSES);
    assertTrue(step(r, 5).done());

    assertEquals(
        new Step(5, false, "Not released yet", null, "allocationVisibility", null, null, null),
        step(fresh(), 5));
  }

  @Test
  public void step_5_without_a_stamp_just_says_released() {
    Recruitment r = fresh();
    r.setAllocationVisibility(AllocationVisibility.OWN_COURSES);
    assertEquals("Released", step(r, 5).label());
  }

  @Test
  public void step_5_after_withdrawing_is_not_done_even_though_a_release_was_stamped() {
    Recruitment r = fresh();
    r.setAllocationsReleasedAt(LocalDateTime.of(2026, 10, 3, 9, 0));
    Step step = step(r, 5);
    assertFalse(step.done());
    assertEquals("Not released yet", step.label());
  }

  // ---- steps 6 and 7: faculty ranking ----

  @Test
  public void step_6_offers_to_open_until_reviews_have_opened() {
    assertEquals(
        new Step(6, false, "Not opened yet", null, "openReviews", null, null, null),
        step(fresh(), 6));

    Recruitment open = fresh();
    open.setReviewStatus("Open");
    open.setFacultyReviewOpeningDate(LocalDate.of(2026, 10, 5));
    assertEquals(
        new Step(6, true, "Opened: 2026-10-05", null, "closeReviews", null, null, null),
        step(open, 6));
  }

  @Test
  public void step_7_shows_the_deadline_while_reviews_are_open_and_not_closed_yet_without_one() {
    Link rankings = new Link("(see rankings)", COURSES);
    assertEquals(
        new Step(7, false, "Not closed yet", null, "openReviews", null, rankings, null),
        step(fresh(), 7));

    Recruitment open = fresh();
    open.setReviewStatus("Open");
    open.setFacultyReviewOpeningDate(LocalDate.of(2026, 10, 5));
    open.setFacultyRankingDeadline(LocalDate.of(2026, 10, 15));
    assertEquals(
        new Step(7, false, "Deadline: 2026-10-15", null, "closeReviews", null, rankings, null),
        step(open, 7));
  }

  @Test
  public void step_7_is_done_when_closed_and_says_when_if_it_is_known() {
    Link rankings = new Link("(see rankings)", COURSES);
    Recruitment closed = fresh();
    closed.setReviewStatus("Closed");
    closed.setFacultyReviewOpeningDate(LocalDate.of(2026, 10, 5));
    closed.setFacultyRankingDeadline(LocalDate.of(2026, 10, 15));
    closed.setFacultyReviewClosedAt(LocalDateTime.of(2026, 10, 16, 8, 0));
    assertEquals(
        new Step(7, true, "Closed: 2026-10-16", null, "openReviews", null, rankings, null),
        step(closed, 7));

    closed.setFacultyReviewClosedAt(null);
    assertEquals("Closed", step(closed, 7).label());
  }

  // ---- step 8: assignments ----

  @Test
  public void step_8_counts_what_is_still_to_assign() {
    Recruitment r = fresh();
    r.setTotalHiringTarget(5);
    when(assignmentsService.realApplications(7L))
        .thenReturn(List.of(assignedTo(1, 10L), assignedTo(2, 10L), assignedTo(3, 11L)));

    assertEquals(
        new Step(
            8,
            false,
            "Still to assign: 2",
            "/admin/recruitments/7/assignments",
            null,
            null,
            null,
            null),
        step(r, 8));
  }

  @Test
  public void step_8_is_complete_at_or_above_the_target_and_unassigned_applications_do_not_count() {
    Recruitment r = fresh();
    r.setTotalHiringTarget(2);
    when(assignmentsService.realApplications(7L))
        .thenReturn(List.of(assignedTo(1, 10L), assignedTo(2, 11L), assignedTo(3, null)));
    Step atTarget = step(r, 8);
    assertTrue(atTarget.done());
    assertEquals("Assignment complete", atTarget.label());

    r.setTotalHiringTarget(1);
    assertTrue(step(r, 8).done());
    assertEquals("Assignment complete", step(r, 8).label());

    r.setTotalHiringTarget(3);
    assertFalse(step(r, 8).done());
    assertEquals("Still to assign: 1", step(r, 8).label());
  }

  // ---- step 9: release hiring decisions ----

  @Test
  public void step_9_before_publishing_opens_the_publish_modal() {
    assertEquals(
        new Step(
            9,
            false,
            "Not released yet",
            null,
            "publishAssignments",
            null,
            new Link("(see assignments)", COURSES),
            false,
            "Close Faculty Ranking before releasing hiring decisions."),
        step(fresh(), 9));
  }

  @Test
  public void step_9_once_published_links_to_the_published_page_and_says_when() {
    Recruitment r = fresh();
    r.setAssignmentsPublished(true);
    r.setAssignmentsPublishedAt(LocalDateTime.of(2026, 11, 1, 16, 45));
    r.setApplicationStatus(ApplicationStatus.CLOSED);
    r.setReviewStatus("Closed");

    assertEquals(
        new Step(
            9,
            true,
            "Released: 2026-11-01",
            "/recruitments/7/assignments",
            null,
            null,
            new Link("(see assignments)", COURSES),
            false),
        step(r, 9));

    r.setAssignmentsPublishedAt(null);
    assertEquals("Released", step(r, 9).label());
  }

  @Test
  public void published_decisions_are_tentative_while_applications_or_ranking_are_open() {
    Recruitment r = fresh();
    r.setAssignmentsPublished(true);
    r.setApplicationStatus(ApplicationStatus.CLOSED);
    r.setReviewStatus("Closed");
    assertFalse(step(r, 9).tentative());

    r.setApplicationStatus(ApplicationStatus.OPEN);
    assertTrue(step(r, 9).tentative());

    r.setApplicationStatus(ApplicationStatus.CLOSED);
    r.setReviewStatus("Open");
    assertTrue(step(r, 9).tentative());

    r.setApplicationStatus(ApplicationStatus.OPEN);
    assertTrue(step(r, 9).tentative());
  }

  @Test
  public void unpublished_decisions_are_never_tentative() {
    Recruitment r = fresh();
    r.setApplicationStatus(ApplicationStatus.OPEN);
    r.setReviewStatus("Open");
    assertFalse(step(r, 9).tentative());

    r.setAssignmentsPublished(null);
    assertFalse(step(r, 9).done());
    assertFalse(step(r, 9).tentative());
  }

  // ---- step 9: what stands in the way of releasing (issue #237) ----

  @Test
  public void step_9_names_the_first_unmet_prerequisite_in_order() {
    Recruitment r = fresh();
    r.setReviewStatus("Open");
    r.setApplicationStatus(ApplicationStatus.OPEN);
    assertEquals(
        "Close Faculty Ranking before releasing hiring decisions.", step(r, 9).blockedReason());

    r.setReviewStatus("Closed");
    assertEquals(
        "Close Applications before releasing hiring decisions.", step(r, 9).blockedReason());

    r.setApplicationStatus(ApplicationStatus.CLOSED);
    assertEquals(
        "Assign candidates to slots before releasing hiring decisions.",
        step(r, 9).blockedReason());
  }

  @Test
  public void step_9_has_no_blocked_reason_when_every_prerequisite_is_met() {
    Recruitment r = fresh();
    r.setReviewStatus("Closed");
    r.setApplicationStatus(ApplicationStatus.CLOSED);
    when(assignmentsService.realApplications(7L)).thenReturn(List.of(assignedTo(1L, 10L)));

    assertNull(step(r, 9).blockedReason());
  }

  @Test
  public void step_9_has_no_blocked_reason_once_released_and_no_other_step_ever_has_one() {
    Recruitment r = fresh();
    r.setAssignmentsPublished(true);
    assertNull(step(r, 9).blockedReason());

    for (int number = 1; number <= 8; number++) {
      assertNull(step(fresh(), number).blockedReason());
    }
  }
}
