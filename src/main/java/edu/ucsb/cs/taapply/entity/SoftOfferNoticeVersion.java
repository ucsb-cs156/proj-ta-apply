package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * One saved version of the "Soft Offer Notices" text (issue #484): what a ULA applicant who has
 * been assigned to a course reads above the proceed-or-decline question once soft offers have been
 * released (issue #483). ULA only, so there is no form type here.
 *
 * <p>Like {@link NoticeVersion}, versions are never edited or deleted: every save by an admin is a
 * new row with its own id and timestamp, so a response can record the version its applicant read.
 * The text is Markdown.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "soft_offer_notice_versions")
public class SoftOfferNoticeVersion {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(length = 100000)
  private String content;

  /** When this version was saved. */
  private LocalDateTime createdAt;
}
