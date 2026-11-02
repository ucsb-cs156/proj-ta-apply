import {
  nextQuarter,
  quarterOfDate,
  toNumericYYYYQ,
  yyyyqToQyy,
} from "main/utils/quarterUtilities";
import { toIsoDate } from "main/utils/workingDays";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

/**
 * Helpers for the developer-mode "Auto Create Recruitments" button (issue #218): which quarter to
 * propose, what would be created for it, and the dates the new recruitments get.
 */

/** The tentative opening date is this many days after today, and the primary consideration date as many after that. */
export const WEEK_IN_DAYS = 7;

/**
 * The quarter after the one today falls in, skipping Summer: Winter goes to Spring, Spring and
 * Summer to Fall, and Fall to Winter of the next year. As YYYYQ.
 */
export const nextNonSummerQuarter = (today: Date = new Date()): string => {
  const next = nextQuarter(toNumericYYYYQ(quarterOfDate(today)));
  return String(next % 10 === 3 ? nextQuarter(next) : next);
};

/** The quarter before `yyyyq` (YYYYQ as a number): Winter goes back to Fall of the year before. */
const previousQuarter = (yyyyq: number): number =>
  yyyyq % 10 === 1 ? yyyyq - 10 + 3 : yyyyq - 1;

/**
 * The quarters the selector offers: the four before the one today falls in (a full academic year,
 * so there are courses to work with) through the one after it, or the two after it in Spring, when
 * both the Summer and Fall schedules are available. As YYYYQ strings, oldest first.
 */
export const selectableQuarters = (today: Date = new Date()): string[] => {
  const current = toNumericYYYYQ(quarterOfDate(today));
  const quarters: number[] = [current];
  for (let i = 0; i < 4; i++) {
    quarters.unshift(previousQuarter(quarters[0]));
  }
  const after = current % 10 === 2 ? 2 : 1;
  for (let i = 0; i < after; i++) {
    quarters.push(nextQuarter(quarters[quarters.length - 1]));
  }
  return quarters.map(String);
};

/** The date `days` calendar days after `from`, as YYYY-MM-DD. */
export const calendarDaysFrom = (from: Date, days: number): string =>
  toIsoDate(
    new Date(from.getFullYear(), from.getMonth(), from.getDate() + days),
  );

export type AutoCreatePlan = {
  /** YYYYQ */
  quarter: string;
  /** QYY, e.g. "F27" */
  qyy: string;
  /** Today plus a week. */
  tentativeOpeningDate: string;
  /** The tentative opening date plus a week. */
  primaryConsiderationDate: string;
  /** True when a TA recruitment for the quarter exists already, so none will be created. */
  taExists: boolean;
  ulaExists: boolean;
  /** Both exist: nothing to create. */
  nothingToCreate: boolean;
};

/** What clicking Create Recruitments would do for a quarter, given the recruitments on file. */
export const planAutoCreate = (
  recruitments: Pick<Recruitment, "quarter" | "type">[],
  quarter: string,
  today: Date = new Date(),
): AutoCreatePlan => {
  const exists = (type: "TA" | "ULA") =>
    recruitments.some((r) => r.quarter === quarter && r.type === type);
  const taExists = exists("TA");
  const ulaExists = exists("ULA");
  return {
    quarter,
    qyy: yyyyqToQyy(quarter),
    tentativeOpeningDate: calendarDaysFrom(today, WEEK_IN_DAYS),
    primaryConsiderationDate: calendarDaysFrom(today, 2 * WEEK_IN_DAYS),
    taExists,
    ulaExists,
    nothingToCreate: taExists && ulaExists,
  };
};
