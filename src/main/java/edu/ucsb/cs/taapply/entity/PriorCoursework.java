package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
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
}
