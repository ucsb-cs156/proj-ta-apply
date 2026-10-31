package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJobFactory;
import edu.ucsb.cs.taapply.models.Quarter;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.RecruitmentAuditService;
import edu.ucsb.cs156.jobs.services.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
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
 * recorded in the recruitment audit trail (issue #139) through {@link RecruitmentAuditService}.
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

    Recruitment recruitment =
        recruitmentRepository.save(
            Recruitment.builder()
                .quarter(quarter)
                .type(type)
                .applicationStatus(ApplicationStatus.CLOSED)
                .tentativeOpeningDate(tentativeOpeningDate)
                .primaryConsiderationDate(primaryConsiderationDate)
                .build());
    recruitmentAuditService.recordCreated(recruitment);

    jobService.runAsJob(populateRecruitmentCoursesJobFactory.create(recruitment));
    return recruitment;
  }

  @Operation(
      summary = "Open or close faculty reviews for a recruitment",
      description =
          "Opening requires a facultyRankingDeadline. The first opening stamps"
              + " facultyReviewOpeningDate; later openings preserve that original date.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @Transactional
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
      recruitment.setFacultyReviewOpeningDate(LocalDate.now());
    }
    recruitment.setReviewStatus(status);
    if ("Open".equals(status)) {
      recruitment.setFacultyRankingDeadline(facultyRankingDeadline);
    }

    recruitmentRepository.save(recruitment);
    recruitmentAuditService.recordChanges(before, recruitment);
    return recruitment;
  }

  @Operation(summary = "Change the faculty ranking deadline for a recruitment")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @Transactional
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
    recruitmentRepository.save(recruitment);
    recruitmentAuditService.recordChanges(before, recruitment);
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
  public Recruitment updateTotalHiringTarget(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "totalHiringTarget") @RequestParam Integer totalHiringTarget) {

    if (totalHiringTarget < 1) {
      throw new IllegalArgumentException("totalHiringTarget must be at least 1");
    }

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    recruitment.setTotalHiringTarget(totalHiringTarget);
    recruitmentRepository.save(recruitment);
    // Every section's fractional share depends on the target (issue #176).
    allocationService.recompute(recruitment);
    return recruitment;
  }

  @Operation(
      summary = "Publish a recruitment's assignments, or take them back",
      description =
          "Publishing opens the read-only assignments page and its CSV downloads to admins and"
              + " faculty (issue #180). Tentative assignments can still be changed afterwards; the"
              + " page always shows the current ones. Recorded in the audit trail. Setting the"
              + " value already stored changes and records nothing.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
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

    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    recruitment.setAssignmentsPublished(published);
    recruitmentRepository.save(recruitment);
    recruitmentAuditService.recordChanges(before, recruitment);
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
              + " applicants were actually able to start. Each close stamps actualClosingDate.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/status")
  public Recruitment updateStatus(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "status") @RequestParam ApplicationStatus status) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, id));

    RecruitmentAuditService.Snapshot before = recruitmentAuditService.snapshot(recruitment);
    LocalDate today = LocalDate.now();
    if (status == ApplicationStatus.OPEN) {
      if (recruitment.getActualOpeningDate() == null) {
        recruitment.setActualOpeningDate(today);
      }
    } else {
      recruitment.setActualClosingDate(today);
    }
    recruitment.setApplicationStatus(status);

    recruitmentRepository.save(recruitment);
    recruitmentAuditService.recordChanges(before, recruitment);
    return recruitment;
  }

  @Operation(
      summary = "How many applications each recruitment has on file",
      description =
          "Recruitment id to the number of real (non-test) applications, for the admin's cards and"
              + " the warning before deleting one (issue #108). Every recruitment is listed, with 0"
              + " for one that has none.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/applicationCounts")
  public Map<Long, Long> applicationCounts() {
    Map<Long, Long> counts = new TreeMap<>();
    for (Recruitment recruitment : recruitmentRepository.findAll()) {
      counts.put(
          recruitment.getId(),
          applicationRepository.countByRecruitmentIdAndTestApplicationFalse(recruitment.getId()));
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

    recruitmentAuditService.recordDeleted(recruitment);
    recruitmentRepository.delete(recruitment);
    return genericMessage("Recruitment with id %s deleted".formatted(id));
  }
}
