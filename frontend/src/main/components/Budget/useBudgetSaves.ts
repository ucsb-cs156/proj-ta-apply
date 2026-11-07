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
 * A refused save changes nothing. It leaves a {@link BudgetConflict} saying what is stored now and
 * what the user entered. Further typing in that box is remembered but not sent, until the user
 * chooses `takeTheirs` or `overwrite`. A refused budget line also brings the whole
 * summary up to date, so the page shows what is stored.
 */
export function useBudgetSaves(
  yyyyq: string | null,
  summary: BudgetSummary | null | undefined,
  headers: Record<string, string>,
) {
  const queryClient = useQueryClient();
  const held = useRef<Held>({
    version: 0,
    conversionVersion: 0,
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

  // What the page knows starts from the first summary it gets for the quarter (the page is made
  // afresh for each quarter, so this never carries over from another). After that the
  // counts only go up, and a recruitment's figure is only taken the first time, so that a
  // refetch that began before one of this page's own saves finished cannot take either back.
  useEffect(() => {
    if (!summary) {
      return;
    }
    const state = held.current;
    learnCounts(summary.budget);
    // The first value seen for a figure is the one the next save expects.
    const learn = (key: FieldKey, value: string | undefined) => {
      if (!(key in state.expected)) {
        state.expected[key] = value;
      }
    };
    (["ta", "ula"] as const).forEach((side) => {
      const row = summary[side];
      if (row === null) {
        return;
      }
      state.recruitmentIds[`target-${side}`] = row.recruitmentId;
      learn(`target-${side}`, String(row.totalHiringTarget));
    });
  }, [summary]);

  const show = () => setConflicts(Object.values(held.current.conflicts));

  const request = (field: FieldKey, value: string): AxiosRequestConfig => {
    const state = held.current;
    if (isLine(field)) {
      // Each figure carries the count that guards it, and only that one (issue #375).
      const count =
        field === "conversionTAtoULA"
          ? { conversionVersion: state.conversionVersion }
          : { version: state.version };
      return {
        method: "PUT",
        url: BUDGET_KEY,
        params: { quarter: yyyyq, [field]: value, ...count },
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
      try {
        const response = await axios(request(field, value));
        if (isLine(field)) {
          queryClient.setQueryData([BUDGET_KEY, yyyyq], response.data);
          learnCounts((response.data as BudgetSummary).budget);
        } else {
          state.expected[field] = value;
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

  return { conflicts, save, takeTheirs, overwrite };
}
