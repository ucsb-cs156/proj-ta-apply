package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Instructor;
import edu.ucsb.cs.taapply.entity.Recruitment;
import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.errors.ForbiddenException;
import edu.ucsb.cs.taapply.model.CurrentUser;
import edu.ucsb.cs.taapply.repository.InstructorRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import edu.ucsb.cs.taapply.repository.RecruitmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

  /** A recruitment as the admin's and student's cards know it, plus the instructor's courses. */
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
      List<RecruitmentCourse> courses) {
    public static InstructorRecruitment of(Recruitment r, List<RecruitmentCourse> courses) {
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
          courses);
    }
  }

  /** The read-only, course-scoped data needed by the second-iteration ranking placeholder. */
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
      List<CourseDetails> otherCourses) {}

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
            r ->
                InstructorRecruitment.of(
                    r,
                    byRecruitment.get(r.getId()).stream().sorted(BY_COURSE_THEN_SECTION).toList()))
        .toList();
  }

  /**
   * Read-only candidate-ranking page metadata. Instructor access is derived from the authenticated
   * user's email and admin-managed catalog-name mapping; no caller-supplied identity is trusted.
   */
  @Operation(
      summary = "Get the course-scoped candidate ranking page",
      description =
          "Instructors may read only their own active recruitment courses. Admins may read any"
              + " course. This iteration returns page metadata and sibling course links only; it"
              + " does not expose or modify candidate rankings.")
  @PreAuthorize("hasAnyRole('ROLE_INSTRUCTOR', 'ROLE_ADMIN')")
  @GetMapping("/{recruitmentId}/courses/{recruitmentCourseId}/ranking")
  public CandidateRankingPage candidateRankingPage(
      @PathVariable Long recruitmentId, @PathVariable Long recruitmentCourseId) {
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
    if (!course.isOnOffer()) {
      throw new ForbiddenException(
          "This recruitment course has been removed or is no longer available.");
    }
    if ("NotStarted".equals(recruitment.getReviewStatus())) {
      throw new ForbiddenException(
          "Candidate rankings are unavailable because faculty reviews have not started.");
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

    String catalogName =
        instructorRepository.findByEmail(email).map(Instructor::getCatalogName).orElse(null);
    if (!isAdmin && (catalogName == null || !catalogName.equals(course.getInstructor()))) {
      throw new ForbiddenException(
          "This recruitment course is not assigned to the authenticated instructor.");
    }

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
        otherCourses);
  }
}
