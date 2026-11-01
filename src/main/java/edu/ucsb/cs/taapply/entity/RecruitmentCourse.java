package edu.ucsb.cs.taapply.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
@Builder(toBuilder = true)
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

  /**
   * Set by the last Populate when it did not find this row: its section vanished from the UCSB API,
   * or its course is no longer flagged for the recruitment's type (issue #122). Cleared again by a
   * Populate that finds it. Kept apart from {@code removed}, which is the admin's decision and
   * survives any Populate.
   */
  @Builder.Default private boolean stale = false;

  /**
   * Set when an admin added the row by enroll code (issue #125). Populate keeps refreshing such a
   * row and does not mark it stale merely because its course is not flagged; only its section
   * vanishing from the API does that.
   */
  @Builder.Default private boolean manuallyAdded = false;

  /**
   * How many TAs (or ULAs) the admin has allocated to this section (issue #174). Never negative; 0
   * until the admin enters a number. A planning figure, so changes to it are not audited.
   */
  @Column(nullable = false)
  @Builder.Default
  private Integer allocation = 0;

  /**
   * The admin's estimate of how many students the section will have (issue #175), the basis for
   * allocating positions. Null until entered; the Recruitment Courses page can fill it from {@code
   * maxEnroll} or {@code enrollment} in one step. A planning figure, so not audited.
   */
  @Column(name = "enrollment_estimate")
  private Integer enrollmentEstimate;

  /**
   * How many positions this section would get if they could be split into fractions and were shared
   * out by enrollment estimate alone (issue #176): {@code totalHiringTarget * enrollmentEstimate /
   * total of the estimates}. Recomputed by {@code AllocationService} whenever the target or any
   * estimate changes; null until the first recomputation. A guide for the admin, not an allocation.
   */
  @Column(name = "unrounded_allocation")
  private Double unroundedAllocation;

  /**
   * Whether the admin has released this section's allocation (its hiring target) to its instructor
   * (issue #224). Until then, and unless the recruitment shows all allocations to all faculty, the
   * instructor sees nothing about it. Faculty see the result, so each change is recorded in the
   * recruitment's audit trail.
   */
  @Column(name = "allocation_released", nullable = false)
  @Builder.Default
  private Boolean allocationReleased = false;

  /** The status the UCSB API reports for a section that has been cancelled. */
  public static final String CANCELLED = "cancelled";

  /**
   * Whether applicants should see this row: not removed by an admin, not stale, and not cancelled
   * (issue #123). Cancellation is judged when reading rather than by flagging the row, so a
   * cancellation the schedule later reverses takes effect at the next Populate with nobody's help.
   */
  @JsonIgnore
  public boolean isOnOffer() {
    return !removed && !stale && !CANCELLED.equals(status);
  }
}
