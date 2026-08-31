package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * One course in one recruitment, with the offering details for that quarter as reported by the UCSB
 * API.
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
            name = "uk_recruitment_courses_recruitment_course",
            columnNames = {"recruitment_id", "course_id"}))
public class RecruitmentCourse {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "recruitment_id")
  private Long recruitmentId;

  /** Padded form, e.g. "CMPSC 1A", matching courses.course_id so the two sort alike. */
  @Column(name = "course_id")
  private String courseId;

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
