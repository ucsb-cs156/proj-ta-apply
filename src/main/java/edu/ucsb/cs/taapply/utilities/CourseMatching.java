package edu.ucsb.cs.taapply.utilities;

import edu.ucsb.cs.taapply.entity.PriorCoursework;
import java.util.List;
import java.util.Locale;

/**
 * The one place that decides whether two course numbers name the same course, and whether an
 * applicant's prior coursework includes a given UCSB course (issue #448). Course ids in the course
 * table pad the department to a fixed width, while applicants type course numbers however they
 * like, so all of these compare after uppercasing and removing every space: the padded id, "cmpsc
 * 156" and "CMPSC156" are one course.
 *
 * <p>Used by the duplicate-row key of {@link PriorCoursework}, the fake-application generator, and
 * the ranking page's When Course Taken column (issue #442). The front end has the same rule for the
 * ULA form's untaken-course warning, in {@code frontend/src/main/utils/untakenCourses.ts}.
 */
public final class CourseMatching {

  private CourseMatching() {}

  /** Text uppercased with every whitespace character removed; null becomes "". */
  public static String squash(String text) {
    return text == null ? "" : text.toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
  }

  /**
   * Whether two course numbers name the same course, ignoring case and spacing. A null or blank
   * number matches nothing, not even another blank.
   */
  public static boolean sameCourse(String a, String b) {
    return !squash(a).isEmpty() && squash(a).equals(squash(b));
  }

  /**
   * A course id as an applicant would write it, with each run of spaces made one and the ends
   * trimmed: the padded id of CMPSC 156 becomes "CMPSC 156".
   */
  public static String display(String courseId) {
    return courseId.trim().replaceAll("\\s+", " ");
  }

  /** Whether a prior course is the UCSB course {@code courseId}; a course elsewhere never is. */
  public static boolean isUcsbCourse(PriorCoursework row, String courseId) {
    return row.isUcsbCourse() && sameCourse(row.getCourseNumber(), courseId);
  }

  /** The first of the rows that is the UCSB course {@code courseId}, or null if none is. */
  public static PriorCoursework firstUcsbCourse(List<PriorCoursework> rows, String courseId) {
    return rows.stream().filter(row -> isUcsbCourse(row, courseId)).findFirst().orElse(null);
  }
}
