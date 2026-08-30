package edu.ucsb.cs.taapply.controller;

import edu.ucsb.cs.taapply.entity.Course;
import edu.ucsb.cs.taapply.errors.EntityNotFoundException;
import edu.ucsb.cs.taapply.repository.CourseRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read and flag-update endpoints for the course table populated from the UCSB API. */
@Tag(name = "Courses")
@RequestMapping("/api/courses")
@RestController
@Slf4j
public class CoursesController extends ApiController {

  @Autowired CourseRepository courseRepository;

  @Operation(summary = "List all courses, ordered by course number")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @GetMapping("/all")
  public List<Course> allCourses() {
    return courseRepository.findAllByOrderByCourseIdAsc();
  }

  @Operation(
      summary = "Set the TA and ULA flags for a course",
      description =
          "Both flags are sent together so the checkboxes can save immediately on click without a"
              + " separate endpoint per flag.")
  @PreAuthorize("hasRole('ROLE_ADMIN')")
  @PutMapping("/flags")
  public Course updateFlags(
      @Parameter(name = "courseId", description = "e.g. CMPSC 156") @RequestParam String courseId,
      @Parameter(name = "needsTa") @RequestParam boolean needsTa,
      @Parameter(name = "needsUla") @RequestParam boolean needsUla) {

    Course course =
        courseRepository
            .findByCourseId(courseId)
            .orElseThrow(() -> new EntityNotFoundException(Course.class, courseId));

    course.setNeedsTa(needsTa);
    course.setNeedsUla(needsUla);
    courseRepository.save(course);
    return course;
  }
}
