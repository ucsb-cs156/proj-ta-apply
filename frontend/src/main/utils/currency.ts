/**
 * Dollars and cents for the Budget for Quarter page (issue #177). Every amount of money in the app
 * is shown with a dollar sign, thousands separators and exactly two decimal places.
 */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$1,234.50"; negative amounts come out as "-$1,234.50". */
export const formatDollars = (amount: number): string => usd.format(amount);

/**
 * What may be typed into a money box: digits with an optional point and up to two decimals.
 * A leading dollar sign or commas are not accepted, so what is saved is what was typed.
 */
export const isValidDollars = (value: string): boolean =>
  /^\d+(\.\d{1,2})?$/.test(value);

/** A stored amount as it is put in the box: two decimals, no sign or separators. */
export const dollarsForInput = (amount: number | null | undefined): string =>
  amount == null ? "" : amount.toFixed(2);

/**
 * The bottom line as the design shows it: red with a minus sign when negative, green with a plus
 * sign when positive, and plain black "$0.00" when zero (including anything that rounds to zero).
 */
export const bottomLineDisplay = (
  amount: number,
): { text: string; className: string } => {
  const cents = Math.round(amount * 100);
  if (cents > 0) {
    return { text: `+${formatDollars(amount)}`, className: "text-success" };
  }
  if (cents < 0) {
    return { text: formatDollars(amount), className: "text-danger" };
  }
  return { text: formatDollars(0), className: "" };
};

/**
 * The overall students-per-position ratio as "1:n", n rounded to a whole number; a dash when the
 * backend has no ratio (no enrollment estimates yet).
 */
export const overallRatioDisplay = (
  studentsPerPosition: number | null | undefined,
): string =>
  studentsPerPosition == null ? "—" : `1:${Math.round(studentsPerPosition)}`;
