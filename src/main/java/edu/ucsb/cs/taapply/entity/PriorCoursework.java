package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.utilities.CourseMatching;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import lombok.*;

/**
 * One course an applicant has taken, listed on their application as relevant background. Replaces
 * the earlier free-text coursework answers (UCSB, elsewhere, 290-level) with one row per course, so
 * a review page can sort and filter by course rather than read prose.
 *
 * <p>Owned by {@link Application}: rows are saved, replaced and deleted with their application and
 * are never addressed on their own. The design asked for separate TA and ULA foreign keys; this app
 * keeps TA and ULA applications in one {@code applications} table, so one {@code application_id}
 * plays both roles and the exclusive-or constraint is satisfied by construction.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "prior_coursework")
public class PriorCoursework {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Taken at UCSB; when false, {@code otherSchool} says where. */
  @Builder.Default private boolean ucsbCourse = true;

  /** Required when the course was not taken at UCSB; null when it was. */
  private String otherSchool;

  /** Required, e.g. "CMPSC 156" or "CS 101". */
  private String courseNumber;

  private String courseTitle;

  /**
   * The quarter or semester it was taken, as the applicant writes it, e.g. "F25" or "Fall 2025".
   */
  private String term;

  /** Optional; "IP" for a course in progress, as the legacy form suggested. */
  private String grade;

  /**
   * What makes two rows the same course (issue #334): course number, school (UCSB, or the named
   * other school) and term, each ignoring case and spacing, so "CMPSC 156" and "cmpsc156" match. A
   * retake in another term is a different row. Null when there is no course number: such a row
   * (only a draft may hold one) is never the same as another.
   */
  public static String key(
      boolean ucsbCourse, String otherSchool, String courseNumber, String term) {
    if (courseNumber == null || courseNumber.isBlank()) {
      return null;
    }
    String school = ucsbCourse ? "UCSB" : "other:" + CourseMatching.squash(otherSchool);
    return String.join(
        "|", school, CourseMatching.squash(courseNumber), CourseMatching.squash(term));
  }

  /** The key of this row; see {@link #key(boolean, String, String, String)}. */
  public String key() {
    return key(ucsbCourse, otherSchool, courseNumber, term);
  }

  /**
   * The rows with identical courses collapsed to one (issue #334): the later row replaces the
   * earlier in the earlier's place, so the list keeps its order. Which of two disagreeing rows wins
   * does not matter. A row with no key is kept as it is.
   */
  public static <T> List<T> collapse(List<T> rows, Function<T, String> keyOf) {
    Map<String, Integer> positions = new HashMap<>();
    List<T> collapsed = new ArrayList<>();
    for (T row : rows) {
      String key = keyOf.apply(row);
      Integer position = key == null ? null : positions.get(key);
      if (position != null) {
        collapsed.set(position, row);
      } else {
        if (key != null) {
          positions.put(key, collapsed.size());
        }
        collapsed.add(row);
      }
    }
    return collapsed;
  }

  /** The rows with identical courses collapsed to one; see {@link #collapse(List, Function)}. */
  public static List<PriorCoursework> collapse(List<PriorCoursework> rows) {
    return collapse(rows, PriorCoursework::key);
  }
}
