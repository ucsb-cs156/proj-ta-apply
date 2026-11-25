package edu.ucsb.cs.taapply.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService.AssignmentRow;
import edu.ucsb.cs.taapply.services.AssignmentsService.Assignments;
import edu.ucsb.cs.taapply.services.AssignmentsService.CourseSummary;
import edu.ucsb.cs.taapply.services.AutoAssignmentsService.Made;
import edu.ucsb.cs.taapply.services.AutoAssignmentsService.Outcome;
import edu.ucsb.cs.taapply.services.AutoAssignmentsService.Plan;
import edu.ucsb.cs.taapply.services.AutoAssignmentsService.Skipped;
import edu.ucsb.cs.taapply.services.AutoAssignmentsService.Undone;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Issue #481: the no-conflict auto-assignment, planned on the page's data alone. */
@ExtendWith(MockitoExtension.class)
class AutoAssignmentsServiceTests {
  @Mock AssignmentsService assignmentsService;
  @Mock ApplicationRepository applicationRepository;
  @InjectMocks AutoAssignmentsService service;

  private static final Recruitment RECRUITMENT =
      Recruitment.builder().id(7L).type(RecruitmentType.TA).assignmentsVersion(4).build();

  private static final long A = 10L;
  private static final long B = 20L;
  private static final long C = 30L;

  private static CourseSummary course(long id, int allocation, int assigned) {
    return new CourseSummary(
        id, "CMPSC " + id, "0100", "0" + id, allocation, assigned, allocation - assigned, false);
  }

  private static CourseSummary historical(long id, int allocation, int assigned) {
    return new CourseSummary(
        id, "CMPSC " + id, "0100", "0" + id, allocation, assigned, allocation - assigned, true);
  }

  private static AssignmentRow row(
      long id, Long tentative, Map<Long, Integer> rankings, Map<Long, String> preferences) {
    return new AssignmentRow(
        id, Map.of("firstName", "Applicant " + id), tentative, rankings, preferences);
  }

  private static Assignments page(List<CourseSummary> courses, List<AssignmentRow> rows) {
    return new Assignments(7L, RecruitmentType.TA, List.of("firstName"), courses, rows, 4);
  }

  private static Plan plan(Assignments page) {
    return AutoAssignmentsService.plan(page, Set.of());
  }

  // ---- one clear choice ----

  @Test
  void the_top_remaining_enthusiastic_candidate_nobody_else_wants_is_assigned() {
    Assignments page =
        page(
            List.of(course(A, 1, 0)),
            List.of(
                row(1L, null, Map.of(A, 1), Map.of(A, "1st Choice")),
                row(2L, null, Map.of(A, 2), Map.of(A, "Enthusiastic"))));

    Plan plan = plan(page);

    assertEquals(List.of(new Made(1L, A, 1, 1)), plan.made());
    assertEquals(List.of(), plan.skipped());
  }

  @Test
  void second_choice_and_enthusiastic_count_as_enthusiastic_and_a_lecture_fills_over_passes() {
    // A needs two: Ada (1, 2nd Choice) in pass 1, then Grace (2, Enthusiastic) in pass 2.
    Assignments page =
        page(
            List.of(course(A, 2, 0)),
            List.of(
                row(1L, null, Map.of(A, 1), Map.of(A, "2nd Choice")),
                row(2L, null, Map.of(A, 2), Map.of(A, "Enthusiastic")),
                row(3L, null, Map.of(A, 3), Map.of(A, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(new Made(1L, A, 1, 1), new Made(2L, A, 2, 2)), plan.made());
    assertEquals(List.of(), plan.skipped());
  }

  @Test
  void a_ranking_by_a_full_or_over_assigned_or_historical_lecture_does_not_block() {
    // B is exactly full, C is over-assigned, D is no longer offered though it has places left:
    // none of them holds Ada up, though all three rank her.
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 1), course(C, 1, 2), historical(40L, 2, 0)),
            List.of(
                row(1L, null, Map.of(A, 1, B, 16, C, 1, 40L, 1), Map.of(A, "Enthusiastic")),
                row(2L, B, Map.of(B, 1), Map.of()),
                row(3L, C, Map.of(C, 2), Map.of()),
                row(4L, C, Map.of(C, 3), Map.of())));

    Plan plan = plan(page);

    assertEquals(List.of(new Made(1L, A, 1, 1)), plan.made());
    // The historical lecture is never listed as unfilled either.
    assertEquals(List.of(), plan.skipped());
  }

