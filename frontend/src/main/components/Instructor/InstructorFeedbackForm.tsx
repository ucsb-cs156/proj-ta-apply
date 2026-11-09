import { useCallback, useEffect, useRef, useState } from "react";
import { Form } from "react-bootstrap";
import axios from "axios";
import { toast } from "react-toastify";
import SavedOnChangeInput from "main/components/Budget/SavedOnChangeInput";
import { shouldToastBackendError } from "main/utils/apiError";
import { useBackend } from "main/utils/useBackend";
import { formatPacificDateTime } from "main/utils/pacificTime";
import type {
  InstructorQuarter,
  QuarterCourse,
} from "main/utils/instructorQuarters";
import {
  AT_LEAST_ONE_MESSAGE,
  COMMENTS_LIMIT_MESSAGE,
  COMMENTS_SAVE_DELAY_MS,
  FEEDBACK_COSTS_URL,
  FEEDBACK_URL,
  MAX_COMMENTS,
  countFromInput,
  isValidCount,
  type FeedbackFields,
  type InstructorFeedback,
  type TradeoffCosts,
} from "main/utils/instructorFeedback";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FEEDBACK_SETTINGS_URL,
  fillFeedbackNotesFields,
  type InstructorFeedbackSettings,
} from "main/utils/feedbackNotesFields";
import { useNoticeFillIn } from "main/utils/useNoticeFillIn";

type Props = {
  quarter: InstructorQuarter;
  course: QuarterCourse;
  testIdPrefix: string;
};

type Box =
  | "allocReasonable"
  | "differentTACount"
  | "differentULACount"
  | "otherConcerns";

/**
 * Sends the form's saves one after another (issue #425), so that the last thing typed is the last
 * thing stored, and remembers when the server last stamped one.
 */
function useFeedbackSaves(recruitmentCourseId: number) {
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const save = useCallback(
    (fields: Partial<FeedbackFields>) => {
      queue.current = queue.current.then(async () => {
        try {
          const response = await axios({
            method: "PUT",
            url: FEEDBACK_URL,
            params: { recruitmentCourseId },
            data: fields,
          });
          setLastUpdated((response.data as InstructorFeedback).lastUpdated);
        } catch (error) {
          if (shouldToastBackendError(error)) {
            toast(`${error}`);
          } else {
            console.error("Saving the allocation feedback failed", error);
          }
        }
      });
    },
    // Stryker disable next-line ArrayDeclaration : a form is always for the one course
    [recruitmentCourseId],
  );

  return { save, lastUpdated };
}

/**
 * The "Notes on TA/ULA tradeoffs" (issue #425), closed until opened: since issue #429 the newest
 * version of the admin's notes from Instructor Feedback Settings, as Markdown, with its fields
 * filled in for the quarter: its name and calendar dates, and its estimated cost per TA and per ULA
 * and their ratio. There is no section at all while there are no notes.
 */
function TradeoffNotes({
  quarter,
  testIdPrefix,
}: {
  quarter: string;
  testIdPrefix: string;
}): React.JSX.Element | null {
  const { data: settings } = useBackend<InstructorFeedbackSettings[]>(
    // Stryker disable next-line ArrayDeclaration : the cache key is not observable from here
    [FEEDBACK_SETTINGS_URL],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: FEEDBACK_SETTINGS_URL },
    // Stryker disable next-line ArrayDeclaration : a placeholder until the settings arrive
    [],
  );
  const { data: costs } = useBackend<TradeoffCosts | null>(
    // Stryker disable next-line ArrayDeclaration : the cache key is not observable from here
    [FEEDBACK_COSTS_URL, quarter],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: FEEDBACK_COSTS_URL, params: { quarter } },
    null,
  );
  const fillIn = useNoticeFillIn({ quarter });
  const notes = Array.isArray(settings) ? settings[0]?.notesText : undefined;
  if (!notes) {
    return null;
  }
  return (
    <details className="mt-3" data-testid={`${testIdPrefix}-notes`}>
      <summary data-testid={`${testIdPrefix}-notes-summary`}>
        Notes on TA/ULA tradeoffs
      </summary>
      <div className="mt-2" data-testid={`${testIdPrefix}-notes-text`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {fillFeedbackNotesFields(notes, {
            quarter,
            calendar: fillIn?.calendar,
            costs,
          })}
        </ReactMarkdown>
      </div>
    </details>
  );
}

/**
 * The allocation feedback form of one course (issue #425), shown once the quarter's allocations are
 * released. Every change is saved at once: a box when it is clicked, a preferred count as it is
 * typed, the comments shortly after the typing stops (and when the box is left). The TA line is
 * there only if the quarter has a TA recruitment and the ULA line only if it has a ULA one; the
 * count of each appears only while its box is checked. Unchecking a box keeps its count, which is
 * then ignored.
 */
