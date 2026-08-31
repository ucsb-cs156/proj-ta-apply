package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * One <em>primary section</em> of one course in one recruitment, with the offering details for that
 * quarter as reported by the UCSB API.
 *
 * <p>A course with two lectures gets two rows, not one. They are planned separately: enrollment and
 * max enrollment drive how many positions each gets, and two primaries often have different
 * instructors who rank candidates independently. Secondary sections (discussions, labs) are not
 * included.
 *
 * <p>{@code removed} exists so that an admin's decision to drop a course survives a later Populate.
 * A hard delete would not: the next run cannot tell a course that was deliberately removed from one
 * it has never seen, and would add it straight back.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "recruitment_courses")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            // Keyed on the enroll code, not the course: one row per primary section.
            name = "uk_recruitment_courses_recruitment_enroll_code",
            columnNames = {"recruitment_id", "enroll_code"}))
public class RecruitmentCourse {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "recruitment_id")
  private Long recruitmentId;

  /**
   * The same fixed-width padded form stored in courses.course_id, so the two sort alike. (Not shown
   * literally here: the formatter collapses runs of spaces in comments.)
   */
  @Column(name = "course_id")
  private String courseId;

  /**
   * The section's enrollment code, unique within a quarter. This is what makes two lectures of the
   * same course distinct rows.
   */
  @Column(name = "enroll_code")
  private String enrollCode;

  /** The primary section's number, e.g. "0100" or "0200"; shown so lectures can be told apart. */
  private String section;

  private String title;

  /** First instructor of the primary section. */
  private String instructor;

  /** First time-location of the primary section. */
  private String days;

  private String time;

  private String room;

  private Integer enrollment;

  private Integer maxEnroll;

  /** open, closed or cancelled. */
  private String status;

  /** Only meaningful for summer quarters, but the column is always present. */
  private String summerSession;

  /** Set when an admin removes the course; excluded from later Populate runs. */
  @Builder.Default private boolean removed = false;
}
