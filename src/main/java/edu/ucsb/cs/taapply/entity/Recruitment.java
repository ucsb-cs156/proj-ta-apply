package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.ApplicationStatus;
import edu.ucsb.cs.taapply.enums.RecruitmentType;
import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

/**
 * A hiring round for one quarter and one type of position. At most one exists per (quarter, type).
 *
 * <p>The two "actual" dates record what happened rather than what was planned: {@code
 * actualOpeningDate} is stamped the first time applications open and never overwritten, so it keeps
 * the date applicants were actually able to start; {@code actualClosingDate} is stamped on each
 * close, so it reflects when applications last stopped being accepted.
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

  /** Required; shown to users before applications open. */
  private LocalDate tentativeOpeningDate;

  /** Required; the date by which applications get primary consideration. */
  private LocalDate primaryConsiderationDate;

  /** Null until the first time this recruitment is opened. */
  private LocalDate actualOpeningDate;

  /** Null until it has been closed at least once; overwritten on each close. */
  private LocalDate actualClosingDate;
}
