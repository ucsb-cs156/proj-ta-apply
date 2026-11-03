package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * An admin's free-text notes on a draft application (issue #296), one row per draft. They live in
 * their own table rather than on {@link DraftApplication} for two reasons: saving them must not
 * bump the draft's version, or the applicant's next autosave would be refused as a conflict, and
 * the draft is sent to the applicant, who must never see them.
 *
 * <p>The row is removed with its draft. Submitting the application copies the text to {@link
 * Application#getAdminComments()} first.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Entity(name = "draft_admin_comments")
public class DraftAdminComment {
  /** The draft these are about; also this row's key. */
  @Id
  @Column(name = "draft_id")
  private Long draftId;

  @Column(length = 4000)
  private String comments;
}
