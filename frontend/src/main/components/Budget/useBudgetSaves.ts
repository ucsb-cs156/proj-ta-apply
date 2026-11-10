import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { toast } from "react-toastify";
import { shouldToastBackendError } from "main/utils/apiError";
import { formatDollars } from "main/utils/currency";
import type {
  BudgetRow,
  BudgetSummary,
} from "main/components/Budget/budgetTypes";
import { HIRING_TARGET_AUDIT_KEY } from "main/components/Budget/BudgetAuditTrailCard";

/**
 * A figure of the quarter's budget row: the three subzero lines; the estimated cost per TA, the ULA
 * hourly rate, the hours per ULA and the other funds for ASEs (issue #388), saved and counted the
 * same way; and the TA to ULA conversion factor of the Combined Allocation page (issue #358), which
 * is saved the same way, with a version check of its own (issue #375).
 */
export type BudgetLine =
  | "unrestrictedBudget"
  | "tasOnlyBudget"
  | "ulasOnlyBudget"
  | "taCostPerQuarter"
  | "ulaRateDollarsPerHour"
  | "estimatedHoursPerULAPerQuarter"
  | "giftFundsForASEs"
  | "conversionTAtoULA";
export type Side = "ta" | "ula";
/**
 * A box on the page whose value is saved on its own: a budget line, or one recruitment's hiring
 * target (the only figure left on the recruitment's own row, issue #388).
 */
export type FieldKey = BudgetLine | `target-${Side}`;

/** The query key of the summary; every save on the page refreshes it. */
export const BUDGET_KEY = "/api/admin/budget";
const TARGET_URL = "/api/admin/recruitments/totalHiringTarget";

const NAMES: Record<FieldKey, string> = {
  unrestrictedBudget: "unrestricted budget",
  tasOnlyBudget: "TAs-only budget",
  ulasOnlyBudget: "ULAs-only budget",
  taCostPerQuarter: "estimated cost per TA",
  ulaRateDollarsPerHour: "ULA hourly rate",
  estimatedHoursPerULAPerQuarter: "estimated hours per ULA per quarter",
  giftFundsForASEs: "other funds available for ASEs",
  conversionTAtoULA: "TA to ULA conversion factor",
  "target-ta": "TA hiring target",
  "target-ula": "ULA hiring target",
};

/** A save the server refused because the figure had changed; the user decides what happens. */
export type BudgetConflict = {
  field: FieldKey;
  /** What the figure is called in the sentence: "TAs-only budget". */
  name: string;
  /** What is stored now, as it reads: "$45,000.00". */
  current: string;
  /** What the user typed, as it reads. */
  entered: string;
};

/** What the server answers a refused save with, whichever figure it was. */
type Refusal = {
  response: {
    status?: number;
    data?: {
      summary?: BudgetSummary;
      recruitment?: {
        totalHiringTarget?: number;
      };
    };
  };
};

const isConflict = (error: unknown): boolean =>
  (error as Partial<Refusal>).response?.status === 409;

const isLine = (field: FieldKey): field is BudgetLine => !field.includes("-");

/** The count that guards a budget line (issue #375): the factor's own, or the lines' version. */
type Counter = "version" | "conversionVersion";
const counterOf = (line: BudgetLine): Counter =>
  line === "conversionTAtoULA" ? "conversionVersion" : "version";

/**
 * A figure as it reads in a sentence: dollars for money, the plain number for a target, the hours
 * per ULA or the conversion factor.
 */
const reads = (field: FieldKey, value: number | string): string =>
  field.startsWith("target-") ||
  field === "conversionTAtoULA" ||
  field === "estimatedHoursPerULAPerQuarter"
    ? String(Number(value))
    : formatDollars(Number(value));

/** What the page remembers between renders; never read while rendering. */
type Held = {
  /** The version the next budget-line save carries; it only goes up. */
  version: number;
  /** The one the next conversion-factor save carries (issue #375); it only goes up too. */
  conversionVersion: number;
  /**
   * The boxes being edited (issue #426): from the first keystroke in a box until it loses focus.
   * A background refresh does not change what such a box's next save expects.
   */
  editing: Partial<Record<FieldKey, true>>;
  /**
   * The count each budget line being edited started from (issue #426). Its saves carry this, not
   * the newest count a refresh brought, so that a value changed in another tab meanwhile is still
   * refused. Only this tab's own saves move it on.
   */
  pins: Partial<Record<FieldKey, number>>;
  /** The value each recruitment figure had when the page last knew it, for the next save. */
  expected: Partial<Record<FieldKey, string>>;
  recruitmentIds: Partial<Record<FieldKey, number>>;
  /** Refused saves not yet answered, with what the user typed last and what is stored now. */
  conflicts: Partial<Record<FieldKey, BudgetConflict>>;
  typed: Partial<Record<FieldKey, string>>;
  stored: Partial<Record<FieldKey, string>>;
  queue: Promise<void>;
};

