package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.NewHireForm;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * The hiring and financial office staff's progress on one assigned ULA's hire (issue #509): the
 * Soft Offer Results page's stamped checkboxes, New Hire form dropdown, Funding (issue #512) and
 * Staff Comments.
 *
 * <p>One row per application, created lazily on the staff's first edit; the application is the key
 * rather than the (application, lecture) pair, so a reassignment to another lecture keeps the
 * progress. A checkbox is stored only as the Pacific wall-clock time it was checked (checked if and
 * only if non-null), so there is no boolean to fall out of step with its stamp. Nothing here is the
 * applicant's, and nothing here is ever serialized to them.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "hiring_records")
public class HiringRecord {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "application_id", nullable = false, unique = true)
  private Long applicationId;

  @Column(name = "formal_offer_sent_at")
  private LocalDateTime formalOfferSentAt;

  @Column(name = "formal_offer_accepted_at")
  private LocalDateTime formalOfferAcceptedAt;

  @Enumerated(EnumType.STRING)
  @Column(name = "new_hire_form", length = 16)
  private NewHireForm newHireForm;

  @Column(name = "new_hire_form_at")
  private LocalDateTime newHireFormAt;

  @Column(name = "flsa_conflict_found_at")
  private LocalDateTime flsaConflictFoundAt;

  @Column(name = "flsa_conflict_resolved_at")
  private LocalDateTime flsaConflictResolvedAt;

  @Column(name = "in_ucpath_at")
  private LocalDateTime inUcpathAt;

  @Column(name = "i9_complete_at")
  private LocalDateTime i9CompleteAt;

  /**
   * The funding source's abbreviation (issue #512). Not yet a foreign key: the funding_sources
   * table arrives in its own change, and the value will be checked against it in the service (issue
   * #512, part 2).
   */
  @Column(name = "funding_source", length = 10)
  private String fundingSource;

  @Column(name = "staff_comments", length = 4000)
  private String staffComments;

  /** When the row was last saved, in Pacific time. */
  @Column(name = "updated_at")
  private LocalDateTime updatedAt;

  /** Who saved the row last. */
  @Column(name = "updated_by_email", length = 255)
  private String updatedByEmail;
}
