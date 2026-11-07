package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.EnrollmentEstimateSource;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * One <em>primary section</em> of one course in one quarter, with the facts about the section that
 * do not depend on which recruitment it is in (issue #363). Many rows to one {@link Budget}: the
 * quarter's budget row is the parent, created on demand when the quarter gets its first course.
 *
 * <p>A course in a quarter can be in both the TA and the ULA recruitment, each of which has its own
 * {@link RecruitmentCourse} row for it. Before this table those rows each carried an enrollment
 * estimate and the UCSB API's enrollment figures, and the two copies could disagree. Now there is
 * exactly one row per section per quarter, keyed on the quarter and the enroll code (unique within
 * a quarter, and what tells two lectures of one course apart), and the recruitment rows read these
 * figures from it.
 *
 * <p>The row exists while some recruitment of the quarter has the section and has not removed it:
 * created when a recruitment first gets the section (Populate, Add by enroll code, or putting a
 * removed one back) and deleted when the last recruitment that had it removes it, so a section that
 * comes back starts with an empty estimate (decided by the maintainer).
 *
 * <p>The estimate is a planning figure and is not versioned (the allocations, which are per
 * recruitment, stay on {@code recruitment_courses} with their version); changes are not audited.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder(toBuilder = true)
@Entity(name = "budget_courses")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_budget_courses_quarter_enroll_code",
            columnNames = {"quarter", "enroll_code"}))
public class BudgetCourse {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** YYYYQ, the {@link Budget#getQuarter() quarter} of the budget this row belongs to. */
  @Column(nullable = false)
  private String quarter;

  /** The section's enrollment code, unique within the quarter. */
  @Column(name = "enroll_code", nullable = false)
  private String enrollCode;

  /** The padded course id, as in {@code courses.course_id}; kept for display and sorting. */
  @Column(name = "course_id")
  private String courseId;

  /** The primary section's number, e.g. "0100". */
  private String section;

  /** The section's current enrollment as last read from the UCSB API; a cache. */
  private Integer enrollment;

  /** The section's maximum enrollment as last read from the UCSB API; a cache. */
  @Column(name = "max_enroll")
  private Integer maxEnroll;

  /**
   * When the quarter's figures were last checked against the UCSB API (Pacific wall-clock time, see
   * {@code AppTime}). Every row of the quarter is stamped by every fetch of the quarter's
   * offerings, found or not, so a section the API no longer lists does not keep the quarter stale.
   * Null until the first fetch after the row was created. The figures are considered fresh for 24
   * hours.
   */
  @Column(name = "enrollment_refreshed_at")
  private LocalDateTime enrollmentRefreshedAt;

  /**
   * The admin's estimate of how many students the section will have (issue #175), the basis for
   * allocating positions in every recruitment of the quarter. Null until entered.
   */
  @Column(name = "enrollment_estimate")
  private Integer enrollmentEstimate;

  /**
   * Where the estimate came from when it was filled from the API's figures in one step: MAX or
   * ACTUAL. Null for an estimate the admin typed, and for one copied over by the migration from the
   * recruitment rows, which did not record a source.
   */
  @Enumerated(EnumType.STRING)
  @Column(name = "enrollment_estimate_source")
  private EnrollmentEstimateSource enrollmentEstimateSource;
}
