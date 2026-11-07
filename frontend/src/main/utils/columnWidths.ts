/**
 * Widths of the long free-text columns (issue #342): the answers an admin has to read, which are
 * hard to read in a narrow column. They start at 400px, can be dragged (or, from the keyboard,
 * nudged) down to 200px and as wide as the admin likes. Any table built on OurTable gets the
 * handle and these widths by giving the column `wideColumnProps(id)`.
 */
export const WIDE_COLUMN_DEFAULT_WIDTH = 400;
export const WIDE_COLUMN_MIN_WIDTH = 200;
export const WIDE_COLUMN_MAX_WIDTH = Number.MAX_SAFE_INTEGER;

/**
 * The ids of the application answers that are long text, in both the TA and the ULA form: Other
 * Courses of Interest, Topic Proficiencies, Interests (ULA only), Previous Experience, Anything
 * Else, Post-Application Comments and Admin Comments.
 */
export const WIDE_COLUMN_IDS: readonly string[] = [
  "courseInterests",
  "topicProficiencies",
  "interests",
  "prevExperience",
  "comments",
  "postApplicationComments",
  "adminComments",
];

export const isWideColumnId = (id: string): boolean =>
  WIDE_COLUMN_IDS.includes(id);

/** TanStack column options that make a column wide and resizable; nothing for any other id. */
export const wideColumnProps = (
  id: string,
): {
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableResizing?: boolean;
} =>
  isWideColumnId(id)
    ? {
        size: WIDE_COLUMN_DEFAULT_WIDTH,
        minSize: WIDE_COLUMN_MIN_WIDTH,
        maxSize: WIDE_COLUMN_MAX_WIDTH,
        enableResizing: true,
      }
    : {};

/**
 * The widest UCSB course number is 13 characters including the space, "XXXXXXX 999XX" (issue #358):
 * a 7-letter subject area, a space and a 3-digit number with up to two letters.
 */
export const COURSE_NUMBER_CHARACTERS = "XXXXXXX 999XX".length;

/**
 * The width of a course number's cell contents: exactly {@link COURSE_NUMBER_CHARACTERS}
 * characters of the monospaced font it is shown in, so the column is just wide enough for the
 * widest course number, whether or not any course in the table has one that long.
 */
export const COURSE_NUMBER_WIDTH = `${COURSE_NUMBER_CHARACTERS}ch`;
