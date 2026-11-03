package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.concurrency.Presence;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin Assignments page (issue #179): faculty rankings side by side with the admin's tentative
 * assignment of each applicant to a section. Admin only; nothing here is shown to applicants or
 * faculty at this stage.
 */
@Tag(name = "AdminAssignments")
@RequestMapping("/api/admin/assignments")
@RestController
public class AdminAssignmentsController extends ApiController {
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired AssignmentsService assignmentsService;
  @Autowired ClientActivityDetector clientActivityDetector;

  @Operation(
      summary = "A recruitment's sections, applicants, rankings and tentative assignments",
      description =
          "Real, uncancelled applications only, with the identity columns of the rankings CSV for"
              + " the recruitment's type. Every section not removed is listed; a removed section"
              + " only while it still has rankings or an assignee. Each section carries its"
              + " allocation, how many are assigned to it and how many places are left. 404 for a"
              + " recruitment that does not exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("")
  public AssignmentsService.Assignments forRecruitment(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    return assignmentsService.assignments(recruitmentOf(recruitmentId));
  }

  @Operation(
      summary = "A recruitment's cancelled applications",
      description =
          "Name, email and the applicant's reason, for the bottom of the Assignments page (issue"
              + " #199). Test applications are left out. 404 for a recruitment that does not"
              + " exist.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/cancelled")
  public List<AssignmentsService.CancelledApplication> cancelled(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    return assignmentsService.cancelledApplications(recruitmentOf(recruitmentId).getId());
  }

  @Operation(
      summary = "Tentatively assign an applicant to a section, or clear the assignment",
      description =
          "Leave recruitmentCourseId out to clear. 400 if the section is not part of the"
              + " application's recruitment; 404 for an application or section that does not exist."
              + " The version is the recruitment's assignments version the page last saw (the"
              + " 'version' of the GET and of the last assignment); if the assignments have changed"
              + " since, by another tab, publishing or an applicant cancelling, nothing is changed"
              + " and the answer is 409 Conflict with the assignments as they now stand. Otherwise"
              + " returns the recruitment's assignments as the GET does, with the new counts and"
              + " version. A request that names its client (X-Client-Id) also tells the server this"
              + " tab is on the assignments page, for the multi-tab warning.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/tentative")
  public ResponseEntity<Object> setTentative(
      @Parameter(name = "applicationId") @RequestParam Long applicationId,
      @Parameter(name = "recruitmentCourseId") @RequestParam(required = false)
          Long recruitmentCourseId,
      @Parameter(name = "version") @RequestParam Integer version,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    Application application =
        applicationRepository
            .findById(applicationId)
            .orElseThrow(() -> new EntityNotFoundException(Application.class, applicationId));
    if (recruitmentCourseId != null) {
      RecruitmentCourse course =
          recruitmentCourseRepository
              .findById(recruitmentCourseId)
              .orElseThrow(
                  () -> new EntityNotFoundException(RecruitmentCourse.class, recruitmentCourseId));
      if (!course.getRecruitmentId().equals(application.getRecruitmentId())) {
        throw new IllegalArgumentException(
            "RecruitmentCourse %d is not part of recruitment %d"
                .formatted(recruitmentCourseId, application.getRecruitmentId()));
      }
    }
    Long recruitmentId = application.getRecruitmentId();
    clientActivityDetector.note(resourceKey(recruitmentId), clientId, identity());
    // One atomic statement: it counts the version up only if it is still the one the page saw.
    if (recruitmentRepository.bumpAssignmentsVersionIf(recruitmentId, version) == 0) {
      return conflict(recruitmentId);
    }
    application.setTentativeAssignmentId(recruitmentCourseId);
    try {
      applicationRepository.save(application);
    } catch (ObjectOptimisticLockingFailureException e) {
      // The application has a version of its own (issue #302): the applicant or another admin saved
      // it between reading it and writing it. The placement is not made; the page is refreshed.
      return conflict(recruitmentId);
    }
    return ResponseEntity.ok(assignmentsService.assignments(recruitmentOf(recruitmentId)));
  }

  /** The 409 for a stale placement: why, and the assignments as they now stand. */
  private ResponseEntity<Object> conflict(Long recruitmentId) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(
        "message",
        "Assignments changed while you were working. The page has been refreshed; please check"
            + " the placement and try again.");
    body.put("assignments", assignmentsService.assignments(recruitmentOf(recruitmentId)));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  @Operation(
      summary = "Say that this tab still has the assignments page open, and learn who else does",
      description =
          "Changes nothing about the assignments, not even their version. Tells the server this"
              + " client (X-Client-Id) is still here, and answers with the other people who have"
              + " this recruitment's assignments page open (a label for each, and whether it is the"
              + " same person in another tab or window) and how often to send this. Admins only,"
              + " and 404 for a recruitment that does not exist; nothing is recorded or told to"
              + " anyone who is refused.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/heartbeat")
  public Presence heartbeat(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    // The role check (PreAuthorize) and the existence check come before the detector is touched.
    recruitmentOf(recruitmentId);
    return clientActivityDetector.heartbeat(resourceKey(recruitmentId), clientId, identity());
  }

  @Operation(
      summary = "Say that this tab has left the assignments page",
      description =
          "Sent when a tab is closed or moves away, so that the others stop being warned about it"
              + " at once. Allowed to exactly whom a heartbeat is: admins only, and for anyone else"
              + " nothing is removed. The answer is 204 whether or not the client was known.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leave(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    recruitmentOf(recruitmentId);
    clientActivityDetector.leave(resourceKey(recruitmentId), clientId);
  }

  /** The detector's name for a recruitment's whole assignments page. */
  private static String resourceKey(Long recruitmentId) {
    return "assignments:" + recruitmentId;
  }

  /**
   * Who the current user is to the detector: the shared identity, marked as an admin (issue #302).
   */
  private ClientIdentity identity() {
    return ApplicationsController.identityOf(getCurrentUser().getUser(), true);
  }

  private Recruitment recruitmentOf(Long recruitmentId) {
    return recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }
}
