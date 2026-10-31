package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

/**
 * One change to a recruitment itself (issue #139): its creation, its deletion, or one field going
 * from one value to another, with the value before and after as strings. The admin's Applications
 * page for the recruitment lists these rows.
 *
 * <p>This is the audit trail for <em>recruitments</em>. Changes an admin makes to an individual
 * student's application are a different table, {@link AuditTrail}.
 *
 * <p>{@code whatChanged} names the field ({@code applicationStatus}, {@code tentativeOpeningDate},
 * {@code primaryConsiderationDate}, {@code actualOpeningDate}, {@code actualClosingDate}, {@code
 * reviewStatus}, {@code facultyReviewOpeningDate}, {@code facultyRankingDeadline}), or is {@link
 * #CREATED} or {@link #DELETED}, when both values are null. A change to several fields in one
 * request is several rows. There is deliberately no foreign key to the recruitment: the rows about
 * a deleted recruitment are the record that it existed.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "recruitment_audit_trail")
public class RecruitmentAuditTrail {

  /** The {@code whatChanged} of the row written when a recruitment is created. */
  public static final String CREATED = "created";

  /** The {@code whatChanged} of the row written when a recruitment is deleted. */
  public static final String DELETED = "deleted";

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** When the change was recorded; stamped by Hibernate on insert. */
  @CreationTimestamp
  @Column(name = "changed_at", updatable = false)
  private LocalDateTime changedAt;

  @Column(name = "recruitment_id", nullable = false)
  private Long recruitmentId;

  @Column(name = "what_changed", nullable = false)
  private String whatChanged;

  @Column(name = "old_value", length = 4000)
  private String oldValue;

  @Column(name = "new_value", length = 4000)
  private String newValue;
}