export default function InstructorFeedbackForm({
  quarter,
  course,
  testIdPrefix,
}: Props): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const { data: rows } = useBackend<InstructorFeedback[]>(
    // Stryker disable next-line ArrayDeclaration : the cache key is not observable from here
    [FEEDBACK_URL],
    // Stryker disable next-line ObjectLiteral,StringLiteral : axios sends a GET whatever the method says
    { method: "GET", url: FEEDBACK_URL },
    // Stryker disable next-line ArrayDeclaration : a placeholder until the rows arrive; matches nothing
    [],
  );
  // Stryker disable next-line OptionalChaining : the initial data means there are always rows
  const stored = rows?.find(
    (row) =>
      row.quarter === quarter.quarter && row.recruitmentCourseId === course.id,
  );
  // What this page has changed since the stored row was read; it wins over the stored row.
  const [edits, setEdits] = useState<Partial<FeedbackFields>>({});
  const { save, lastUpdated } = useFeedbackSaves(course.id);

  const value = <K extends keyof FeedbackFields>(
    key: K,
  ): FeedbackFields[K] | undefined =>
    key in edits ? edits[key] : stored?.[key];

  const change = (fields: Partial<FeedbackFields>) => {
    setEdits((current) => ({ ...current, ...fields }));
    save(fields);
  };

  // The comments wait for a pause in the typing; what is waiting is sent when the box is left
  // or the form goes away.
  // A timer still running after a flush finds nothing waiting and sends nothing.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const flush = useCallback(
    () => {
      if (pending.current !== null) {
        save({ comments: pending.current });
        pending.current = null;
      }
    },
    // Stryker disable next-line ArrayDeclaration : save never changes while the form is shown
    [save],
  );
  // Leaving the page sends what is still waiting.
  // Stryker disable next-line ArrayDeclaration : flush never changes while the form is shown
  useEffect(() => flush, [flush]);

  const onComments = (typed: string) => {
    const text = typed.slice(0, MAX_COMMENTS);
    setEdits((current) => ({ ...current, comments: text }));
    pending.current = text;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, COMMENTS_SAVE_DELAY_MS);
  };

  const box = (key: Box, label: string) => (
    <Form.Check
      type="checkbox"
      id={id(key)}
      label={label}
      checked={value(key) === true}
      onChange={(e) => change({ [key]: e.target.checked })}
      data-testid={id(key)}
    />
  );

  const countLine = (
    key: "differentTACount" | "differentULACount",
    countKey: "numTAsPreferred" | "numULAsPreferred",
    label: string,
    countLabel: string,
  ) => (
    <div
      className="d-flex align-items-center flex-wrap gap-3"
      data-testid={id(`${key}-line`)}
    >
      {box(key, label)}
      {value(key) === true && (
        <SavedOnChangeInput
          id={id(countKey)}
          label={countLabel}
          stored={String(value(countKey) ?? "")}
          isValid={isValidCount}
          onSave={(typed) => change({ [countKey]: countFromInput(typed) })}
          invalidMessage="A whole number, 0 or more"
          width="5em"
          inline
        />
      )}
    </div>
  );

  const comments = value("comments") ?? "";
  const noneChecked = (
    [
      "allocReasonable",
      "differentTACount",
      "differentULACount",
      "otherConcerns",
    ] as const
  ).every((key) => value(key) !== true);
  const saved = lastUpdated ?? stored?.lastUpdated;

  return (
    <div data-testid={id("form")}>
      <h3 className="h6">
        Please provide feedback on your allocation of TAs/ULAs
      </h3>
      <p className="mb-1">Please select all that apply, but at least one:</p>
      {box("allocReasonable", "The allocation seems reasonable to me")}
      {quarter.ta &&
        countLine(
          "differentTACount",
          "numTAsPreferred",
          "I would prefer a different number of TAs",
          "Number of TAs preferred:",
        )}
      {quarter.ula &&
        countLine(
          "differentULACount",
          "numULAsPreferred",
          "I would prefer a different number of ULAs",
          "Number of ULAs preferred:",
        )}
      {box("otherConcerns", "I have other concerns, listed below:")}
      {noneChecked && (
        <div className="text-danger small" data-testid={id("at-least-one")}>
          {AT_LEAST_ONE_MESSAGE}
        </div>
      )}
      <Form.Control
        as="textarea"
        rows={4}
        className="mt-2"
        aria-label="Comments"
        maxLength={MAX_COMMENTS}
        value={comments}
        onChange={(e) => onComments(e.target.value)}
        onBlur={flush}
        data-testid={id("comments")}
      />
      {comments.length >= MAX_COMMENTS && (
        <div className="text-danger small" data-testid={id("comments-limit")}>
          {COMMENTS_LIMIT_MESSAGE}
        </div>
      )}
      <div className="mt-2 text-muted small" data-testid={id("last-saved")}>
        Last saved: {saved ? formatPacificDateTime(saved) : "never"}
      </div>
      <TradeoffNotes quarter={quarter.quarter} testIdPrefix={testIdPrefix} />
    </div>
  );
}
