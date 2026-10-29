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
 * One change an admin made to one field of a student's application: what the field was called, what
 * it held before and what it holds now (Admin > Audit Trail).
 *
 * <p>Exactly one of {@code ulaApplicationId} and {@code taApplicationId} is set, which the table's
 * check constraint enforces (changeset 017). Values are strings whatever the field's type; a row of
 * a join table (a prior course, a topic rating, an interest) is stored as the JSON of the whole
 * row. A null old value means the field was blank, or a row was added; a null new value means the
 * admin blanked an optional field, or deleted a row.
 *
 * <p>Nothing writes rows yet: the admin edit that will is a later feature. The table and its page
 * come first so that feature has somewhere to record what it does.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "audit_trail")
public class AuditTrail {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** When the change was recorded; stamped by Hibernate on insert. */
  @CreationTimestamp
  @Column(name = "edited_at", updatable = false)
  private LocalDateTime editedAt;

  @Column(name = "ula_application_id")
  private Long ulaApplicationId;

  @Column(name = "ta_application_id")
  private Long taApplicationId;

  @Column(name = "field_name", nullable = false)
  private String fieldName;

  @Column(name = "old_value", length = 4000)
  private String oldValue;

  @Column(name = "new_value", length = 4000)
  private String newValue;
}
