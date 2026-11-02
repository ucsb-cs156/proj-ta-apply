package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.concurrency.ClientActivityDetector;
import edu.ucsb.cs.taapply.concurrency.ClientIdentity;
import edu.ucsb.cs.taapply.concurrency.ConcurrencyHeaders;
import edu.ucsb.cs.taapply.concurrency.Presence;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.entity.User;
import edu.ucsb.cs.taapply.enums.EnrollmentEstimateSource;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.jobs.PopulateRecruitmentCoursesJob;
import edu.ucsb.cs.taapply.models.UcsbCourseOffering;
import edu.ucsb.cs.taapply.models.UcsbSection;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AllocationService;
import edu.ucsb.cs.taapply.services.RecruitmentCoursesRefreshService;
import edu.ucsb.cs.taapply.services.UCSBCurriculumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The course list for one recruitment. */
@Tag(name = "RecruitmentCourses")
@RequestMapping("/api/recruitmentcourses")
@RestController
@Slf4j
public class RecruitmentCoursesController extends ApiController {

  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired UCSBCurriculumService ucsbCurriculumService;
  @Autowired RecruitmentCoursesRefreshService recruitmentCoursesRefreshService;
  @Autowired AllocationService allocationService;
  @Autowired ClientActivityDetector clientActivityDetector;

  /**
   * Who the current user is to the detector (issue #278): the email address is the person, and the
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

  /** The detector's name for one recruitment's Courses edit page. */
  private static String resourceKey(Long recruitmentId) {
    return "courses-edit:" + recruitmentId;
  }

  /** The recruitment, or 404; asked before anything is recorded or told to anyone. */
  private Recruitment recruitment(Long recruitmentId) {
    return recruitmentRepository
        .findById(recruitmentId)
        .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
  }

  @Operation(
      summary =
          "Say that this tab or window has the Courses edit page open, and learn who else does",
      description =
          "Changes nothing about the courses. Tells the server this client (X-Client-Id) is still"
              + " here, and answers with the other people who have the same recruitment's edit page"
              + " open (a label for each, and whether it is the same person in another tab or"
              + " window), how often to send this, and whether this client came last. Only admins"
              + " may ask, and nothing is recorded or told to anyone else. 404 for an unknown"
              + " recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/heartbeat")
  public Presence heartbeat(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    // The role check has already passed, so that nobody else is recorded or told who is here.
    recruitment(recruitmentId);
    return clientActivityDetector.heartbeat(resourceKey(recruitmentId), clientId, identity());
  }

  @Operation(
      summary = "Say that this tab or window has left the Courses edit page",
      description =
          "Sent when a tab or window is closed or moves away from the edit page, so that the others"
              + " stop being warned about it at once. Allowed to exactly those who may send a"
              + " heartbeat. The answer is 204 whether or not the client was known.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/leave")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leave(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {
    clientActivityDetector.leave(resourceKey(recruitmentId), clientId);
  }

  /**
   * Course id first, then section, so a course's several lectures sit together in order.
   *
   * <p>Sorted here rather than with an ORDER BY: the padded course id only orders correctly under
   * code-unit comparison, and Postgres' default collation can treat spaces as negligible, which
   * would pass on H2 and reorder wrongly in production.
   */
  private static final Comparator<RecruitmentCourse> BY_COURSE_THEN_SECTION =
      Comparator.comparing(RecruitmentCourse::getCourseId)
          .thenComparing(
              RecruitmentCourse::getSection, Comparator.nullsFirst(Comparator.naturalOrder()));

  @Operation(
      summary = "List the courses for a recruitment",
      description =
          "Removed courses are hidden by default. Pass includeRemoved=true to see them as well,"
              + " which is useful for checking what an earlier Populate left out.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<RecruitmentCourse> allForRecruitment(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "includeRemoved") @RequestParam(defaultValue = "false")
          boolean includeRemoved) {

    return recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
        .filter(course -> includeRemoved || !course.isRemoved())
        .sorted(BY_COURSE_THEN_SECTION)
        .toList();
  }

  @Operation(
      summary = "Add one lecture to a recruitment by its enroll code",
      description =
          "Looks the section up in the UCSB API for the recruitment's quarter and adds it as a row,"
              + " flagged or not in Admin/Courses (issue #125). 404 for an unknown recruitment; 400"
              + " for an enroll code the API does not know in that quarter, or one that is a"
              + " discussion or lab rather than a lecture. A row that already exists is refreshed,"
              + " and put back if it had been removed.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/post")
  public RecruitmentCourse addByEnrollCode(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "enrollCode", description = "e.g. 07492") @RequestParam String enrollCode) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    String code = enrollCode.strip();

