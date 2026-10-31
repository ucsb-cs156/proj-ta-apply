package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.*;

/**
 * A hiring round for one quarter and one type of position. At most one exists per (quarter, type).
 *
 * <p>The two "actual" dates record what happened rather than what was planned: {@code
 * actualOpeningDate} is stamped the first time applications open and never overwritten, so it keeps
 * the date applicants were actually able to start; {@code actualClosingDate} is stamped on each
 * close, so it reflects when applications last stopped being accepted. Faculty review dates follow
 * the same first-opening rule: {@code facultyReviewOpeningDate} is preserved if reviews reopen,
 * while {@code facultyRankingDeadline} can be changed for each opening.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "recruitments")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_recruitments_quarter_type",
            columnNames = {"quarter", "type"}))
public class Recruitment {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** YYYYQ, e.g. "20261". Displayed to admins in QYY form. */
  private String quarter;

  @Enumerated(EnumType.STRING)
  private RecruitmentType type;

  @Enumerated(EnumType.STRING)
  @Builder.Default
  private ApplicationStatus applicationStatus = ApplicationStatus.CLOSED;

  /** Faculty ranking lifecycle: NotStarted, Open or Closed. */
  @Column(nullable = false, length = 16)
  @Builder.Default
  private String reviewStatus = "NotStarted";

  /** Required; shown to users before applications open. */
  private LocalDate tentativeOpeningDate;

  /** Required; the date by which applications get primary consideration. */
  private LocalDate primaryConsiderationDate;

  /** Null until the first time this recruitment is opened. */
  private LocalDate actualOpeningDate;

  /** Null until it has been closed at least once; overwritten on each close. */
  private LocalDate actualClosingDate;

  /** Null until reviews are first opened; preserved on subsequent openings. */
  private LocalDate facultyReviewOpeningDate;

  /** The required-by date for faculty rankings while reviews are open. */
  private LocalDate facultyRankingDeadline;

  /**
   * When the course list was last filled from the UCSB API, by hand or by the nightly refresh
   * (issue #124); null until the first successful Populate.
   */
  private LocalDateTime lastPopulatedAt;

  /**
   * How many TAs (or ULAs) this recruitment expects to hire in all (issue #174): the number the
   * admin spreads across the courses as per-course allocations. Always at least 1. A planning
   * figure, so changes to it are not audited.
   */
  @Column(name = "total_hiring_target", nullable = false)
  @Builder.Default
  private Integer totalHiringTarget = 1;
}
