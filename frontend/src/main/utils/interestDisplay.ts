/**
 * How a cell that carries a faculty ranking shows the applicant's own interest in the course
 * (issue #199): a pastel background and, for readers who cannot tell the colours apart, a symbol at
 * the left of the cell. The preference strings are the ones the backend sends as a candidate's
 * "preference" and in an assignment row's "preferences".
 */

export const FIRST_CHOICE = "1st Choice";
export const SECOND_CHOICE = "2nd Choice";
export const ENTHUSIASTIC = "Enthusiastic";
export const WOULD_CONSIDER = "Would Consider";
/** What the backend sends for an applicant who marked the course Not Interested, or nothing. */
export const NOT_INTERESTED = "Not Interested";

/** The label shown wherever the not-interested answer is spelled out in full. */
export const NOT_INTERESTED_LABEL = "Not Interested/Not Applicable";

/** Bootstrap's pastel success, warning and danger backgrounds. */
export const LIGHT_GREEN = "#d1e7dd";
export const PALE_YELLOW = "#fff3cd";
export const PALE_RED = "#f8d7da";

export type InterestDisplay = {
  /** The cell's background colour. */
  background: string;
  /** The symbol at the left of the cell. */
  symbol: string;
  /** ➊ and ➋ are shown at 120% of the cell's font size; the rest at the cell's size. */
  large: boolean;
  /** What the colour and symbol mean, for a tooltip and for screen readers. */
  description: string;
};

/**
 * The display for a preference; anything that is not a choice, Enthusiastic or Would Consider
 * (including null, undefined and "Not Interested") is the not-interested display.
 */
export const interestDisplay = (
  preference: string | null | undefined,
): InterestDisplay => {
  switch (preference) {
    case FIRST_CHOICE:
      return {
        background: LIGHT_GREEN,
        symbol: "➊",
        large: true,
        description: "Applicant's 1st choice",
      };
    case SECOND_CHOICE:
      return {
        background: LIGHT_GREEN,
        symbol: "➋",
        large: true,
        description: "Applicant's 2nd choice",
      };
    case ENTHUSIASTIC:
      return {
        background: LIGHT_GREEN,
        symbol: "✓",
        large: false,
        description: "Applicant is enthusiastic about this course",
      };
    case WOULD_CONSIDER:
      return {
        background: PALE_YELLOW,
        symbol: "▬",
        large: false,
        description: "Applicant would consider this course",
      };
    default:
      return {
        background: PALE_RED,
        symbol: "✖",
        large: false,
        description: `Applicant marked this course ${NOT_INTERESTED_LABEL}`,
      };
  }
};

/** The legend under a table of rankings, in the order of the preferences. */
export const INTEREST_LEGEND: { preference: string; label: string }[] = [
  { preference: FIRST_CHOICE, label: "1st choice" },
  { preference: SECOND_CHOICE, label: "2nd choice" },
  { preference: ENTHUSIASTIC, label: "Enthusiastic" },
  { preference: WOULD_CONSIDER, label: "Would Consider" },
  { preference: NOT_INTERESTED, label: NOT_INTERESTED_LABEL },
];

/** The red message beside the opt-in checkbox on the ranking page. */
export const NOT_INTERESTED_WARNING =
  "Consider whether you should rank candidates that did not express interest in your course";

/** The checkbox's label on the ranking page. */
export const INCLUDE_NOT_INTERESTED_LABEL = `Include candidates that marked my course with "${NOT_INTERESTED_LABEL}"`;
