package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.RecruitmentCourse;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.RecruitmentCourseRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The course list for one recruitment. */
@Tag(name = "RecruitmentCourses")
@RequestMapping("/api/recruitmentcourses")
@RestController
@Slf4j
public class RecruitmentCoursesController extends ApiController {

  @Autowired RecruitmentCourseRepository recruitmentCourseRepository;

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
      summary = "Remove a course from a recruitment",
      description =
          "Flags the row rather than deleting it, so a later Populate does not add it straight back."
              + " Removing an already-removed course is a no-op.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @DeleteMapping("/delete")
  public Object removeCourse(@Parameter(name = "id") @RequestParam Long id) {
    RecruitmentCourse course =
        recruitmentCourseRepository
            .findById(id)
            .orElseThrow(() -> new EntityNotFoundException(RecruitmentCourse.class, id));

    course.setRemoved(true);
    recruitmentCourseRepository.save(course);
    return genericMessage("RecruitmentCourse with id %s removed".formatted(id));
  }
}
