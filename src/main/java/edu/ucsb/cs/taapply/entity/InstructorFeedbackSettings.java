package edu.ucsb.cs.taapply.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.Optional;
import lombok.*;

/**
 * One saved version of the Instructor Feedback Settings (issue #429): today the Markdown of the
 * "Notes on TA/ULA tradeoffs" under each course's allocation feedback form on the instructor home
 * page, and (issue #430) whether instructors are asked for that feedback at all.
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
  /**
   * The longest the notes may be, in characters: the column's width. A VARCHAR rather than TEXT so
   * that the schema is the same type on H2 (where TEXT is a CLOB) and Postgres, as the notices' is.
   */
  public static final int MAX_NOTES_LENGTH = 1_000_000;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** When this version was saved: Pacific wall-clock time, set by the server. */
  private LocalDateTime createdAt;

  /** The admin who saved it; null for the version installed by changeset 069. */
  private String editorEmail;

  /** The notes, in Markdown, with ${field}s filled in for the instructor's quarter. */
  @Column(length = MAX_NOTES_LENGTH)
  private String notesText;

  /**
   * Whether instructors are asked for feedback on their TA/ULA allocations (issue #430): when
   * false, their home page shows none of the feedback parts and the server refuses their saves.
   * True by default, as changeset 070 makes it for the versions saved before it.
   */
  @Builder.Default private boolean askForFeedback = true;

  /** Whether the settings ask for feedback: those of the newest version, and yes with none. */
  public static boolean askingForFeedback(Optional<InstructorFeedbackSettings> newest) {
    return newest.map(InstructorFeedbackSettings::isAskForFeedback).orElse(true);
  }
}
