package edu.ucsb.cs.taapply.controller;

import com.fasterxml.jackson.databind.JsonNode;
import edu.ucsb.cs.taapply.entity.Application;
import edu.ucsb.cs.taapply.entity.CandidateRanking;
import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.AllocationVisibility;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.ApplicationRepository;
import edu.ucsb.cs.taapply.repository.CandidateRankingRepository;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import edu.ucsb.cs.taapply.services.AssignmentsService;
import edu.ucsb.cs.taapply.services.CourseTargetsService;
import edu.ucsb.cs.taapply.services.CourseTargetsService.CourseTargets;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * What an instructor sees on the home page (issue #127): the recruitments that include a course
 * they teach, each with its list of their courses.
 *
 * <p>The match goes through the catalog: an instructor's email maps to the name the course catalog
 * uses for them (issue #120, set by an admin), and each recruitment course row records the catalog
 * name of its instructor of record. An instructor with no catalog name yet matches nothing.
 */
@Tag(name = "InstructorRecruitments")
@RequestMapping("/api/instructor/recruitments")
@RestController
@Slf4j
public class InstructorRecruitmentsController extends ApiController {

  @Autowired InstructorRepository instructorRepository;
  @Autowired RecruitmentRepository recruitmentRepository;
  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;
  @Autowired ApplicationRepository applicationRepository;
  @Autowired CandidateRankingRepository candidateRankingRepository;
  @Autowired CourseTargetsService courseTargetsService;

  /**
   * A recruitment as the admin's and student's cards know it, plus the instructor's courses.
   *
   * <p>A course's allocation reaches its instructor only once the admin has released it, or has
   * chosen to show all allocations to all faculty (issues #178 and #224). A course not yet released
   * goes out as a copy with its allocation, enrollment estimate and unrounded allocation blanked,
   * so the numbers never leave the server, and has no entry in {@code targets}; a released course
   * goes out as stored and {@code targets} holds its {@link CourseTargets} under its course id.
   * {@code targets} is null when no course is released.
   */
  public static record InstructorRecruitment(
      Long id,
      String quarter,
      RecruitmentType type,
      ApplicationStatus applicationStatus,
      LocalDate tentativeOpeningDate,
      LocalDate primaryConsiderationDate,
      LocalDate actualOpeningDate,
      LocalDate actualClosingDate,
      String reviewStatus,
      LocalDate facultyReviewOpeningDate,
      LocalDate facultyRankingDeadline,
      List<RecruitmentCourse> courses,
      Map<Long, CourseTargets> targets) {
    /** The recruitment with its targets withheld (or not yet computed). */
    public static InstructorRecruitment of(Recruitment r, List<RecruitmentCourse> courses) {
      return of(r, courses, null);
    }

    public static InstructorRecruitment of(
        Recruitment r, List<RecruitmentCourse> courses, Map<Long, CourseTargets> targets) {
      List<RecruitmentCourse> shown =
          courses.stream()
              .map(
                  course ->
                      allocationsVisible(r)
                          ? course
                          : InstructorRecruitment.withoutAllocation(course))
              .toList();
      return new InstructorRecruitment(
          r.getId(),
          r.getQuarter(),
          r.getType(),
          r.getApplicationStatus(),
          r.getTentativeOpeningDate(),
          r.getPrimaryConsiderationDate(),
          r.getActualOpeningDate(),
          r.getActualClosingDate(),
          r.getReviewStatus(),
          r.getFacultyReviewOpeningDate(),
          r.getFacultyRankingDeadline(),
          shown,
          targets);
    }

    /** The row with the planning figures an instructor may not see yet blanked. */
    static RecruitmentCourse withoutAllocation(RecruitmentCourse row) {
      return row.toBuilder()
          .allocation(null)
          .enrollmentEstimate(null)
          .unroundedAllocation(null)
          .build();
    }
  }

  /**
   * Whether this recruitment's allocations may reach the faculty who teach in it (issue #224):
   * every state except ADMINS_ONLY. The instructor endpoints only ever return the signed-in
   * instructor's own courses, so OWN_COURSES and ALL_COURSES differ only in the all-allocations
   * view.
   */
  static boolean allocationsVisible(Recruitment r) {
    return r.getAllocationVisibility() != AllocationVisibility.ADMINS_ONLY;
  }

  /** One row of the all-allocations view faculty get once the admin shows them (issue #224). */
  public static record AllocationRow(
      Long id, String courseId, String section, String instructor, Integer allocation) {
    static AllocationRow of(RecruitmentCourse course) {
      return new AllocationRow(
          course.getId(),
          course.getCourseId(),
          course.getSection(),
          course.getInstructor(),
          course.getAllocation());
    }
  }

  /**
   * Course-scoped metadata shared by rankings and the read-only application page. {@code
   * allocation} is how many TAs or ULAs the course was allocated: present for admins, and for
   * instructors only once the admin shows allocations to faculty (issue #178); otherwise null.
   * {@code canRank} is whether this user may enter rankings here: the course's instructor of record
   * while reviews are Open, whether or not they are also an admin (issue #202). {@code targets} is
   * the course's hiring figures (issue #224), present on the same terms as {@code allocation}.
   * {@code hasRankedNotInterested} is whether any real, non-cancelled applicant who did not express
   * interest in the course has a ranking for it (issue #221): the page then always shows that tier.
   */
  public static record CandidateRankingPage(
      Long recruitmentId,
      String quarter,
      RecruitmentType type,
      LocalDate tentativeOpeningDate,
      LocalDate primaryConsiderationDate,
      LocalDate actualOpeningDate,
      LocalDate actualClosingDate,
      String reviewStatus,
      LocalDate facultyReviewOpeningDate,
      LocalDate facultyRankingDeadline,
      CourseDetails course,
      List<CourseDetails> otherCourses,
      Integer allocation,
      boolean canRank,
      CourseTargets targets,
      boolean hasRankedNotInterested) {}

  /** Course identity and catalog display fields; section rows remain distinct by id. */
  public static record CourseDetails(
      Long id, String courseId, String section, String title, String instructor) {
    public static CourseDetails of(RecruitmentCourse course) {
      return new CourseDetails(
          course.getId(),
          course.getCourseId(),
          course.getSection(),
          course.getTitle(),
          course.getInstructor());
    }
  }

  /** Read-only admin metadata for the course table and faculty reminders. */
  public static record AdminCourseRankingSummary(
      Long recruitmentCourseId, long rankingCount, String instructorEmail) {}

  /** Newest quarter first, TA before ULA within a quarter: the order the other lists use. */
  private static final Comparator<Recruitment> NEWEST_FIRST =
      Comparator.comparing(Recruitment::getQuarter).reversed().thenComparing(Recruitment::getType);

  /** Course id first, then section, so a course's several lectures sit together in order. */
  private static final Comparator<RecruitmentCourse> BY_COURSE_THEN_SECTION =
      Comparator.comparing(RecruitmentCourse::getCourseId)
          .thenComparing(
              RecruitmentCourse::getSection, Comparator.nullsFirst(Comparator.naturalOrder()));

  @Operation(
      summary = "The recruitments that include a course this instructor teaches",
      description =
          "Each carries the instructor's courses in it, course id then section. The instructor is"
              + " matched by the catalog name an admin assigned to the email; an email that is not"
              + " an instructor, or has no catalog name yet, gets an empty list. Removed courses"
              + " do not count.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("")
  public List<InstructorRecruitment> forInstructor(
      @Parameter(name = "email") @RequestParam String email) {

    String catalogName =
        instructorRepository.findByEmail(email).map(Instructor::getCatalogName).orElse(null);
    if (catalogName == null) {
      return List.of();
    }

    Map<Long, List<RecruitmentCourse>> byRecruitment =
        recruitmentCourseRepository.findByInstructor(catalogName).stream()
            .filter(row -> !row.isRemoved())
            .collect(Collectors.groupingBy(RecruitmentCourse::getRecruitmentId));
    if (byRecruitment.isEmpty()) {
      return List.of();
    }

    return StreamSupport.stream(
            recruitmentRepository.findAllById(byRecruitment.keySet()).spliterator(), false)
        .sorted(NEWEST_FIRST)
        .map(
            r -> {
              List<RecruitmentCourse> courses =
                  byRecruitment.get(r.getId()).stream().sorted(BY_COURSE_THEN_SECTION).toList();
              // The hiring figures leave the server only once the admin lets faculty see them.
              Map<Long, CourseTargets> targets =
                  allocationsVisible(r)
                      ? courseTargetsService.targetsFor(r.getId(), courses)
                      : null;
              return InstructorRecruitment.of(r, courses, targets);
            })
        .toList();
  }

  /**
   * Read-only candidate-ranking page metadata. Instructor access is derived from the authenticated
   * user's email and admin-managed catalog-name mapping; no caller-supplied identity is trusted.
   */
  @Operation(
      summary = "Get the course-scoped candidate ranking page",
      description =
          "Instructors may read only their own active recruitment courses. Admins may read any course.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/ranking")
  public CandidateRankingPage candidateRankingPage(
      @PathVariable Long recruitmentId, @PathVariable Long recruitmentCourseId) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    Recruitment recruitment = scope.recruitment();
    RecruitmentCourse course = scope.course();
    String catalogName = scope.catalogName();
    List<CourseDetails> otherCourses =
        catalogName == null
            ? List.of()
            : recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
                .filter(row -> !row.getId().equals(recruitmentCourseId))
                .filter(row -> catalogName.equals(row.getInstructor()))
                .filter(RecruitmentCourse::isOnOffer)
                .sorted(BY_COURSE_THEN_SECTION)
                .map(CourseDetails::of)
                .toList();

    return new CandidateRankingPage(
        recruitment.getId(),
        recruitment.getQuarter(),
        recruitment.getType(),
        recruitment.getTentativeOpeningDate(),
        recruitment.getPrimaryConsiderationDate(),
        recruitment.getActualOpeningDate(),
        recruitment.getActualClosingDate(),
        recruitment.getReviewStatus(),
        recruitment.getFacultyReviewOpeningDate(),
        recruitment.getFacultyRankingDeadline(),
        CourseDetails.of(course),
        otherCourses,
        scope.isAdmin() || allocationsVisible(recruitment) ? course.getAllocation() : null,
        scope.canRank(),
        scope.isAdmin() || allocationsVisible(recruitment)
            ? courseTargetsService.targetsFor(recruitmentId, course)
            : null,
        hasRankedNotInterested(recruitmentId, course));
  }

  /**
   * Whether an applicant who did not express interest in the course (and is real and not cancelled)
   * has a ranking for it, so the ranking page cannot hide that tier (issue #221).
   */
  private boolean hasRankedNotInterested(Long recruitmentId, RecruitmentCourse course) {
    Set<Long> rankedIds =
        candidateRankingRepository.findByRecruitmentCourseId(course.getId()).stream()
            .filter(ranking -> ranking.getRank() != null)
            .map(CandidateRanking::getApplicationId)
            .collect(Collectors.toSet());
    return eligible(
            applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId), course, true)
        .stream()
        .anyMatch(
            application ->
                preference(application, course.getCourseId()) == null
                    && rankedIds.contains(application.getId()));
  }

  @Operation(
      summary = "Every course's allocation, for faculty, once the admin shows them all",
      description =
          "The recruitment's non-removed sections with their instructor and allocation (issue"
              + " #224). Admins may always read it; instructors only while the admin shows all"
              + " allocations to all faculty, otherwise 403.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/allocations")
  public List<AllocationRow> allocations(@PathVariable Long recruitmentId) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    if (!isAdmin() && recruitment.getAllocationVisibility() != AllocationVisibility.ALL_COURSES) {
      throw new ForbiddenException(
          "The admin has not chosen to show this recruitment's allocations to all faculty.");
    }
    return recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
        .filter(course -> !course.isRemoved())
        .sorted(BY_COURSE_THEN_SECTION)
        .map(AllocationRow::of)
        .toList();
  }

  /** Whether the signed-in user holds the admin role. */
  private boolean isAdmin() {
    CurrentUser currentUser = getCurrentUser();
    return currentUser != null
        && currentUser.getRoles() != null
        && currentUser.getRoles().stream()
            .map(GrantedAuthority::getAuthority)
            .anyMatch("ROLE_ADMIN"::equals);
  }

  /**
   * Ranking counts and catalog-name email mappings for the rows visible on one recruitment's
   * Courses page. Counts use the same eligibility rules as the instructor ranking table.
   */
  @Operation(summary = "Get admin ranking counts and mapped instructor emails for a recruitment")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/admin-course-rankings")
  public List<AdminCourseRankingSummary> adminCourseRankingSummaries(
      @PathVariable Long recruitmentId,
      @Parameter(name = "includeRemoved") @RequestParam(defaultValue = "false")
          boolean includeRemoved) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    List<Application> applications =
        applicationRepository.findByRecruitmentIdOrderByIdAsc(recruitmentId).stream()
            .filter(application -> recruitmentId.equals(application.getRecruitmentId()))
            .toList();
    Map<String, List<String>> emailsByCatalogName =
        StreamSupport.stream(instructorRepository.findAll().spliterator(), false)
            .filter(instructor -> instructor.getCatalogName() != null)
            .collect(
                Collectors.groupingBy(
                    Instructor::getCatalogName,
                    Collectors.mapping(Instructor::getEmail, Collectors.toList())));

    return recruitmentCourseRepository.findByRecruitmentId(recruitmentId).stream()
        .filter(course -> recruitmentId.equals(course.getRecruitmentId()))
        .filter(course -> includeRemoved || !course.isRemoved())
        .sorted(BY_COURSE_THEN_SECTION)
        .map(
            course -> {
              Set<Long> eligibleApplicationIds =
                  eligible(applications, course, true).stream()
                      .map(Application::getId)
                      .collect(Collectors.toSet());
              long rankingCount =
                  candidateRankingRepository.findByRecruitmentCourseId(course.getId()).stream()
                      .filter(ranking -> ranking.getRank() != null)
                      .filter(
                          ranking -> eligibleApplicationIds.contains(ranking.getApplicationId()))
                      .count();
              List<String> mappedEmails = emailsByCatalogName.get(course.getInstructor());
              String instructorEmail =
                  mappedEmails != null && mappedEmails.size() == 1 ? mappedEmails.get(0) : null;
              return new AdminCourseRankingSummary(course.getId(), rankingCount, instructorEmail);
            })
        .toList();
  }

  /**
   * Who is looking at a course's rankings and what they may do. {@code isInstructor} is whether the
   * user's catalog name is the course's instructor of record; that, not the absence of the admin
   * role, is what allows ranking (issue #202): an admin who also teaches the course ranks it like
   * any other instructor, while an admin who does not sees it read-only.
   */
  private record RankingScope(
      Recruitment recruitment,
      RecruitmentCourse course,
      String catalogName,
      boolean isAdmin,
      boolean isInstructor) {
    boolean canRank() {
      return isInstructor && "Open".equals(recruitment.getReviewStatus());
    }
  }

  private RankingScope rankingScope(Long recruitmentId, Long recruitmentCourseId, boolean editing) {
    Recruitment recruitment =
        recruitmentRepository
            .findById(recruitmentId)
            .orElseThrow(() -> new EntityNotFoundException(Recruitment.class, recruitmentId));
    RecruitmentCourse course =
        recruitmentCourseRepository
            .findById(recruitmentCourseId)
            .orElseThrow(
                () -> new EntityNotFoundException(RecruitmentCourse.class, recruitmentCourseId));

    if (!recruitmentId.equals(course.getRecruitmentId())) {
      throw new IllegalArgumentException(
          "Recruitment course %s does not belong to recruitment %s"
              .formatted(recruitmentCourseId, recruitmentId));
    }
    CurrentUser currentUser = getCurrentUser();
    if (currentUser == null || currentUser.getUser() == null) {
      throw new ForbiddenException("The authenticated user could not be identified.");
    }
    String email = currentUser.getUser().getEmail();
    boolean isAdmin =
        currentUser.getRoles() != null
            && currentUser.getRoles().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);

    // Admins may inspect historical rankings for stale, cancelled, or removed rows, but those
    // rows remain unavailable to instructors and this read exception never grants edit access.
    if (!course.isOnOffer() && !isAdmin) {
      throw new ForbiddenException(
          "This recruitment course has been removed or is no longer available.");
    }
    if ("NotStarted".equals(recruitment.getReviewStatus())) {
      throw new ForbiddenException(
          "Candidate rankings are unavailable because faculty reviews have not started.");
    }

    String catalogName =
        instructorRepository.findByEmail(email).map(Instructor::getCatalogName).orElse(null);
    boolean isInstructor = catalogName != null && catalogName.equals(course.getInstructor());
    if (!isAdmin && !isInstructor) {
      throw new ForbiddenException(
          "This recruitment course is not assigned to the authenticated instructor.");
    }
    RankingScope scope = new RankingScope(recruitment, course, catalogName, isAdmin, isInstructor);
    if (editing && !scope.canRank()) {
      throw new ForbiddenException(
          "Only assigned instructors may rank candidates while reviews are Open.");
    }
    return scope;
  }

  public static record Candidate(
      Long applicationId,
      Integer rank,
      String preference,
      String firstName,
      String lastName,
      String email,
      String major,
      String classLevel,
      String yearInProgram,
      String graduationDate,
      Double gpaMajor,
      Double gpaOverall,
      Integer previousServiceAsUla,
      String videoLink) {}

  public static record RankEdit(Integer rank) {}

  static String preference(Application application, String courseId) {
    return AssignmentsService.preference(application, courseId);
  }

  /**
   * The applications a section may rank: real (not test) applications the applicant has not
   * cancelled (issue #199), and, unless {@code includeNotInterested}, only those that expressed
   * some interest in the course.
   */
  private List<Application> eligible(RankingScope scope, boolean includeNotInterested) {
    return eligible(
        applicationRepository.findByRecruitmentIdOrderByIdAsc(scope.recruitment().getId()),
        scope.course(),
        includeNotInterested);
  }

  private List<Application> eligible(
      List<Application> applications, RecruitmentCourse course, boolean includeNotInterested) {
    return AssignmentsService.real(applications).stream()
        .filter(
            application ->
                includeNotInterested || preference(application, course.getCourseId()) != null)
        .toList();
  }

  @Operation(
      summary = "The candidates a section may rank",
      description =
          "Real applications the applicant has not cancelled. By default only applicants who"
              + " expressed interest in the course (first or second choice, Enthusiastic or Would"
              + " Consider); includeNotInterested=true adds the rest, with the preference \"Not"
              + " Interested\" (issue #199).")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/candidates")
  public List<Candidate> candidates(
      @PathVariable Long recruitmentId,
      @PathVariable Long recruitmentCourseId,
      @Parameter(name = "includeNotInterested") @RequestParam(defaultValue = "false")
          boolean includeNotInterested) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    Map<Long, Integer> ranks = new HashMap<>();
    candidateRankingRepository
        .findByRecruitmentCourseId(recruitmentCourseId)
        .forEach(row -> ranks.put(row.getApplicationId(), row.getRank()));
    return eligible(scope, includeNotInterested).stream()
        .map(
            application ->
                new Candidate(
                    application.getId(),
                    ranks.get(application.getId()),
                    preferenceLabel(application, scope.course().getCourseId()),
                    application.getFirstName(),
                    application.getLastName(),
                    application.getEmail(),
                    application.getMajor(),
                    application.getClassLevel() == null ? null : application.getClassLevel().name(),
                    application.getYearInProgram(),
                    application.getGraduationDate(),
                    application.getGpaMajor(),
                    application.getGpaOverall(),
                    application.getPreviousServiceAsUla(),
                    application.getVideoLink()))
        .toList();
  }

  /**
   * The preference as shown: "Not Interested" rather than null for an applicant who marked none.
   */
  private static String preferenceLabel(Application application, String courseId) {
    String preference = preference(application, courseId);
    return preference == null ? AssignmentsService.NOT_INTERESTED : preference;
  }

  @Operation(
      summary = "The recruitment's cancelled applications, as the ranking page lists them",
      description =
          "Name, email and the applicant's reason, so faculty can see what became of an applicant"
              + " they expected among the candidates (issue #199). Same access rules as the"
              + " candidates.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/cancelled")
  public List<AssignmentsService.CancelledApplication> cancelled(
      @PathVariable Long recruitmentId, @PathVariable Long recruitmentCourseId) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    return AssignmentsService.cancelled(
        applicationRepository.findByRecruitmentIdOrderByIdAsc(scope.recruitment().getId()));
  }

  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @PutMapping("/{recruitmentId}/courses/{recruitmentCourseId}/candidates/{applicationId}/rank")
  public RankEdit rank(
      @PathVariable Long recruitmentId,
      @PathVariable Long recruitmentCourseId,
      @PathVariable Long applicationId,
      @RequestBody JsonNode body) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, true);
    // Anyone the instructor can list, with or without the not-interested box ticked, can be ranked.
    List<Application> applications = eligible(scope, true);
    requireCandidate(applications, applicationId);
    JsonNode value = body.get("rank");
    if (value == null
        || (!value.isNull() && (!value.isIntegralNumber() || !value.canConvertToInt()))) {
      throw new IllegalArgumentException("Rank must be an integer or null.");
    }
    RankEdit edit = new RankEdit(value.isNull() ? null : value.intValue());
    if (edit.rank() != null && (edit.rank() < 1 || edit.rank() > applications.size())) {
      throw new IllegalArgumentException(
          "Rank must be an integer from 1 through " + applications.size() + ", or null.");
    }
    CandidateRanking ranking =
        candidateRankingRepository
            .findByRecruitmentCourseIdAndApplicationId(recruitmentCourseId, applicationId)
            .orElseGet(
                () ->
                    CandidateRanking.builder()
                        .recruitmentCourseId(recruitmentCourseId)
                        .applicationId(applicationId)
                        .build());
    ranking.setRank(edit.rank());
    candidateRankingRepository.save(ranking);
    return edit;
  }

  private Application requireCandidate(List<Application> applications, Long applicationId) {
    return applications.stream()
        .filter(application -> applicationId.equals(application.getId()))
        .findFirst()
        .orElseThrow(
            () ->
                new ForbiddenException(
                    "This application is not an eligible candidate for this recruitment course."));
  }

  /** Student answers only: never return the administrative review fields. */
  public static record CandidateApplication(
      Long id,
      Long recruitmentId,
      String email,
      LocalDateTime submittedAt,
      String postApplicationComments,
      ApplicationsController.ApplicationFields answers) {}

  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/candidates/{applicationId}")
  public CandidateApplication candidateApplication(
      @PathVariable Long recruitmentId,
      @PathVariable Long recruitmentCourseId,
      @PathVariable Long applicationId) {
    RankingScope scope = rankingScope(recruitmentId, recruitmentCourseId, false);
    Application a = requireCandidate(eligible(scope, true), applicationId);
    return new CandidateApplication(
        a.getId(),
        a.getRecruitmentId(),
        a.getEmail(),
        a.getSubmittedAt(),
        a.getPostApplicationComments(),
        new ApplicationsController.ApplicationFields(
            a.getFirstName(),
            a.getMiddleName(),
            a.getLastName(),
            a.getMajor(),
            a.getGpaMajor(),
            a.getGpaOverall(),
            a.getYearInProgram(),
            a.getGraduationDate(),
            a.getPriorCoursework().stream()
                .map(
                    p ->
                        new ApplicationsController.PriorCourseworkFields(
                            p.isUcsbCourse(),
                            p.getOtherSchool(),
                            p.getCourseNumber(),
                            p.getCourseTitle(),
                            p.getTerm(),
                            p.getGrade()))
                .toList(),
            a.getTopicProficiencies(),
            a.getInterests(),
            a.getPrevExperience(),
            a.getComments(),
            a.getFirstChoiceCourse(),
            a.getSecondChoiceCourse(),
            a.isAvailableForLecturesFirstChoice(),
            a.isAvailableForLecturesSecondChoice(),
            a.isAvailableForDiscussionFirstChoice(),
            a.isAvailableForDiscussionSecondChoice(),
            a.getAvailabilityCommentsFirstChoice(),
            a.getAvailabilityCommentsSecondChoice(),
            a.getCourseInterests(),
            a.getResidencyStatus(),
            a.getLanguageExam(),
            a.getLanguageExamDatePassed(),
            a.getClassLevel(),
            a.getVideoLink(),
            a.getPreviousServiceAsUla(),
            a.getPermNumber(),
            a.getBsMsStudent(),
            a.getStudentStatusNextQuarter(),
            a.getWantsTaEligibility(),
            a.getOtherCampusJob(),
            a.getPriorUcsbEmployment(),
            a.getEmployeeId(),
            a.getI9Appointment(),
            a.getTrainingCommitment(),
            a.getTrainingCommitmentExplanation(),
            a.getChangingMajor(),
            a.getNoticeVersionId()));
  }
}
