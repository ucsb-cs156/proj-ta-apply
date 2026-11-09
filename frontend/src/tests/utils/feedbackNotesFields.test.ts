import { describe, expect, test } from "vitest";
import {
  askingForFeedback,
  COST_FIELDS,
  FEEDBACK_NOTES_FIELDS_HELP_PATH,
  FEEDBACK_NOTES_FIELDS_HINT,
  FEEDBACK_SETTINGS_COSTS_URL,
  FEEDBACK_SETTINGS_HISTORY_URL,
  FEEDBACK_SETTINGS_SAVE_URL,
  FEEDBACK_SETTINGS_URL,
  fillFeedbackNotesFields,
  KNOWN_FEEDBACK_NOTES_FIELDS,
  lastAskChange,
  onOff,
  ORIGINAL_FEEDBACK_NOTES,
  versionChanges,
  type InstructorFeedbackSettings,
} from "main/utils/feedbackNotesFields";
import {
  QUARTER_NOTICE_FIELDS,
  SAMPLE_CALENDAR,
} from "main/utils/noticeFields";

const costs = {
  quarter: "20214",
  estimatedCostPerTA: 12000,
  estimatedCostPerULA: 2000,
};

describe("feedbackNotesFields (issue #429)", () => {
  test("the endpoints and the help page", () => {
    expect(FEEDBACK_SETTINGS_URL).toBe("/api/instructor/feedback/settings");
    expect(FEEDBACK_SETTINGS_HISTORY_URL).toBe(
      "/api/admin/instructorFeedbackSettings/all",
    );
    expect(FEEDBACK_SETTINGS_SAVE_URL).toBe(
      "/api/admin/instructorFeedbackSettings",
    );
    expect(FEEDBACK_SETTINGS_COSTS_URL).toBe(
      "/api/admin/instructorFeedbackSettings/costs",
    );
    expect(FEEDBACK_NOTES_FIELDS_HELP_PATH).toBe(
      "/help/instructor-feedback-fields",
    );
  });

  test("the fields are the quarter, its calendar's and the three costs, but not the recruitment's deadline", () => {
    expect(COST_FIELDS.map((field) => field.key)).toEqual([
      "estimatedCostPerTA",
      "estimatedCostPerULA",
      "taToUlaCostRatio",
    ]);
    COST_FIELDS.forEach((field) =>
      expect(field.label.length).toBeGreaterThan(20),
    );
    expect(KNOWN_FEEDBACK_NOTES_FIELDS).toEqual([
      "quarter",
      ...QUARTER_NOTICE_FIELDS.map((field) => field.key),
      "estimatedCostPerTA",
      "estimatedCostPerULA",
      "taToUlaCostRatio",
    ]);
    expect(KNOWN_FEEDBACK_NOTES_FIELDS).not.toContain(
      "primaryConsiderationDate",
    );
  });

  test("fills the quarter, its dates and its costs, every time each appears", () => {
    expect(
      fillFeedbackNotesFields(
        "${quarter} (${qyy}) starts ${firstDayOfClasses}: TA ${estimatedCostPerTA}, ULA ${estimatedCostPerULA}, ${taToUlaCostRatio}; again ${estimatedCostPerTA} ${estimatedCostPerULA} ${taToUlaCostRatio}.",
        { quarter: "20214", calendar: SAMPLE_CALENDAR, costs },
      ),
    ).toBe(
      "Fall 2021 (F21) starts October 1, 2021: TA $12,000.00, ULA $2,000.00, 1:6.0; again $12,000.00 $2,000.00 1:6.0.",
    );
  });

  test("leaves the recruitment's deadline, unknown fields and a quarter not on file as written", () => {
    expect(
      fillFeedbackNotesFields(
        "${primaryConsiderationDate} ${deadline} ${quarter} ${firstDayOfClasses}",
        { quarter: "20261", calendar: null, costs },
      ),
    ).toBe(
      "${primaryConsiderationDate} ${deadline} Winter 2026 ${firstDayOfClasses}",
    );
  });

  test("a missing or zero cost, and then the ratio, read not yet set", () => {
    const text =
      "${estimatedCostPerTA}|${estimatedCostPerULA}|${taToUlaCostRatio}";
    expect(fillFeedbackNotesFields(text, {})).toBe(
      "not yet set|not yet set|not yet set",
    );
    expect(
      fillFeedbackNotesFields(text, {
        costs: { ...costs, estimatedCostPerULA: 0 },
      }),
    ).toBe("$12,000.00|not yet set|not yet set");
    expect(
      fillFeedbackNotesFields(text, {
        costs: { ...costs, estimatedCostPerTA: null },
      }),
    ).toBe("not yet set|$2,000.00|not yet set");
  });

  test("the hint names the new fields and what becomes of a cost not yet set", () => {
    expect(FEEDBACK_NOTES_FIELDS_HINT).toBe(
      "Write ${estimatedCostPerTA}, ${estimatedCostPerULA} or ${taToUlaCostRatio} and each instructor sees their quarter's estimated cost of a TA (e.g. $12,000.00), of a ULA (e.g. $2,000.00), or the ratio of the two (e.g. 1:6.0) in its place, or \"not yet set\" until the quarter's budget has them; ${quarter} and the dates of the quarter, such as ${firstDayOfClasses}, can be inserted as in the notices. The preview fills them in for the quarter chosen above it.",
    );
  });

  test("the original notes are the text that was hard coded, written with the cost fields", () => {
    expect(
      fillFeedbackNotesFields(ORIGINAL_FEEDBACK_NOTES, { costs }).split("\n\n"),
    ).toEqual([
      "Note that the current estimated cost of a TA is $12,000.00 while the estimated cost of a ULA is $2,000.00. This means that on a cost basis, the ratio of TA to ULA is 1:6.0.",
      "On the other hand, TAs work 20 hours per week, while ULAs work 10 hours per week.",
      "We are not always in a position to trade off TAs for ULAs in precisely the way each faculty member would prefer; there are constraints other than faculty preferences that we must satisfy. That being said, we will do our best to take your preferences into consideration.",
    ]);
  });
});

