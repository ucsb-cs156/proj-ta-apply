package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.models.Quarter;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.AllocationVisibilityService;
import edu.ucsb.cs.taapply.services.ApplicationVisibility;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import edu.ucsb.cs.taapply.services.DeveloperModeService;
import edu.ucsb.cs.taapply.services.HiringDecisions;
import edu.ucsb.cs.taapply.services.RecruitmentAuditService;
import edu.ucsb.cs.taapply.time.AppTime;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin management of recruitments. Every creation, deletion and change of status or dates is
 * recorded in the recruitment audit trail (issue #139) through {@link RecruitmentAuditService},
 * whose methods write the recruitment and its audit rows in one transaction (issue #377).
 */
@Tag(name = "Recruitments")
@RequestMapping("/api/admin/recruitments")
@RestController
@Slf4j
public class RecruitmentsController extends ApiController {

  private static final Set<String> REVIEW_STATUSES = Set.of("NotStarted", "Open", "Closed");

  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired JobService jobService;
  @Autowired PopulateRecruitmentCoursesJobFactory populateRecruitmentCoursesJobFactory;
  @Autowired RecruitmentAuditService recruitmentAuditService;
  @Autowired AllocationService allocationService;
  @Autowired AllocationVisibilityService allocationVisibilityService;
  @Autowired AssignmentsService assignmentsService;
  @Autowired DeveloperModeService developerModeService;

  @Operation(
      summary = "Create a recruitment",
      description =
          "Creating one immediately launches the job that fills its course list, so the list is"
              + " there without a second step. At most one recruitment exists per quarter and type.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public Recruitment postRecruitment(
      @Parameter(name = "quarter", description = "YYYYQ, e.g. 20261") @RequestParam String quarter,
      @Parameter(name = "type") @RequestParam RecruitmentType type,
      @Parameter(name = "tentativeOpeningDate")
          @RequestParam
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate tentativeOpeningDate,
      @Parameter(name = "primaryConsiderationDate")
          @RequestParam
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate primaryConsiderationDate) {

    // Validate before writing; ApiController maps IllegalArgumentException to 400.
    Quarter.yyyyqToInt(quarter);

    if (recruitmentRepository.existsByQuarterAndType(quarter, type)) {
      throw new IllegalArgumentException(
          String.format("A %s recruitment already exists for quarter %s", type, quarter));
    }

    Recruitment.RecruitmentBuilder recruitment =
        Recruitment.builder()
            .quarter(quarter)
            .type(type)
            .applicationStatus(ApplicationStatus.CLOSED)
            .tentativeOpeningDate(tentativeOpeningDate)
            .primaryConsiderationDate(primaryConsiderationDate)
            .createdAt(AppTime.now());
    // The hiring target starts as the one of the same type's recruitment in the most recent
    // earlier quarter, if there is one (issue #384); otherwise the default. Whoever creates the
    // recruitment, the Create Recruitment form or Developer Mode's auto-create, comes through here.
    recruitmentRepository
        .findFirstByQuarterLessThanAndTypeOrderByQuarterDesc(quarter, type)
        .ifPresent(previous -> recruitment.totalHiringTarget(previous.getTotalHiringTarget()));

    // The save and its audit row are one transaction (issue #377).
    Recruitment saved = recruitmentAuditService.saveAndRecordCreated(recruitment.build());

    jobService.runAsJob(populateRecruitmentCoursesJobFactory.create(saved));
    return saved;
  }

  @Operation(
      summary = "Open or close faculty reviews for a recruitment",
      description =
          "Opening requires a facultyRankingDeadline. The first opening stamps"
              + " facultyReviewOpeningDate; later openings preserve that original date.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/reviewStatus")
  public Recruitment updateReviewStatus(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "status") @RequestParam String status,
      @Parameter(name = "facultyRankingDeadline")
          @RequestParam(required = false)
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate facultyRankingDeadline) {

    if (!REVIEW_STATUSES.contains(status)) {
      throw new IllegalArgumentException(
          "reviewStatus must be exactly NotStarted, Open, or Closed");
    }
    if ("Open".equals(status) && facultyRankingDeadline == null) {
      throw new IllegalArgumentException("facultyRankingDeadline is required when opening reviews");
    }

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    boolean statusChanged = !status.equals(recruitment.getReviewStatus());
    boolean openingDateMissing =
        "Open".equals(status) && recruitment.getFacultyReviewOpeningDate() == null;
    boolean deadlineChanged =
        "Open".equals(status)
            && !facultyRankingDeadline.equals(recruitment.getFacultyRankingDeadline());
    if (!statusChanged && !openingDateMissing && !deadlineChanged) {
      return recruitment;
    }

    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    if ("Open".equals(status) && recruitment.getFacultyReviewOpeningDate() == null) {
      recruitment.setFacultyReviewOpeningDate(AppTime.today());
    }
    recruitment.setReviewStatus(status);
    if ("Open".equals(status)) {
      recruitment.setFacultyRankingDeadline(facultyRankingDeadline);
    }
    if ("Closed".equals(status)) {
      recruitment.setFacultyReviewClosedAt(AppTime.now());
    }

    recruitmentAuditService.saveAndRecordChanges(before, recruitment);
    return recruitment;
  }

  @Operation(summary = "Change the faculty ranking deadline for a recruitment")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/facultyRankingDeadline")
  public Recruitment updateFacultyRankingDeadline(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "facultyRankingDeadline")
          @RequestParam
          @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
          LocalDate facultyRankingDeadline) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));
    if (facultyRankingDeadline.equals(recruitment.getFacultyRankingDeadline())) {
      return recruitment;
    }

    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    recruitment.setFacultyRankingDeadline(facultyRankingDeadline);
    recruitmentAuditService.saveAndRecordChanges(before, recruitment);
    return recruitment;
  }

  @Operation(
      summary = "Set how many TAs or ULAs a recruitment expects to hire",
      description =
          "The total the per-course allocations on the Recruitment Courses page should add up to"
              + " (issue #174). Must be at least 1. A planning figure: not recorded in the audit"
              + " trail.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/totalHiringTarget")
  public ResponseEntity<Object> updateTotalHiringTarget(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "totalHiringTarget") @RequestParam Integer totalHiringTarget,
      @Parameter(name = "expected") @RequestParam(required = false) Integer expected) {

    if (totalHiringTarget < 1) {
      throw new IllegalArgumentException("totalHiringTarget must be at least 1");
    }

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    synchronized (COMPARE_AND_SET) {
      if (expected != null && !expected.equals(recruitment.getTotalHiringTarget())) {
        return staleValue(recruitment, "hiring target");
      }
      recruitment.setTotalHiringTarget(totalHiringTarget);
      recruitmentRepository.save(recruitment);
    }
    // Every section's fractional share depends on the target (issue #176).
    allocationService.recompute(recruitment);
    return ResponseEntity.ok(recruitment);
  }

  /**
   * Makes the read, compare and write of a compare-and-set one step as far as this server goes. The
   * app runs as one instance (see the design of issue #270), so that is enough.
   */
  private static final Object COMPARE_AND_SET = new Object();

  /** What a refused compare-and-set tells the page: why, and the recruitment as it now stands. */
  private static ResponseEntity<Object> staleValue(Recruitment current, String what) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("message", "The %s was changed in another tab or window.".formatted(what));
    body.put("recruitment", current);
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
  }

  @Operation(
      summary = "Choose who may see the allocations: admins only, own courses, or all courses",
      description =
          "ADMINS_ONLY (the default): no faculty member sees any allocation. OWN_COURSES: each"
              + " faculty member sees the allocations for the courses they teach. ALL_COURSES:"
              + " every faculty member teaching in the recruitment sees the allocations of all"
              + " its courses (issues #178 and #224). Faculty see the result, so the change is"
              + " recorded in the recruitment audit trail; choosing the current value changes"
              + " nothing. 400 for any other value.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/allocationVisibility")
  public Recruitment updateAllocationVisibility(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "visibility") @RequestParam AllocationVisibility visibility) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));
    return allocationVisibilityService.change(recruitment, visibility);
  }

  @Operation(
      summary = "Publish a recruitment's assignments, or take them back",
      description =
          "Publishing opens the read-only assignments page and its CSV downloads to admins and"
              + " faculty (issue #180). Tentative assignments can still be changed afterwards; the"
              + " page always shows the current ones. Publishing is refused with a 400 naming the"
              + " first step still to do unless faculty ranking is closed, applications are closed"
              + " and at least one candidate is assigned (issue #237); taking them back is never"
              + " refused. Recorded in the audit trail. Setting the value already stored changes"
              + " and records nothing.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  // Transactional so the version bump below joins the transaction of the save and its audit rows.
  @Transactional
  @PutMapping("/assignmentsPublished")
  public Recruitment updateAssignmentsPublished(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "published") @RequestParam boolean published) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    if (Boolean.TRUE.equals(recruitment.getAssignmentsPublished()) == published) {
      return recruitment;
    }

    if (published) {
      String unmet =
          HiringDecisions.unmetPrerequisite(recruitment, assignmentsService.anyAssigned(id));
      if (unmet != null) {
        throw new IllegalArgumentException(unmet);
      }
    }

    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    recruitment.setAssignmentsPublished(published);
    if (published) {
      recruitment.setAssignmentsPublishedAt(AppTime.now());
    }
    recruitmentAuditService.saveAndRecordChanges(before, recruitment);
    recruitmentRepository.bumpAssignmentsVersion(id);
    return recruitment;
  }

  @Operation(summary = "List all recruitments, most recent quarter first")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<Recruitment> allRecruitments() {
    return recruitmentRepository.findAllByOrderByQuarterDescTypeAsc();
  }

  @Operation(
      summary = "Open or close applications for a recruitment",
      description =
          "The first open stamps actualOpeningDate and never overwrites it, so it keeps the date"
              + " applicants were actually able to start. Each close stamps actualClosingDate. Setting the"
              + " status the recruitment already has changes and records nothing, so a click from"
              + " a page that is a few seconds out of date is harmless (issue #281).")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/status")
  public Recruitment updateStatus(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "status") @RequestParam ApplicationStatus status) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    if (recruitment.getApplicationStatus() == status) {
      return recruitment;
    }

    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    LocalDate today = AppTime.today();
    if (status == ApplicationStatus.OPEN) {
      if (recruitment.getActualOpeningDate() == null) {
        recruitment.setActualOpeningDate(today);
      }
    } else {
      recruitment.setActualClosingDate(today);
    }
    recruitment.setApplicationStatus(status);

    recruitmentAuditService.saveAndRecordChanges(before, recruitment);
    return recruitment;
  }

  @Operation(
      summary = "How many applications each recruitment has on file",
      description =
          "Recruitment id to the number of applicants with a real (non-test) application, for the"
              + " admin's cards and the warning before deleting one (issue #108). An applicant who"
              + " cancelled and applied again counts once (issue #318). Every recruitment is"
              + " listed, with 0 for one that has none.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/applicationCounts")
  public Map<Long, Long> applicationCounts() {
    Map<Long, Long> counts = new TreeMap<>();
    boolean developerModeOn = developerModeService.isOn();
    for (Recruitment recruitment : recruitmentRepository.findAll()) {
      counts.put(
          recruitment.getId(),
          applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitment.getId()).stream()
              .filter(application -> ApplicationVisibility.isReal(application, developerModeOn))
              // One per applicant: a cancelled application and the new one that followed it
              // (issue #318) are one person's, not two.
              .map(Application::getEmail)
              .distinct()
              .count());
    }
    return counts;
  }

  @Operation(
      summary = "Delete a recruitment",
      description =
          "Its recruitment courses and every application to it go with it, via the cascading"
              + " foreign keys.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public Object deleteRecruitment(@Parameter(name = "id") @RequestParam Long id) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    recruitmentAuditService.deleteAndRecord(recruitment);
    return genericMessage("Recruitment with id %s deleted".formatted(id));
  }
}