/**
 * Sends every save on the Budget page (issue #277) one after another, each carrying what the page
 * last knew so that the server can refuse it if someone else has changed the figure since.
 *
 * - The budget lines (the three subzero lines, the cost per TA, the ULA rate, the hours per ULA and
 *   the other funds) carry the budget's version, which the server bumps on every save of a line;
 *   the conversion factor carries its own count, `conversionVersion`, bumped only by a save of the
 *   factor (issue #375), so a change to the factor on the Combined Allocation page never refuses a
 *   budget line on the Budget page, nor the other way round.
 * - A recruitment's hiring target carries the value the page last saw (`expected`); the server
 *   applies the save only if that is still the stored value.
 *
 * While a box is being edited (from its first keystroke until it loses focus; `startEditing` and
 * `stopEditing`), its saves keep the count or value it started from, whatever a background refresh
 * brings meanwhile (issue #426), and only this tab's own saves move it on. So a value changed in
 * another tab while the admin is typing over it is still refused, and the admin is asked.
 *
 * A refused save changes nothing. It leaves a {@link BudgetConflict} saying what is stored now and
 * what the user entered. Further typing in that box is remembered but not sent, until the user
 * chooses `takeTheirs` or `overwrite`. A refused budget line also brings the whole
 * summary up to date, so the page shows what is stored.
 */
