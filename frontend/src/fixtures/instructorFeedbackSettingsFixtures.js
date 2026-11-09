import { ORIGINAL_FEEDBACK_NOTES } from "main/utils/feedbackNotesFields";

/**
 * Versions of the Instructor Feedback Settings (issues #429 and #430), as /api/admin/instructorFeedbackSettings/all
 * and /api/instructor/feedback/settings return them.
 */
const instructorFeedbackSettingsFixtures = {
  /** The version changeset 069 installs: the notes as they were hard coded, with no editor. */
  v1: {
    id: 1,
    createdAt: "2026-11-09T08:00:00",
    editorEmail: null,
    notesText: ORIGINAL_FEEDBACK_NOTES,
    askForFeedback: true,
  },
  /** An admin's rewrite, with a heading, a list and every kind of field. */
  v2: {
    id: 2,
    createdAt: "2026-11-10T14:30:05",
    editorEmail: "admin@ucsb.edu",
    notesText:
      "## Tradeoffs for ${quarter}\n\n- A TA costs ${estimatedCostPerTA}\n- A ULA costs ${estimatedCostPerULA}\n- So the ratio is ${taToUlaCostRatio}\n\nClasses begin ${firstDayOfClasses}.",
    askForFeedback: true,
  },
};

/** Issue #430: another admin turns off asking for feedback; the notes are v2's. */
instructorFeedbackSettingsFixtures.v3 = {
  ...instructorFeedbackSettingsFixtures.v2,
  id: 3,
  createdAt: "2026-11-11T09:15:00",
  editorEmail: "other-admin@ucsb.edu",
  askForFeedback: false,
};

/** Newest first, as the history endpoint returns them: the notes rewritten, still asking. */
instructorFeedbackSettingsFixtures.history = [
  instructorFeedbackSettingsFixtures.v2,
  instructorFeedbackSettingsFixtures.v1,
];

/** Issue #430: the history once asking for feedback has been turned off. */
instructorFeedbackSettingsFixtures.historyNotAsking = [
  instructorFeedbackSettingsFixtures.v3,
  instructorFeedbackSettingsFixtures.v2,
  instructorFeedbackSettingsFixtures.v1,
];

export default instructorFeedbackSettingsFixtures;
