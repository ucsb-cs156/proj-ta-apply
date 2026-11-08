/**
 * The width of the progress thermometer: 600px, or 80% of its container when that is less (issue
 * #315), so it fits a phone as well as a desktop screen.
 */
export const THERMOMETER_WIDTH = { width: "80%", maxWidth: "600px" };

/** The fill is wide enough to carry the percentage from this share on; below it, the text sits beside it. */
export const LABEL_INSIDE_FROM = 20;

/** A count as a non-negative finite number: undefined, NaN, Infinity and negatives read as 0. */
const safeCount = (value: number | undefined): number => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
};

/** What a progress thermometer shows. */
export type ThermometerFigures = {
  done: number;
  target: number;
  /** The percentage of the target reached, rounded; over 100 when more is done than asked. */
  percent: number;
  /** The share of the bar that is filled: the percentage, capped at 100. */
  fill: number;
  /** False when the target is 0 or missing: no target has been set yet. */
  hasTarget: boolean;
};

/**
 * The numbers the thermometer shows (also for the pages that word a sentence from them): the
 * percentage of the target reached, rounded, with the fill capped at 100% when more has been done
 * than the target asked for; a target of 0 is "no target".
 */
export const thermometerFigures = (
  numerator: number,
  denominator: number | undefined,
): ThermometerFigures => {
  const done = safeCount(numerator);
  const target = safeCount(denominator);
  const hasTarget = target > 0;
  const percent = hasTarget ? Math.round((100 * done) / target) : 0;
  return { done, target, percent, fill: Math.min(100, percent), hasTarget };
};
