package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

/**
 * One saved version of the Instructor Feedback Settings (issue #429): today the Markdown of the
 * "Notes on TA/ULA tradeoffs" under each course's allocation feedback form on the instructor home
 * page.
 *
 * <p>Versions are never edited or deleted, as with the {@link NoticeVersion}s: every save by an
 * admin is a new row, whose id is the version number, and instructors always see the newest. A
 * later setting of the same page (issue #430's checkbox) is another column of this table, so each
 * version records the whole page as it was saved; a save copies forward whatever it does not
 * change.
 */
@Data
@AllArgsConstructor
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@Entity(name = "instructor_feedback_settings")
public class InstructorFeedbackSettings {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** When this version was saved: Pacific wall-clock time, set by the server. */
  private LocalDateTime createdAt;

  /** The admin who saved it; null for the version installed by changeset 069. */
  private String editorEmail;

  /** The notes, in Markdown, with ${field}s filled in for the instructor's quarter. */
  @Column(columnDefinition = "TEXT")
  private String notesText;
}
