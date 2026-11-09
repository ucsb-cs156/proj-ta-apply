package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.concurrency.Presence;
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.controller.ApplicationsController.PriorCourseworkFields;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
import edu.ucsb.cs.taapply.services.DraftApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * An applicant's drafts: applications as they are being filled in (issue #270).
 *
 * <p>A draft is saved without being checked. Nothing is required of it and no rule about the form
 * is applied, because the point is never to lose what the applicant has typed, and what they have
 * typed so far may be anything. All the rules apply, unchanged, when the application is submitted.
 *
 * <p>Like the applications controller, every read and write confirms the draft is the current
 * user's.
 */
@Tag(name = "Draft applications")
@RequestMapping("/api/draftApplications")
@RestController
public class DraftApplicationsController extends ApiController {

  @Autowired DraftApplicationRepository draftApplicationRepository;
  @Autowired DraftApplicationService draftApplicationService;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired ApplicationAccessService applicationAccessService;
  @Autowired ClientActivityDetector clientActivityDetector;

  private String currentEmail() {
    return getCurrentUser().getUser().getEmail();
  }

  /** Loads a draft, refusing anyone else's rather than merely not finding it. */
  private DraftApplication mine(Long id) {
    DraftApplication draft =
        draftApplicationRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(DraftApplication.class, id));
    if (!currentEmail().equals(draft.getEmail())) {
      throw new ForbiddenException("That draft belongs to someone else");
    }
    return draft;
  }

  private Recruitment recruitment(Long recruitmentId) {
    return recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }

  @Operation(summary = "The current user's own drafts, newest first")
  @PreAuthorize("hasRole('ROLE_USER')")
  @GetMapping("/mine")
  public List<DraftApplication> myDrafts() {
    return draftApplicationRepository.findByEmailOrderByIdDesc(currentEmail());
  }

  @Operation(
      summary = "Start, or resume, the draft for a recruitment",
      description =
          "Returns the current user's draft for the recruitment, creating an empty one if there is"
              + " none. Refused if the recruitment is not open or they already have an application"
              + " for it that is not cancelled, since a draft is only for an application not yet submitted.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/open")
  public DraftApplication openDraft(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {
    Recruitment recruitment = recruitment(recruitmentId);
    if (!applicationAccessService.acceptingApplications(recruitment)) {
      throw new IllegalArgumentException(
          "Applications are not currently open for this recruitment");
    }
    String email = currentEmail();
    // The check that they have no application yet and the insert are one transaction (issue #417).
    // A cancelled application does not stop them starting a new one (issue #318).
    try {
      return draftApplicationService.open(email, recruitmentId);
    } catch (DataIntegrityViolationException e) {
      // The same person's form opened twice at once, and the second insert broke the unique
      // constraint: the draft the first one made is the answer.
      return draftApplicationRepository
          .findByEmailAndRecruitmentId(email, recruitmentId)
          .orElseThrow(() -> e);
    }
  }

  /**
   * Who the current user is to the detector (issue #273): the email address is the person, and the
   * label other people see is the email address followed by the full name in parentheses, or the
   * email address alone if there is no name.
   */
  private ClientIdentity identity() {
    User user = getCurrentUser().getUser();
    String name = user.getFullName();
    String label =
        name == null || name.isBlank()
            ? user.getEmail()
            : user.getEmail() + " (" + name.trim() + ")";
    return new ClientIdentity(user.getEmail(), label);
  }

  /** The detector's name for a draft. */
  private static String resourceKey(Long id) {
    return "draft:" + id;
  }

  /** What a refused save tells the form: why, and the draft as it now stands. */
  private ResponseEntity<Object> conflict(DraftApplication current) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(
        "message",
        "This draft was changed in another tab or window. Reload to see the latest version.");
    body.put("version", current.getVersion());
    body.put("draft", current);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  @Operation(
      summary = "Save a draft",
      description =
          "Replaces what the draft holds with what the form has now. Nothing is validated except that a"
              + " prior course's grade, term and text fields fit their columns (400 if not). Allowed"
              + " for as long as the recruitment is open. The version is the one the form last"
              + " saw (from opening the draft or from its last save); if the draft has been saved"
              + " since, by another tab or window, nothing is changed and the answer is 409"
              + " Conflict with the draft as it now stands. Refused (400) once they have an"
              + " application to the recruitment that is not cancelled (issue #417). A successful save returns the draft"
              + " with its new version. A save that names its client (X-Client-Id) also tells the server this tab or"
              + " window is working on the draft, for the multi-tab warning; see the heartbeat.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PutMapping("")
  public ResponseEntity<Object> saveDraft(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "version") @RequestParam Integer version,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId,
      @RequestBody ApplicationFields fields) {
    DraftApplication draft = mine(id);
    clientActivityDetector.note(resourceKey(id), clientId, identity());
    if (!applicationAccessService.editable(recruitment(draft.getRecruitmentId()))) {
      throw new ForbiddenException("Applications are closed, so this draft can no longer be saved");
    }
    if (!version.equals(draft.getVersion())) {
      return conflict(draft);
    }
    ApplicationsController.requireCourseworkLengths(fields);
    apply(fields, draft);
    try {
      // Refused (400) if they have submitted an application since, checked in the save's own
      // transaction (issue #417).
      return ResponseEntity.ok(draftApplicationService.save(draft));
    } catch (ObjectOptimisticLockingFailureException e) {
      // Another save got in between reading the draft and writing it.
      return conflict(draftApplicationRepository.findById(id).orElseThrow(() -> e));
    }
  }

  @Operation(
      summary = "Say that this tab or window still has the draft open, and learn who else does",
      description =
          "Changes nothing about the draft, not even its version. Tells the server this client"
              + " (X-Client-Id) is still here, and answers with the other people who have the draft"
              + " open (a label for each, and whether it is the same person in another tab or"
              + " window) and how often to send this. Only the draft's owner may ask, and nothing"
              + " is recorded or told to anyone else.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/heartbeat")
  public Presence heartbeat(
      @Parameter(name = "id") @RequestParam Long id,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    // The owner check comes first and throws, so that nothing below runs for anyone else: they are
    // neither recorded nor told who is working here.
    mine(id);
    return clientActivityDetector.heartbeat(resourceKey(id), clientId, identity());
  }

  @Operation(
      summary = "Say that this tab or window has left the draft",
      description =
          "Sent when a tab or window is closed or moves away from the draft, so that the others"
              + " stop being warned about it at once instead of when its heartbeats stop. It is"
              + " allowed to someone exactly when a heartbeat is: only the draft's owner, and for"
              + " anyone else nothing is recorded. The answer is 204 whether or not the client was"
              + " known.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leave(
      @Parameter(name = "id") @RequestParam Long id,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    // The owner check comes first, as for the heartbeat.
    mine(id);
    clientActivityDetector.leave(resourceKey(id), clientId);
  }

  /** Name-to-level answers as sent, without the null entries and in a stable order. */
  private static Map<String, Integer> levels(Map<String, Integer> sent) {
    Map<String, Integer> levels = new TreeMap<>();
    if (sent != null) {
      sent.forEach(
          (name, level) -> {
            if (level != null) {
              levels.put(name, level);
            }
          });
    }
    return levels;
  }

  /**
   * The rows as the form has them, kept as typed: a half-filled row is still worth keeping. Rows
   * for the same course are collapsed to one (issue #334).
   */
  private static List<PriorCoursework> coursework(List<PriorCourseworkFields> sent) {
    List<PriorCoursework> rows = new ArrayList<>();
    if (sent != null) {
      for (PriorCourseworkFields row : sent) {
        rows.add(
            PriorCoursework.builder()
                .ucsbCourse(row.ucsbCourse())
                .otherSchool(row.otherSchool())
                .courseNumber(row.courseNumber())
                .courseTitle(row.courseTitle())
                .term(row.term())
                .grade(row.grade())
                .build());
      }
    }
    return PriorCoursework.collapse(rows);
  }

  /** Copies the form's fields as they are; never the person or the recruitment. */
  static void apply(ApplicationFields fields, DraftApplication draft) {
    draft.setFirstName(fields.firstName());
    draft.setMiddleName(fields.middleName());
    draft.setLastName(fields.lastName());
    draft.setMajor(fields.major());
    draft.setGpaMajor(fields.gpaMajor());
    draft.setGpaOverall(fields.gpaOverall());
    draft.setFirstQuarter(fields.firstQuarter());
    draft.setYearInProgram(fields.yearInProgram());
    draft.setGraduationDate(fields.graduationDate());
    draft.setPriorCoursework(coursework(fields.priorCoursework()));
    draft.setTopicProficiencies(levels(fields.topicProficiencies()));
    draft.setInterests(levels(fields.interests()));
    draft.setPrevExperience(fields.prevExperience());
    draft.setComments(fields.comments());
    draft.setFirstChoiceCourse(fields.firstChoiceCourse());
    draft.setSecondChoiceCourse(fields.secondChoiceCourse());
    draft.setAvailableForLecturesFirstChoice(fields.availableForLecturesFirstChoice());
    draft.setAvailableForLecturesSecondChoice(fields.availableForLecturesSecondChoice());
    draft.setAvailableForDiscussionFirstChoice(fields.availableForDiscussionFirstChoice());
    draft.setAvailableForDiscussionSecondChoice(fields.availableForDiscussionSecondChoice());
    draft.setAvailabilityCommentsFirstChoice(fields.availabilityCommentsFirstChoice());
    draft.setAvailabilityCommentsSecondChoice(fields.availabilityCommentsSecondChoice());
    draft.setCourseInterests(ApplicationsController.courseInterestsFrom(fields));
    draft.setResidencyStatus(fields.residencyStatus());
    draft.setLanguageExam(fields.languageExam());
    draft.setLanguageExamDatePassed(fields.languageExamDatePassed());
    draft.setClassLevel(fields.classLevel());
    draft.setVideoLink(fields.videoLink());
    draft.setPreviousServiceAsUla(fields.previousServiceAsUla());
    draft.setPermNumber(fields.permNumber());
    draft.setBsMsStudent(fields.bsMsStudent());
    draft.setStudentStatusNextQuarter(fields.studentStatusNextQuarter());
    draft.setWantsTaEligibility(fields.wantsTaEligibility());
    draft.setOtherCampusJob(fields.otherCampusJob());
    draft.setPriorUcsbEmployment(fields.priorUcsbEmployment());
    draft.setEmployeeId(fields.employeeId());
    draft.setI9Appointment(fields.i9Appointment());
    draft.setTrainingCommitment(fields.trainingCommitment());
    draft.setTrainingCommitmentExplanation(fields.trainingCommitmentExplanation());
    draft.setChangingMajor(fields.changingMajor());
    draft.setNoticeVersionId(fields.noticeVersionId());
  }
}
