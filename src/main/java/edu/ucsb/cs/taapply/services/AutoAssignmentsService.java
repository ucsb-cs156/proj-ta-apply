package edu.ucsb.cs.taapply.services;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationReviewStatus;
import edu.ucsb.cs.taapply.enums.ClassLevel;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService.AssignmentRow;
import edu.ucsb.cs.taapply.services.AssignmentsService.Assignments;
import edu.ucsb.cs.taapply.services.AssignmentsService.CourseSummary;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Automatically Assign No-Conflict Slots (issue #481): fills every place where there is one clear,
 * rational choice. A lecture that still needs assignments gets its highest-ranked remaining
 * candidate when that candidate is enthusiastic about the course and no other lecture that still
 * needs assignments has ranked them at all. Passes are repeated until one makes no assignment.
 *
 * <p>For a TA recruitment (issue #488) only PhD students in Computer Science are ever assigned
 * automatically. An MS student, or a PhD student in another major, is still a candidate, so a
 * lecture whose top remaining candidate is one gets nothing and is listed with the reason: passing
 * over them to the next PhD would override the instructor's ranking, which is a person's call. A
 * ULA recruitment has no class levels and the rule does not apply.
 *
 * <p>The planning is pure ({@link #plan}) and works on the page's own data, so the controller tests
 * and this service's tests need no database. Within a pass, two assignments can never share a
 * candidate (a shared candidate is ranked by two needing lectures, so blocked for both) or a
 * lecture, and making one only removes blockers, never adds one; so the result does not depend on
 * the order lectures are visited, and repeating until nothing changes is safe.
 */
@Service
public class AutoAssignmentsService {
  @Autowired AssignmentsService assignmentsService;
  @Autowired ApplicationRepository applicationRepository;

  /** Why a lecture that still needs assignments got none in the final pass. */
  public static final String NO_RANKINGS = "NO_RANKINGS";

  public static final String ALL_RANKED_ASSIGNED = "ALL_RANKED_ASSIGNED";
  public static final String TIE = "TIE";
  public static final String NOT_ENTHUSIASTIC = "NOT_ENTHUSIASTIC";
  public static final String RANKED_ELSEWHERE = "RANKED_ELSEWHERE";

  /** TA only (issue #488): the top remaining candidate is not a PhD student. */
  public static final String NOT_PHD = "NOT_PHD";

  /**
   * TA only (issue #488): the top remaining candidate is a PhD student but not in Computer Science.
   */
  public static final String NOT_CS_MAJOR = "NOT_CS_MAJOR";

  /**
   * The majors that count as Computer Science for a TA auto-assignment (issue #488), as the TA
   * majors list has spelt them; compared ignoring case and surrounding spaces.
   */
  static final Set<String> CS_MAJORS = Set.of("computer science", "computer science (cs)");

  /** The interests that count as enthusiastic: the preference scale's three strongest. */
  static final Set<String> ENTHUSIASTIC =
      Set.of(
          AssignmentsService.FIRST_CHOICE,
          AssignmentsService.SECOND_CHOICE,
          AssignmentsService.ENTHUSIASTIC);

  /** One assignment the run made: who, to which lecture, at what rank, in which pass. */
  public record Made(Long applicationId, Long recruitmentCourseId, Integer rank, int pass) {}

  /**
   * One lecture still needing assignments after the final pass, and why it got none: the reason
   * code; the candidate it looked at and their rank, when there was one; and, for {@code
   * RANKED_ELSEWHERE}, the other needing lectures that ranked that candidate.
   */
  public record Skipped(
      Long recruitmentCourseId,
      String reason,
      Long applicationId,
      Integer rank,
      List<Long> blockedBy) {}

  /** What a run would do: the assignments to make, and the final pass's unfilled lectures. */
  public record Plan(List<Made> made, List<Skipped> skipped) {}

  /**
   * The answer to a run: the assignments as they now stand, and what the run did and did not do.
   */
  public record Outcome(Assignments assignments, List<Made> made, List<Skipped> skipped) {}

  /** The answer to an undo: the assignments as they now stand, and how many were cleared. */
  public record Undone(Assignments assignments, int cleared) {}

  /** {@link #plan(Assignments, Set, Map)} with nobody restricted to manual assignment. */
  public static Plan plan(Assignments page, Set<Long> ineligible) {
    return plan(page, ineligible, Map.of());
  }

  /**
   * Plans a run over the page as it stands, without changing anything. {@code ineligible} are the
   * applications never to assign (those marked Not Hired): they are left out of every ranking list,
   * as if already placed, so they neither receive a place nor hold one up. {@code manualOnly} are
   * the applications that may only be assigned by hand (issue #488), each with the reason code
   * ({@link #NOT_PHD} or {@link #NOT_CS_MAJOR}): they stay in every ranking list, so a lecture
   * whose top remaining candidate is one of them gets nothing, with that reason.
   */
  public static Plan plan(Assignments page, Set<Long> ineligible, Map<Long, String> manualOnly) {
    Map<Long, Integer> left = new LinkedHashMap<>();
    for (CourseSummary course : page.courses()) {
      if (!course.historical()) {
        left.put(course.id(), course.left());
      }
    }
    List<AssignmentRow> pool = new ArrayList<>();
    for (AssignmentRow row : page.rows()) {
      if (row.tentativeAssignment() == null && !ineligible.contains(row.applicationId())) {
        pool.add(row);
      }
    }

    List<Made> made = new ArrayList<>();
    List<Skipped> skipped;
    int pass = 0;
    while (true) {
      pass++;
      List<Made> thisPass = new ArrayList<>();
      skipped = new ArrayList<>();
      for (Long courseId : needing(left)) {
        Skipped reason = consider(courseId, pool, left, page.rows(), manualOnly, pass, thisPass);
        if (reason != null) {
          skipped.add(reason);
        }
      }
      if (thisPass.isEmpty()) {
        break;
      }
      for (Made assignment : thisPass) {
        pool.removeIf(row -> row.applicationId().equals(assignment.applicationId()));
        left.merge(assignment.recruitmentCourseId(), -1, Integer::sum);
      }
      made.addAll(thisPass);
    }
    return new Plan(made, skipped);
  }

  /** The lectures on offer with places still to fill, in the page's order. */
  private static List<Long> needing(Map<Long, Integer> left) {
    List<Long> ids = new ArrayList<>();
    left.forEach(
        (id, places) -> {
          if (places > 0) {
            ids.add(id);
          }
        });
    return ids;
  }

  /**
   * One lecture's turn in a pass: adds its assignment to {@code thisPass} and returns null, or
   * returns why it made none.
   */
  private static Skipped consider(
      Long courseId,
      List<AssignmentRow> pool,
      Map<Long, Integer> left,
      List<AssignmentRow> allRows,
      Map<Long, String> manualOnly,
      int pass,
      List<Made> thisPass) {
    AssignmentRow top = null;
    int topRank = Integer.MAX_VALUE;
    int atTopRank = 0;
    for (AssignmentRow row : pool) {
      Integer rank = row.rankings().get(courseId);
      if (rank == null) {
        continue;
      }
      if (rank < topRank) {
        top = row;
        topRank = rank;
        atTopRank = 1;
      } else if (rank == topRank) {
        atTopRank++;
      }
    }
    if (top == null) {
      boolean anyRanked = allRows.stream().anyMatch(row -> row.rankings().get(courseId) != null);
      return new Skipped(
          courseId, anyRanked ? ALL_RANKED_ASSIGNED : NO_RANKINGS, null, null, List.of());
    }
    if (atTopRank > 1) {
      return new Skipped(courseId, TIE, null, topRank, List.of());
    }
    String manual = manualOnly.get(top.applicationId());
    if (manual != null) {
      return new Skipped(courseId, manual, top.applicationId(), topRank, List.of());
    }
    String preference = top.preferences().get(courseId);
    if (preference == null || !ENTHUSIASTIC.contains(preference)) {
      return new Skipped(courseId, NOT_ENTHUSIASTIC, top.applicationId(), topRank, List.of());
    }
    List<Long> blockedBy = new ArrayList<>();
    for (Long other : needing(left)) {
      if (!other.equals(courseId) && top.rankings().get(other) != null) {
        blockedBy.add(other);
      }
    }
    if (!blockedBy.isEmpty()) {
      return new Skipped(courseId, RANKED_ELSEWHERE, top.applicationId(), topRank, blockedBy);
    }
    thisPass.add(new Made(top.applicationId(), courseId, topRank, pass));
    return null;
  }

  /**
   * Plans and makes the run's assignments, all in one transaction: if any application cannot be
   * saved (its own version moved, issue #302), none of them is changed. The answer carries the
   * assignments as they stand afterwards.
   */
  @Transactional
  public Outcome run(Recruitment recruitment) {
    List<Application> applications = assignmentsService.realApplications(recruitment.getId());
    Set<Long> ineligible = new HashSet<>();
    Map<Long, String> manualOnly = new HashMap<>();
    boolean ta = recruitment.getType() == RecruitmentType.TA;
    for (Application application : applications) {
      if (application.getStatus() == ApplicationReviewStatus.NOT_HIRED) {
        ineligible.add(application.getId());
      } else if (ta) {
        String reason = manualOnlyReason(application);
        if (reason != null) {
          manualOnly.put(application.getId(), reason);
        }
      }
    }
    Plan plan = plan(assignmentsService.assignments(recruitment), ineligible, manualOnly);
    for (Made assignment : plan.made()) {
      Application application = byId(applications, assignment.applicationId());
      application.setTentativeAssignmentId(assignment.recruitmentCourseId());
      applicationRepository.save(application);
    }
    return new Outcome(assignmentsService.assignments(recruitment), plan.made(), plan.skipped());
  }

  /**
   * Undoes a run: clears exactly the given assignments, and only where the application is still
   * pencilled into the lecture the run put it in, so a placement changed by hand since is kept. All
   * in one transaction.
   */
  @Transactional
  public Undone undo(Recruitment recruitment, List<Made> made) {
    List<Application> applications = assignmentsService.realApplications(recruitment.getId());
    int cleared = 0;
    for (Made assignment : made) {
      Application application = byId(applications, assignment.applicationId());
      if (application != null
          && assignment.recruitmentCourseId() != null
          && assignment.recruitmentCourseId().equals(application.getTentativeAssignmentId())) {
        application.setTentativeAssignmentId(null);
        applicationRepository.save(application);
        cleared++;
      }
    }
    return new Undone(assignmentsService.assignments(recruitment), cleared);
  }

  /**
   * Why a TA applicant may only be assigned by hand (issue #488), or null when they may be assigned
   * automatically: not a PhD student, or a PhD student whose major is not Computer Science. An
   * application with no class level or no major recorded is not auto-assigned either.
   */
  static String manualOnlyReason(Application application) {
    if (application.getClassLevel() != ClassLevel.PHD) {
      return NOT_PHD;
    }
    String major = application.getMajor();
    if (major == null || !CS_MAJORS.contains(major.strip().toLowerCase(Locale.ROOT))) {
      return NOT_CS_MAJOR;
    }
    return null;
  }

  private static Application byId(List<Application> applications, Long id) {
    return applications.stream().filter(a -> a.getId().equals(id)).findFirst().orElse(null);
  }
}
