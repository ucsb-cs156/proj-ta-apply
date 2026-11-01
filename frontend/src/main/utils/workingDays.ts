/**
 * Working-day arithmetic for the faculty review deadline (issue #211): the default deadline when
 * reviews are opened is five working days (Monday to Friday) from today.
 */

/** How many working days ahead the default faculty ranking deadline is set. */
export const DEFAULT_DEADLINE_WORKING_DAYS = 5;

/** A date as the browser's local YYYY-MM-DD, the form a date box takes. */
export const toIsoDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * The date `days` working days after `from`: Saturdays and Sundays are skipped, and a start on a
 * weekend counts from the following Monday as day one.
 */
export const addWorkingDays = (from: Date, days: number): Date => {
  const result = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) {
      remaining -= 1;
    }
  }
  return result;
};

/** The default deadline for reviews opened today. */
export const defaultReviewDeadline = (today: Date = new Date()): string =>
  toIsoDate(addWorkingDays(today, DEFAULT_DEADLINE_WORKING_DAYS));

/**
 * Whether closing reviews today would be before the stated deadline (issue #211): true when the
 * deadline is a later date than today. No deadline, or one that is today or earlier, is not early.
 */
export const isBeforeDeadline = (
  deadline: string | null | undefined,
  today: Date = new Date(),
): boolean => deadline != null && deadline.localeCompare(toIsoDate(today)) > 0;
