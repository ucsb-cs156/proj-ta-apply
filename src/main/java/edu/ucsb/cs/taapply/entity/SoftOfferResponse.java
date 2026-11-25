package edu.ucsb.cs.taapply.entity;

import edu.ucsb.cs.taapply.enums.SoftOfferDecision;
import edu.ucsb.cs.taapply.time.AppTime;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * An assigned ULA applicant's answer to their soft offer (issue #486, part of #483): proceed to a
 * formal offer, or decline, with an optional comment.
 *
 * <p>An answer belongs to one (application, course) pair, because assignments can change after soft
 * offers are released: if the admin moves the applicant to another course, the old answer no longer
 * applies and the applicant is asked again, while the old row is kept for the admin's results page.
 * The pair is unique, so an offer can be answered once. {@code softOfferNoticeVersionId} is the
 * Soft Offer Notices version the applicant read, or null if none had been saved.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "soft_offer_responses")
@Table(
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_soft_offer_responses_application_course",
            columnNames = {"application_id", "recruitment_course_id"}))
public class SoftOfferResponse {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "application_id", nullable = false)
  private Long applicationId;

  /** The lecture the applicant was assigned to when they answered. */
  @Column(name = "recruitment_course_id", nullable = false)
  private Long recruitmentCourseId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private SoftOfferDecision decision;

  @Column(length = 4000)
  private String comments;

  /** When the applicant answered; stamped on insert, in Pacific time. */
  @Column(name = "responded_at", updatable = false)
  private LocalDateTime respondedAt;

  @Column(name = "soft_offer_notice_version_id")
  private Long softOfferNoticeVersionId;

  @PrePersist
  void stampResponded() {
    respondedAt = AppTime.now();
  }
}