    UcsbCourseOffering offering;
    try {
      offering = ucsbCurriculumService.getOffering(recruitment.getQuarter(), code);
    } catch (Exception e) {
      log.warn("Lookup of enroll code {} in {} failed", code, recruitment.getQuarter(), e);
      throw new IllegalArgumentException(
          "The UCSB API has no section with enroll code %s in quarter %s"
              .formatted(code, recruitment.getQuarter()));
    }
    UcsbSection section =
        (offering == null || offering.getClassSections() == null
                ? List.<UcsbSection>of()
                : offering.getClassSections())
            .stream()
                .filter(s -> code.equals(s.getEnrollCode()))
                .findFirst()
                .orElseThrow(
                    () ->
                        new IllegalArgumentException(
                            "The UCSB API has no section with enroll code %s in quarter %s"
                                .formatted(code, recruitment.getQuarter())));
    if (!section.isPrimary()) {
      throw new IllegalArgumentException(
          "Enroll code %s is section %s, a discussion or lab; only lectures (section numbers"
                  .formatted(code, section.getSection())
              + " ending in 00) can be added");
    }

    String courseId = UCSBCurriculumService.normalizeCourseId(offering.getCourseId());
    RecruitmentCourse row =
        recruitmentCourseRepository
            .findByRecruitmentIdAndEnrollCode(recruitmentId, code)
            .orElseGet(() -> RecruitmentCourse.builder().build());
    PopulateRecruitmentCoursesJob.applyOffering(row, recruitmentId, courseId, offering, section);
    row.setManuallyAdded(true);
    row.setRemoved(false);
    row.setStale(false);
    recruitmentCourseRepository.save(row);
    return row;
  }

  @Operation(
      summary = "Remove a course from a recruitment, or put it back",
      description =
          "Flags the row rather than deleting it, for two reasons: a later Populate must not add a"
              + " removed course straight back, and a removal made by mistake has to be reversible."
              + " Idempotent in both directions.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/removed")
  public RecruitmentCourse setRemoved(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "removed") @RequestParam boolean removed) {

    RecruitmentCourse course =
        recruitmentCourseRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(RecruitmentCourse.class, id));

    course.setRemoved(removed);
    recruitmentCourseRepository.save(course);
    // A removed section leaves the total of the estimates, so every share changes (issue #176).
    allocationService.recompute(recruitmentOf(course));
    return course;
  }

  /** The recruitment a row belongs to; the row's foreign key makes it exist. */
  private Recruitment recruitmentOf(RecruitmentCourse course) {
    return recruitmentRepository
        .findById(course.getRecruitmentId())
        .orElseThrow(
            () -> new EntityNotFoundException(Recruitment.class, course.getRecruitmentId()));
  }

  @Operation(
      summary = "Set how many TAs or ULAs are allocated to one section",
      description =
          "The per-course share of the recruitment's total hiring target (issue #174). Must not be"
              + " negative. A planning figure: not recorded in the audit trail.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/allocation")
  public ResponseEntity<Object> setAllocation(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "allocation") @RequestParam Integer allocation,
      @Parameter(name = "expectedVersion", description = "the row's allocationVersion as seen")
          @RequestParam(required = false)
          Integer expectedVersion,
      @Parameter(
              name = "expectedBulkVersion",
              description = "the recruitment's allocationBulkVersion as seen")
          @RequestParam(required = false)
          Integer expectedBulkVersion,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {

    if (allocation < 0) {
      throw new IllegalArgumentException("allocation must not be negative");
    }

    RecruitmentCourse course =
        recruitmentCourseRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(RecruitmentCourse.class, id));
    clientActivityDetector.note(resourceKey(course.getRecruitmentId()), clientId, identity());
    // Only an edit that carries the bulk count needs the recruitment to check it against.
    Recruitment recruitment = expectedBulkVersion == null ? null : recruitmentOf(course);

    boolean bulkMoved =
        recruitment != null && !expectedBulkVersion.equals(recruitment.getAllocationBulkVersion());
    boolean rowMoved =
        expectedVersion != null && !expectedVersion.equals(course.getAllocationVersion());
    if (bulkMoved || rowMoved) {
      Map<String, Object> body = new LinkedHashMap<>();
      body.put(
          "message",
          bulkMoved
              ? "All the allocations were changed in another tab or window. Reload to see them."
              : "This allocation was changed in another tab or window. Reload to see it.");
      body.put("reloadAll", bulkMoved);
      body.put(
          "allocationBulkVersion",
          recruitment == null ? null : recruitment.getAllocationBulkVersion());
      body.put("course", course);
      return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    course.setAllocation(allocation);
    course.setAllocationVersion(course.getAllocationVersion() + 1);
    recruitmentCourseRepository.save(course);
    return ResponseEntity.ok(course);
  }

  @Operation(
      summary = "Refresh a recruitment's courses from the UCSB API, now",
      description =
          "Rewrites the offering details (enrollment, max enrollment, instructor, times) of every"
              + " course still in the API, while the caller waits, and returns the current list"
              + " without removed rows (issue #175). Unlike Populate it adds no rows and marks"
              + " nothing stale. 404 for an unknown recruitment; 502 if the API cannot be reached,"
              + " in which case nothing is changed.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/refresh")
  public List<RecruitmentCourse> refresh(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId) {

    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));

    int refreshed = recruitmentCoursesRefreshService.refresh(recruitment);
    log.info("Refreshed {} course(s) of recruitment {}", refreshed, recruitmentId);
    // Also fills in the share of any row Populate has added since the last change (issue #176).
    allocationService.recompute(recruitment);
    return allForRecruitment(recruitmentId, false);
  }

  @Operation(
      summary = "Set one section's enrollment estimate",
      description =
          "The admin's estimate of how many students the section will have, the basis for"
              + " allocating positions (issue #175). Must not be negative; leave the value out to"
              + " clear it. A planning figure: not recorded in the audit trail.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/enrollmentEstimate")
  public RecruitmentCourse setEnrollmentEstimate(
      @Parameter(name = "id") @RequestParam Long id,
      @Parameter(name = "enrollmentEstimate") @RequestParam(required = false)
          Integer enrollmentEstimate,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {

    if (enrollmentEstimate != null && enrollmentEstimate < 0) {
      throw new IllegalArgumentException("enrollmentEstimate must not be negative");
    }

    RecruitmentCourse course =
        recruitmentCourseRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(RecruitmentCourse.class, id));

    clientActivityDetector.note(resourceKey(course.getRecruitmentId()), clientId, identity());
    course.setEnrollmentEstimate(enrollmentEstimate);
    recruitmentCourseRepository.save(course);
    allocationService.recompute(recruitmentOf(course));
    return course;
  }

  @Operation(
      summary = "Fill every section's enrollment estimate from the API's max or actual figure",
      description =
          "Copies maxEnroll (source=MAX) or enrollment (source=ACTUAL) into the enrollment"
              + " estimate of every non-removed row of the recruitment in one step (issue #175). A"
              + " row whose source figure is null keeps its estimate. Returns the current list"
              + " without removed rows. 404 for an unknown recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/enrollmentEstimates")
  public List<RecruitmentCourse> setEnrollmentEstimates(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @Parameter(name = "source") @RequestParam EnrollmentEstimateSource source,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {

    Recruitment recruitment = recruitment(recruitmentId);
    clientActivityDetector.note(resourceKey(recruitmentId), clientId, identity());

    for (RecruitmentCourse row : recruitmentCourseRepository.findByRecruitmentId(recruitmentId)) {
      if (row.isRemoved()) {
        continue;
      }
      Integer value =
          source == EnrollmentEstimateSource.MAX ? row.getMaxEnroll() : row.getEnrollment();
      if (value != null) {
        row.setEnrollmentEstimate(value);
        recruitmentCourseRepository.save(row);
      }
    }
    allocationService.recompute(recruitment);
    return allForRecruitment(recruitmentId, false);
  }

  @Operation(
      summary = "Allocate the hiring target across the sections by enrollment estimate",
      description =
          "Overwrites every non-removed section's allocation with a first cut at the"
              + " recruitment's total hiring target, shared out by enrollment estimate (issue"
              + " #176): each section's fractional share rounded, then adjusted one at a time"
              + " (the section furthest above its share loses one, or furthest below gains one)"
              + " until the total is exactly the target. Returns the current list without removed"
              + " rows. 404 for an unknown recruitment.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PostMapping("/autoAllocate")
  public List<RecruitmentCourse> autoAllocate(
      @Parameter(name = "recruitmentId") @RequestParam Long recruitmentId,
      @RequestHeader(value = ConcurrencyHeaders.CLIENT_ID, required = false) String clientId) {

    Recruitment recruitment = recruitment(recruitmentId);
    clientActivityDetector.note(resourceKey(recruitmentId), clientId, identity());

    allocationService.autoAllocate(recruitment);
    // Every allocation has moved, so edits made against the old numbers must be refused.
    recruitment.setAllocationBulkVersion(recruitment.getAllocationBulkVersion() + 1);
    recruitmentRepository.save(recruitment);
    return allForRecruitment(recruitmentId, false);
  }
}