  // ---- what blocks ----

  @Test
  void a_candidate_ranked_by_two_needing_lectures_is_left_to_a_human_and_both_are_named() {
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0), course(C, 1, 0)),
            List.of(
                row(
                    1L,
                    null,
                    Map.of(A, 1, B, 1, C, 5),
                    Map.of(A, "1st Choice", B, "Enthusiastic", C, "Enthusiastic")),
                row(2L, null, Map.of(C, 1), Map.of(C, "1st Choice"))));

    Plan plan = plan(page);

    // C's top candidate is Applicant 2, whom nobody else ranks: assigned. A and B each see
    // Applicant 1 ranked by the other (and by C only while C still needed someone, in pass 1).
    assertEquals(List.of(new Made(2L, C, 1, 1)), plan.made());
    assertEquals(
        List.of(
            new Skipped(A, "RANKED_ELSEWHERE", 1L, 1, List.of(B)),
            new Skipped(B, "RANKED_ELSEWHERE", 1L, 1, List.of(A))),
        plan.skipped());
  }

  @Test
  void a_lecture_whose_top_candidate_is_not_enthusiastic_makes_no_assignment_at_all() {
    // Grace (rank 2) would qualify, but Ada (rank 1, Would Consider) is a judgement call first.
    Assignments page =
        page(
            List.of(course(A, 1, 0)),
            List.of(
                row(1L, null, Map.of(A, 1), Map.of(A, "Would Consider")),
                row(2L, null, Map.of(A, 2), Map.of(A, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(), plan.made());
    assertEquals(List.of(new Skipped(A, "NOT_ENTHUSIASTIC", 1L, 1, List.of())), plan.skipped());
  }

  @Test
  void no_interest_recorded_is_not_enthusiastic_either() {
    Assignments page =
        page(List.of(course(A, 1, 0)), List.of(row(1L, null, Map.of(A, 1), Map.of())));

    Plan plan = plan(page);

    assertEquals(List.of(), plan.made());
    assertEquals(List.of(new Skipped(A, "NOT_ENTHUSIASTIC", 1L, 1, List.of())), plan.skipped());
  }

  @Test
  void a_tie_at_the_top_remaining_rank_is_a_judgement_call() {
    Assignments page =
        page(
            List.of(course(A, 2, 0)),
            List.of(
                row(1L, null, Map.of(A, 2), Map.of(A, "1st Choice")),
                row(2L, null, Map.of(A, 2), Map.of(A, "1st Choice")),
                row(3L, null, Map.of(A, 3), Map.of(A, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(), plan.made());
    assertEquals(List.of(new Skipped(A, "TIE", null, 2, List.of())), plan.skipped());
  }

  @Test
  void a_lecture_with_no_rankings_is_told_apart_from_one_whose_ranked_candidates_are_all_placed() {
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0)),
            List.of(row(1L, C, Map.of(B, 1), Map.of(B, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(), plan.made());
    assertEquals(
        List.of(
            new Skipped(A, "NO_RANKINGS", null, null, List.of()),
            new Skipped(B, "ALL_RANKED_ASSIGNED", null, null, List.of())),
        plan.skipped());
  }

  @Test
  void a_ranking_row_without_a_rank_counts_as_unranked() {
    Map<Long, Integer> cleared = new HashMap<>();
    cleared.put(A, null);
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0)),
            List.of(
                row(1L, null, cleared, Map.of(A, "1st Choice")),
                row(2L, null, Map.of(A, 1, B, 1), Map.of(A, "1st Choice", B, "1st Choice"))));
    // Applicant 2 is blocked (A and B both rank them), and Applicant 1's cleared rank for A does
    // not make them A's candidate, nor does it block B... which has nobody else anyway.
    Map<Long, Integer> clearedB = new HashMap<>();
    clearedB.put(B, null);
    clearedB.put(A, 2);
    Assignments withBlockerCleared =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0)),
            List.of(
                row(1L, null, clearedB, Map.of(A, "1st Choice")),
                row(2L, null, Map.of(B, 1), Map.of(B, "1st Choice"))));

    assertEquals(
        List.of(
            new Skipped(A, "RANKED_ELSEWHERE", 2L, 1, List.of(B)),
            new Skipped(B, "RANKED_ELSEWHERE", 2L, 1, List.of(A))),
        plan(page).skipped());
    assertEquals(List.of(), plan(page).made());
    // A cleared rank by B is no ranking by B: Applicant 1 goes to A, Applicant 2 to B.
    assertEquals(
        List.of(new Made(1L, A, 2, 1), new Made(2L, B, 1, 1)), plan(withBlockerCleared).made());
  }

  // ---- passes ----

  @Test
  void filling_a_lecture_frees_the_candidates_it_ranked_for_the_next_pass() {
    // A: Ada 1, Grace 2. B: Grace 1. Pass 1 gives Ada to A; A is then full, so B's ranking of
    // Grace is no longer rivalled by A's, and pass 2 gives Grace to B.
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0)),
            List.of(
                row(1L, null, Map.of(A, 1), Map.of(A, "Enthusiastic")),
                row(2L, null, Map.of(A, 2, B, 1), Map.of(A, "Enthusiastic", B, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(new Made(1L, A, 1, 1), new Made(2L, B, 1, 2)), plan.made());
    assertEquals(List.of(), plan.skipped());
  }

  @Test
  void placing_a_candidate_promotes_the_next_one_in_the_next_pass() {
    // B's top is Grace, who is also A's top: blocked for both until... A's top is Grace too, so
    // nothing happens for A either. But C ranks Ada alone, Ada goes to C in pass 1; nothing
    // changes for A and B, and the run stops with both named.
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0), course(C, 1, 0)),
            List.of(
                row(1L, null, Map.of(C, 1), Map.of(C, "1st Choice")),
                row(2L, null, Map.of(A, 1, B, 1), Map.of(A, "1st Choice", B, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(new Made(1L, C, 1, 1)), plan.made());
    assertEquals(2, plan.skipped().size());
  }

  @Test
  void nothing_to_do_when_no_lecture_needs_anyone() {
    Assignments page =
        page(
            List.of(course(A, 1, 1), course(B, 0, 0)),
            List.of(row(1L, A, Map.of(A, 1), Map.of(A, "1st Choice"))));

    Plan plan = plan(page);

    assertEquals(List.of(), plan.made());
    assertEquals(List.of(), plan.skipped());
  }

  @Test
  void already_placed_candidates_are_neither_assigned_again_nor_blockers() {
    // Grace is placed in C by hand; her rankings by A and B are moot, so Ada (A's next) is clear.
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0), course(C, 1, 1)),
            List.of(
                row(2L, C, Map.of(A, 1, B, 1), Map.of(A, "1st Choice", B, "1st Choice")),
                row(1L, null, Map.of(A, 2), Map.of(A, "Enthusiastic"))));

    Plan plan = plan(page);

    assertEquals(List.of(new Made(1L, A, 2, 1)), plan.made());
    assertEquals(
        List.of(new Skipped(B, "ALL_RANKED_ASSIGNED", null, null, List.of())), plan.skipped());
  }

  @Test
  void ineligible_candidates_are_passed_over_as_if_placed() {
    Assignments page =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0)),
            List.of(
                row(1L, null, Map.of(A, 1, B, 1), Map.of(A, "1st Choice", B, "1st Choice")),
                row(2L, null, Map.of(A, 2), Map.of(A, "Enthusiastic"))));

    Plan plan = AutoAssignmentsService.plan(page, Set.of(1L));

    assertEquals(List.of(new Made(2L, A, 2, 1)), plan.made());
    assertEquals(
        List.of(new Skipped(B, "ALL_RANKED_ASSIGNED", null, null, List.of())), plan.skipped());
  }

  // ---- run and undo ----

  private static Application application(long id, Long tentative, ApplicationReviewStatus status) {
    return Application.builder()
        .id(id)
        .recruitmentId(7L)
        .email(id + "@ucsb.edu")
        .tentativeAssignmentId(tentative)
        .status(status)
        .build();
  }

  @Test
  void run_saves_each_planned_assignment_and_answers_with_the_page_as_it_then_stands() {
    Application ada = application(1L, null, ApplicationReviewStatus.PENDING);
    Application grace = application(2L, null, ApplicationReviewStatus.NOT_HIRED);
    Application alan = application(3L, null, ApplicationReviewStatus.HIRED);
    when(assignmentsService.realApplications(7L)).thenReturn(List.of(ada, grace, alan));
    // Grace tops A's list but is Not Hired, so Ada is A's candidate; Alan is B's.
    Assignments before =
        page(
            List.of(course(A, 1, 0), course(B, 1, 0)),
            List.of(
                row(1L, null, Map.of(A, 2), Map.of(A, "1st Choice")),
                row(2L, null, Map.of(A, 1), Map.of(A, "1st Choice")),
                row(3L, null, Map.of(B, 1), Map.of(B, "Enthusiastic"))));
    Assignments after = page(List.of(course(A, 1, 1), course(B, 1, 1)), List.of());
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(before, after);

    Outcome outcome = service.run(RECRUITMENT);

    ArgumentCaptor<Application> saved = ArgumentCaptor.forClass(Application.class);
    verify(applicationRepository, org.mockito.Mockito.times(2)).save(saved.capture());
    assertSame(ada, saved.getAllValues().get(0));
    assertEquals(A, ada.getTentativeAssignmentId());
    assertSame(alan, saved.getAllValues().get(1));
    assertEquals(B, alan.getTentativeAssignmentId());
    assertNull(grace.getTentativeAssignmentId());
    assertSame(after, outcome.assignments());
    assertEquals(List.of(new Made(1L, A, 2, 1), new Made(3L, B, 1, 1)), outcome.made());
    assertEquals(List.of(), outcome.skipped());
  }

  @Test
  void run_with_nothing_to_do_saves_nothing_and_reports_the_unfilled_lectures() {
    when(assignmentsService.realApplications(7L))
        .thenReturn(List.of(application(1L, null, ApplicationReviewStatus.PENDING)));
    Assignments page = page(List.of(course(A, 1, 0)), List.of(row(1L, null, Map.of(), Map.of())));
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(page);

    Outcome outcome = service.run(RECRUITMENT);

    verify(applicationRepository, never()).save(any());
    assertEquals(List.of(), outcome.made());
    assertEquals(List.of(new Skipped(A, "NO_RANKINGS", null, null, List.of())), outcome.skipped());
    assertSame(page, outcome.assignments());
  }

  @Test
  void undo_clears_only_the_assignments_still_as_the_run_left_them() {
    Application ada = application(1L, A, ApplicationReviewStatus.PENDING);
    Application grace = application(2L, C, ApplicationReviewStatus.PENDING); // moved by hand
    Application alan = application(3L, null, ApplicationReviewStatus.PENDING); // cleared by hand
    when(assignmentsService.realApplications(7L)).thenReturn(List.of(ada, grace, alan));
    Assignments after = page(List.of(course(A, 1, 0)), List.of());
    when(assignmentsService.assignments(RECRUITMENT)).thenReturn(after);

    Undone undone =
        service.undo(
            RECRUITMENT,
            List.of(
                new Made(1L, A, 1, 1),
                new Made(2L, B, 1, 1),
                new Made(3L, A, 2, 2),
                new Made(99L, A, 3, 2), // no such applicant any more
                new Made(1L, null, 1, 1))); // a malformed entry is ignored

    verify(applicationRepository).save(ada);
    verify(applicationRepository, never()).save(grace);
    verify(applicationRepository, never()).save(alan);
    assertNull(ada.getTentativeAssignmentId());
    assertEquals(C, grace.getTentativeAssignmentId());
    assertEquals(1, undone.cleared());
    assertSame(after, undone.assignments());
  }
}
