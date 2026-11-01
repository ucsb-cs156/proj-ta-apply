package edu.ucsb.cs.taapply.services;

import com.fasterxml.jackson.annotation.JsonInclude;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Where a recruitment stands in the nine steps of the Recruitment Steps flow (issue #231, design in
 * docs/design/AdminUserInterfaceDesign.md): for each step whether it is done, the label shown along
 * the bottom of its box, and what its title opens (a page or one of the card's modals). The
 * response matches the types in {@code frontend/src/main/utils/recruitmentSteps.ts}, so the
 * frontend only draws it.
 *
 * <p>Steps: 1 Create, 2 Open Applications, 3 Budget / Allocations, 4 Close Applications, 5 Release
 * Allocations, 6 Open Faculty Ranking, 7 Close Faculty Ranking, 8 Assign Candidates, 9 Release
 * Hiring Decisions.
 */
@Service
public class RecruitmentStepsService {

  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired AssignmentsService assignmentsService;

  /** A link the diagram draws: a word of a title, or a "(see rankings)" line. */
  public record Link(String text, String href) {}

  /**
   * One step's status. Fields that do not apply to the step are null and left out of the JSON.
   *
   * @param action the card modal the title opens, instead of {@code href}
   * @param titleLinks step 3 only: the words "Budget" and "Allocations", each its own link
   * @param secondaryLink steps 7 and 9: the "(see rankings)" / "(see assignments)" link
   * @param tentative step 9 only: hiring decisions are released but applications or faculty ranking
   *     have been reopened
   */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Step(
      int number,
      boolean done,
      String label,
      String href,
      String action,
      List<Link> titleLinks,
      Link secondaryLink,
      Boolean tentative) {}

  public record Steps(Long recruitmentId, RecruitmentType type, List<Step> steps) {}

  /** The status of all nine steps of the recruitment, in order. */
  public Steps stepsFor(Recruitment recruitment) {
    Long id = recruitment.getId();
    String courses = "/admin/recruitments/" + id + "/courses";
    boolean applicationsOpen = recruitment.getApplicationStatus() == ApplicationStatus.OPEN;
    boolean reviewsOpen = "Open".equals(recruitment.getReviewStatus());
    int target = recruitment.getTotalHiringTarget();
    int allocated =
        recruitmentCourseRepository.findByRecruitmentId(id).stream()
            .filter(course -> !course.isRemoved())
            .mapToInt(RecruitmentCourse::getAllocation)
            .sum();
    int assigned =
        AssignmentsService.assignedCounts(assignmentsService.realApplications(id)).values().stream()
            .mapToInt(Integer::intValue)
            .sum();
    boolean published = Boolean.TRUE.equals(recruitment.getAssignmentsPublished());

    boolean opened = recruitment.getActualOpeningDate() != null;
    boolean closed = recruitment.getActualClosingDate() != null && !applicationsOpen;
    boolean released = recruitment.getAllocationVisibility() != AllocationVisibility.ADMINS_ONLY;
    boolean reviewOpened = recruitment.getFacultyReviewOpeningDate() != null;
    boolean reviewClosed = "Closed".equals(recruitment.getReviewStatus());
    boolean assignmentComplete = assigned >= target;

    // Steps 2 and 4 open the same modal, whichever way the applications are going; so do 6 and 7.
    String applicationsAction = applicationsOpen ? "closeApplications" : "openApplications";
    String reviewsAction = reviewsOpen ? "closeReviews" : "openReviews";

    return new Steps(
        id,
        recruitment.getType(),
        List.of(
            new Step(
                1,
                true,
                recruitment.getCreatedAt() == null
                    ? "Created"
                    : "Created: " + dateOf(recruitment.getCreatedAt()),
                null,
                null,
                null,
                null,
                null),
            new Step(
                2,
                opened,
                opened
                    ? "Opened: " + recruitment.getActualOpeningDate()
                    : "Tentative: " + orNotSet(recruitment.getTentativeOpeningDate()),
                null,
                applicationsAction,
                null,
                null,
                null),
            new Step(
                3,
                allocated == target,
                "Hiring Target: " + target,
                null,
                null,
                List.of(
                    new Link("Budget", "/admin/budget/" + qyy(recruitment.getQuarter())),
                    new Link("Allocations", courses)),
                null,
                null),
            new Step(
                4,
                closed,
                closed
                    ? "Closed: " + recruitment.getActualClosingDate()
                    : "Prim. Consid: " + orNotSet(recruitment.getPrimaryConsiderationDate()),
                null,
                applicationsAction,
                null,
                null,
                null),
            new Step(
                5,
                released,
                released
                    ? "Released" + datedSuffix(recruitment.getAllocationsReleasedAt())
                    : "Not released yet",
                null,
                "allocationVisibility",
                null,
                null,
                null),
            new Step(
                6,
                reviewOpened,
                reviewOpened
                    ? "Opened: " + recruitment.getFacultyReviewOpeningDate()
                    : "Not opened yet",
                null,
                reviewsAction,
                null,
                null,
                null),
            new Step(
                7,
                reviewClosed,
                reviewClosed
                    ? "Closed" + datedSuffix(recruitment.getFacultyReviewClosedAt())
                    : recruitment.getFacultyRankingDeadline() == null
                        ? "Not closed yet"
                        : "Deadline: " + recruitment.getFacultyRankingDeadline(),
                null,
                reviewsAction,
                null,
                new Link("(see rankings)", courses),
                null),
            new Step(
                8,
                assignmentComplete,
                assignmentComplete
                    ? "Assignment complete"
                    : "Still to assign: " + (target - assigned),
                "/admin/recruitments/" + id + "/assignments",
                null,
                null,
                null,
                null),
            new Step(
                9,
                published,
                published
                    ? "Released" + datedSuffix(recruitment.getAssignmentsPublishedAt())
                    : "Not released yet",
                published ? "/recruitments/" + id + "/assignments" : null,
                published ? null : "publishAssignments",
                null,
                new Link("(see assignments)", courses),
                published && (applicationsOpen || reviewsOpen))));
  }

  /** "Tentative: not set" rather than "Tentative: null" for a date nobody entered. */
  private static String orNotSet(Object date) {
    return date == null ? "not set" : date.toString();
  }

  /** ": 2026-02-03" for a stamped date, or nothing for a legacy row that was never stamped. */
  private static String datedSuffix(LocalDateTime stamp) {
    return stamp == null ? "" : ": " + dateOf(stamp);
  }

  private static String dateOf(LocalDateTime stamp) {
    return stamp.toLocalDate().toString();
  }

  /**
   * The quarter as admins write it: "20264" becomes "F26" (W, S, M or F, then the two-digit year).
   * The frontend has the same conversion; the backend needs it for the Budget page link.
   */
  static String qyy(String yyyyq) {
    String letters = "WSMF";
    return letters.charAt(Character.digit(yyyyq.charAt(4), 10) - 1) + yyyyq.substring(2, 4);
  }
}
