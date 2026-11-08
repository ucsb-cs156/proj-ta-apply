package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.time.AppTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One change to a recruitment itself (issue #139): its creation, its deletion, or one field going
 * from one value to another, with the value before and after as strings. The admin's Applications
 * page for the recruitment lists these rows; the Budget page lists the hiring-target rows of the
 * quarter's two recruitments (issue #391).
 *
 * <p>This is the audit trail for <em>recruitments</em>. Changes an admin makes to an individual
 * student's application are a different table, {@link AuditTrail}.
 *
 * <p>{@code whatChanged} names the field ({@code applicationStatus}, {@code tentativeOpeningDate},
 * {@code primaryConsiderationDate}, {@code actualOpeningDate}, {@code actualClosingDate}, {@code
 * reviewStatus}, {@code facultyReviewOpeningDate}, {@code facultyRankingDeadline}, {@code
 * allocationVisibility}, {@code assignmentsPublished}, {@code totalHiringTarget}), or is {@link
 * #CREATED} or {@link #DELETED}, when both values are null. A change to several fields in one
 * request is several rows. There is deliberately no foreign key to the recruitment: the rows about
 * a deleted recruitment are the record that it existed.
 *
 * <p>{@code editorEmail} is the email of the admin who made the change (issue #337, changeset 066),
 * as text rather than a user id: it reads directly in the table, survives the user row being
 * deleted, and needs no join. It is null on the rows written before the column existed.
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

  /** When the change was recorded; stamped on insert, in Pacific time. */
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

  /** The email of the admin who made the change; null on rows older than the column. */
  @Column(name = "editor_email")
  private String editorEmail;

  /** Stamps the Pacific time at which the row is first saved (issue #293). */
  @PrePersist
  void stampChanged() {
    changedAt = AppTime.now();
  }
}