export function useBudgetSaves(
  yyyyq: string | null,
  summary: BudgetSummary | null | undefined,
  headers: Record<string, string>,
  /**
   * When the summary was last read (react-query's `dataUpdatedAt`). A re-read whose answer is the
   * same as before keeps the same summary object, and is still news to a box that has stopped
   * being edited since (issue #426).
   */
  readAt: number,
) {
  const queryClient = useQueryClient();
  const held = useRef<Held>({
    version: 0,
    conversionVersion: 0,
    editing: {},
    pins: {},
    expected: {},
    recruitmentIds: {},
    conflicts: {},
    typed: {},
    stored: {},
    queue: Promise.resolve(),
  });
  const [conflicts, setConflicts] = useState<BudgetConflict[]>([]);

  /** Takes each count from a summary, never back down. */
  const learnCounts = (budget: BudgetRow) => {
    const state = held.current;
    state.version = Math.max(state.version, budget.version);
    state.conversionVersion = Math.max(
      state.conversionVersion,
      budget.conversionVersion,
    );
  };

  // What the page knows comes from every summary it gets for the quarter, the background refresh's
  // included (issue #426; the page is made afresh for each quarter, so nothing carries over from
  // another). The counts only go up, so a refetch that began before one of this page's own saves
  // finished cannot take them back. A box that is not being edited shows the summary's value, so
  // that is what its next save expects; a box being edited keeps what it started from (`pins`, and
  // `expected` left alone), so a change made in another tab meanwhile is still refused.
  useEffect(() => {
    if (!summary) {
      return;
    }
    const state = held.current;
    learnCounts(summary.budget);
    (["ta", "ula"] as const).forEach((side) => {
      const row = summary[side];
      if (row === null) {
        return;
      }
      const key: FieldKey = `target-${side}`;
      state.recruitmentIds[key] = row.recruitmentId;
      if (!state.editing[key]) {
        state.expected[key] = String(row.totalHiringTarget);
        // What Use theirs takes, should the box be in conflict: what the page now shows.
        state.stored[key] = String(row.totalHiringTarget);
      }
    });
  }, [summary, readAt]);

  /** The count a save of this line carries: the one it started from while it is being edited. */
  const countFor = (line: BudgetLine): number =>
    held.current.pins[line] ?? held.current[counterOf(line)];

  /**
   * This tab's own save moved a count from `sent` to `now`: every box being edited that started
   * from `sent` has seen nothing else change since, so it moves on with it. A box that started from
   * an older count keeps it, since someone else changed the budget after it began.
   */
  const advancePins = (counter: Counter, sent: number, now: number) => {
    const pins = held.current.pins;
    (Object.keys(pins) as BudgetLine[]).forEach((line) => {
      if (counterOf(line) === counter && pins[line] === sent) {
        pins[line] = now;
      }
    });
  };

  /** A keystroke in a box (issue #426): the first one pins the count the box started from. */
  const startEditing = (field: FieldKey) => {
    const state = held.current;
    state.editing[field] = true;
    // Stryker disable next-line ConditionalExpression : a recruitment figure's pin would never be read, as its save carries `expected` instead
    if (isLine(field)) {
      state.pins[field] ??= state[counterOf(field)];
    }
  };

  /** The box lost focus: it shows the stored value again, and saves from what is stored. */
  const stopEditing = (field: FieldKey) => {
    const state = held.current;
    delete state.editing[field];
    delete state.pins[field];
  };

  const show = () => setConflicts(Object.values(held.current.conflicts));

  const request = (
    field: FieldKey,
    value: string,
    count: number | undefined,
  ): AxiosRequestConfig => {
    const state = held.current;
    if (isLine(field)) {
      // Each figure carries the count that guards it, and only that one (issue #375).
      return {
        method: "PUT",
        url: BUDGET_KEY,
        params: { quarter: yyyyq, [field]: value, [counterOf(field)]: count },
        headers,
      };
    }
    return {
      method: "PUT",
      url: TARGET_URL,
      params: {
        id: state.recruitmentIds[field],
        totalHiringTarget: Number(value),
        expected: state.expected[field],
      },
    };
  };

  /** Records a refused save: what is stored now, and what the user entered. */
  const refused = (field: FieldKey, value: string, error: Refusal) => {
    const state = held.current;
    const data = error.response.data;
    let current: number;
    if (isLine(field)) {
      // The answer is the whole summary as it now stands: the page shows it, and its counts are the ones the next saves carry.
      queryClient.setQueryData([BUDGET_KEY, yyyyq], data?.summary);
      // A line not yet entered (null) reads as zero, like a missing answer.
      current = data?.summary?.budget[field] ?? 0;
    } else {
      queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] });
      current = data?.recruitment?.totalHiringTarget ?? 0;
      state.stored[field] = String(current);
    }
    state.typed[field] = value;
    state.conflicts[field] = {
      field,
      name: NAMES[field],
      current: reads(field, current),
      entered: reads(field, value),
    };
    show();
  };

  const enqueue = (field: FieldKey, value: string) => {
    const state = held.current;
    state.queue = state.queue.then(async () => {
      const sent = isLine(field) ? countFor(field) : undefined;
      try {
        const response = await axios(request(field, value, sent));
        if (isLine(field)) {
          queryClient.setQueryData([BUDGET_KEY, yyyyq], response.data);
          const answer = (response.data as BudgetSummary).budget;
          learnCounts(answer);
          const counter = counterOf(field);
          advancePins(counter, sent as number, answer[counter]);
        } else {
          state.expected[field] = value;
          // Issue #391: the target's change is audited; an open Audit Trail card shows it.
          queryClient.invalidateQueries({
            queryKey: [HIRING_TARGET_AUDIT_KEY],
          });
        }
        queryClient.invalidateQueries({ queryKey: [BUDGET_KEY] });
      } catch (error) {
        if (isConflict(error)) {
          refused(field, value, error as Refusal);
        } else if (shouldToastBackendError(error)) {
          toast(`${error}`);
        } else {
          console.error("Backend request failed", error);
        }
      }
    });
  };

  /** Saves a valid value as it is typed; while the figure is in conflict it is only remembered. */
  const save = (field: FieldKey, value: string) => {
    const state = held.current;
    const open = state.conflicts[field];
    if (open) {
      state.typed[field] = value;
      state.conflicts[field] = { ...open, entered: reads(field, value) };
      show();
    } else {
      enqueue(field, value);
    }
  };

  /** Settles a conflict, taking the stored value as the one the next save expects. */
  const settle = (field: FieldKey) => {
    const state = held.current;
    delete state.conflicts[field];
    // Whatever was being typed is settled too: the next save starts from what is stored now.
    stopEditing(field);
    // Only a recruitment figure has a stored value to expect; for a budget line this is unused.
    state.expected[field] = state.stored[field];
    show();
  };

  /** Keep what is stored: drop what was typed. */
  const takeTheirs = (field: FieldKey) => settle(field);

  /** Save what was typed over what is stored. */
  const overwrite = (field: FieldKey) => {
    const value = held.current.typed[field];
    settle(field);
    enqueue(field, value as string);
  };

  return { conflicts, save, takeTheirs, overwrite, startEditing, stopEditing };
}