describe("feedbackNotesFields: asking for feedback (issue #430)", () => {
  const version = (
    id: number,
    askForFeedback: boolean,
    notesText = "Notes",
  ): InstructorFeedbackSettings => ({
    id,
    createdAt: "2026-11-09T08:00:00",
    editorEmail: null,
    notesText,
    askForFeedback,
  });

  test("askingForFeedback: the newest version's setting, yes with none, null until loaded", () => {
    expect(askingForFeedback([version(2, false)])).toBe(false);
    expect(askingForFeedback([version(2, true)])).toBe(true);
    expect(askingForFeedback([])).toBe(true);
    expect(askingForFeedback(null)).toBeNull();
    expect(askingForFeedback(undefined)).toBeNull();
  });

  test("onOff names the two values", () => {
    expect(onOff(true)).toBe("On");
    expect(onOff(false)).toBe("Off");
  });

  test("versionChanges: what each version changed from the one before it", () => {
    const changes = versionChanges([
      version(6, true, "Other"),
      version(5, false, "Other"),
      version(4, false, "Other"),
      version(3, false, "Notes"),
      version(2, true, "Notes"),
      version(1, true, "First"),
    ]);
    expect([...changes.entries()]).toEqual([
      [6, "Asking for feedback: On"],
      [5, "Nothing"],
      [4, "Notes"],
      [3, "Asking for feedback: Off"],
      [2, "Notes"],
      [1, "First version"],
    ]);
    expect(
      versionChanges([version(2, false, "B"), version(1, true, "A")]).get(2),
    ).toBe("Notes; Asking for feedback: Off");
    expect(versionChanges([]).size).toBe(0);
  });

  test("lastAskChange: the oldest of the newest run with the current value", () => {
    const v1 = version(1, true);
    const v2 = version(2, false);
    const v3 = version(3, false);
    const v4 = version(4, true);
    const v5 = version(5, true);
    expect(lastAskChange([v5, v4, v3, v2, v1])).toBe(v4);
    expect(lastAskChange([v3, v2, v1])).toBe(v2);
    expect(lastAskChange([v2, v1])).toBe(v2);
    expect(lastAskChange([v1])).toBe(v1);
    expect(lastAskChange([v5, v4, v1])).toBe(v1);
    expect(lastAskChange([])).toBeUndefined();
  });
});
