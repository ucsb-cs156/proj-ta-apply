package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.controller.ApplicationsController.ApplicationFields;
import edu.ucsb.cs.taapply.controller.ApplicationsController.PriorCourseworkFields;
import edu.ucsb.cs.taapply.entity.DraftApplication;
import edu.ucsb.cs.taapply.entity.PriorCoursework;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.DraftApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.ApplicationAccessService;
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
import org.springframework.http.HttpHeaders;
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
  @Autowired ApplicationRepository applicationRepository;
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
              + " for it, since a draft is only for an application not yet submitted.")
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
    if (applicationRepository.existsByEmailAndRecruitmentId(email, recruitmentId)) {
      throw new IllegalArgumentException("You already have an application for this recruitment");
    }
    return draftApplicationRepository
        .findByEmailAndRecruitmentId(email, recruitmentId)
        .orElseGet(() -> createDraft(email, recruitmentId));
  }

  /**
   * A new empty draft. If the same person's form opened twice at once, the second insert breaks the
   * unique constraint; the draft the first one made is the answer.
   */
  private DraftApplication createDraft(String email, Long recruitmentId) {
    try {
      return draftApplicationRepository.save(
          DraftApplication.builder().email(email).recruitmentId(recruitmentId).build());
    } catch (DataIntegrityViolationException e) {
      return draftApplicationRepository
          .findByEmailAndRecruitmentId(email, recruitmentId)
          .orElseThrow(() -> e);
    }
  }

  /**
   * Notes that the client that sent this request is working on the draft, and returns the response
   * headers that tell it whether any other tab or window is too (issue #273). The draft is
   * identified to the detector as {@code draft:<id>}.
   */
  private HttpHeaders activity(Long id, String clientId) {
    HttpHeaders headers = new HttpHeaders();
    headers.setAll(clientActivityDetector.observe("draft:" + id, clientId));
    return headers;
  }

  /** What a refused save tells the form: why, and the draft as it now stands. */
  private ResponseEntity<Object> conflict(DraftApplication current, HttpHeaders headers) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put(
        "message",
        "This draft was changed in another tab or window. Reload to see the latest version.");
    body.put("version", current.getVersion());
    body.put("draft", current);
    return ResponseEntity.status(HttpStatus.CONFLICT).headers(headers).body(body);
  }

  @Operation(
      summary = "Save a draft",
      description =
          "Replaces what the draft holds with what the form has now. Nothing is validated. Allowed"
              + " for as long as the recruitment is open. The version is the one the form last"
              + " saw (from opening the draft or from its last save); if the draft has been saved"
              + " since, by another tab or window, nothing is changed and the answer is 409"
              + " Conflict with the draft as it now stands. A successful save returns the draft"
              + " with its new version. A save that names its client (X-Client-Id) is also answered with"
              + " X-Other-Clients-Active, whether another tab or window has been working on the draft.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PutMapping("")
  public ResponseEntity<Object> saveDraft(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "version") @RequestParam Integer version,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId,
      @RequestBody ApplicationFields fields) {
    DraftApplication draft = mine(id);
    HttpHeaders headers = activity(id, clientId);
    if (!applicationAccessService.editable(recruitment(draft.getRecruitmentId()))) {
      throw new ForbiddenException("Applications are closed, so this draft can no longer be saved");
    }
    if (!version.equals(draft.getVersion())) {
      return conflict(draft, headers);
    }
    apply(fields, draft);
    try {
      return ResponseEntity.ok().headers(headers).body(draftApplicationRepository.save(draft));
    } catch (ObjectOptimisticLockingFailureException e) {
      // Another save got in between reading the draft and writing it.
      return conflict(draftApplicationRepository.findById(id).orElseThrow(() -> e), headers);
    }
  }

  @Operation(
      summary = "Say that this tab or window still has the draft open",
      description =
          "Changes nothing about the draft, not even its version. Tells the server this client"
              + " (X-Client-Id) is still here, so that other tabs or windows on the same draft can"
              + " be warned, and answers with X-Other-Clients-Active, whether any other is, and"
              + " X-Heartbeat-Seconds, how often to send this.")
  @PreAuthorize("hasRole('ROLE_USER')")
  @PostMapping("/heartbeat")
  public ResponseEntity<Void> heartbeat(
      @Parameter(name = "id") @RequestParam Long id,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    mine(id);
    return ResponseEntity.noContent().headers(activity(id, clientId)).build();
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

  /** The rows as the form has them, kept as typed: a half-filled row is still worth keeping. */
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
    return rows;
  }

  /** Copies the form's fields as they are; never the person or the recruitment. */
  static void apply(ApplicationFields fields, DraftApplication draft) {
    draft.setFirstName(fields.firstName());
    draft.setMiddleName(fields.middleName());
    draft.setLastName(fields.lastName());
    draft.setMajor(fields.major());
    draft.setGpaMajor(fields.gpaMajor());
    draft.setGpaOverall(fields.gpaOverall());
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
