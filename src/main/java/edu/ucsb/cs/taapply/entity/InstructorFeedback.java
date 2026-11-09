package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * One instructor's feedback on one course's TA/ULA allocation in one quarter (issue #425), from the
 * form in the course's drop-down on the instructor home page. One row per quarter, instructor email
 * and recruitment course, so co-instructors each have their own.
 *
 * <p>The quarter is the {@link Budget}'s key (YYYYQ, not the issue's "qxx" form), with a foreign
 * key to it. The course is the TA row of the course if it has one, else the ULA row, the same row
 * the home page names the course by. Each field is saved on its own as the instructor changes it;
 * an unchecked box keeps its number, which is then ignored. No version column: it is one person's
 * own record and the last save wins.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder(toBuilder = true)
@Entity(name = "instructor_feedback")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_instructor_feedback_quarter_email_course",
            columnNames = {"quarter", "email", "recruitment_course_id"}))
public class InstructorFeedback {
  /** The longest the comments may be, in characters. */
  public static final int MAX_COMMENTS = 2048;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** YYYYQ, the {@link Budget#getQuarter() quarter} of the budget this row belongs to. */
  @Column(nullable = false)
  private String quarter;

  /** The instructor's email address. */
  @Column(nullable = false)
  private String email;

  /** The recruitment course the feedback is about. */
  @Column(name = "recruitment_course_id", nullable = false)
  private Long recruitmentCourseId;

  /** "The allocation seems reasonable to me." */
  @Column(name = "alloc_reasonable", nullable = false)
  @Builder.Default
  private boolean allocReasonable = false;

  /** "I would prefer a different number of TAs." */
  @Column(name = "different_ta_count", nullable = false)
  @Builder.Default
  private boolean differentTACount = false;

  /** "I would prefer a different number of ULAs." */
  @Column(name = "different_ula_count", nullable = false)
  @Builder.Default
  private boolean differentULACount = false;

  /** "I have other concerns, listed below." */
  @Column(name = "other_concerns", nullable = false)
  @Builder.Default
  private boolean otherConcerns = false;

  /** How many TAs the instructor would prefer; meant only while {@link #differentTACount}. */
  @Column(name = "num_tas_preferred")
  private Integer numTAsPreferred;

  /** How many ULAs the instructor would prefer; meant only while {@link #differentULACount}. */
  @Column(name = "num_ulas_preferred")
  private Integer numULAsPreferred;

  /** Free text, up to {@link #MAX_COMMENTS} characters. */
  @Column(length = MAX_COMMENTS)
  private String comments;

  /** When any field was last saved, Pacific wall-clock time (see {@code AppTime}). */
  @Column(name = "last_updated")
  private LocalDateTime lastUpdated;
}
