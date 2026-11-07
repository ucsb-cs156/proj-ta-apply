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
 * A course number as the Combined Allocation table shows it (issue #383): the subject area, one
 * space, and the number with its digits right-justified in three columns, so the digits of
 * "CMPSC   8" and "CMPSC 190DD" line up as they do in the UCSB API's padded form ("CMPSC     8",
 * "CMPSC   190DD": an eight-column subject area field, then three digit columns and the letters).
 * Only the subject area field's padding goes, which for CMPSC was three spaces no one needs; the
 * unpadded "CMPSC 8" of the catalog comes out the same way.
 */
export const compactCourseNumber = (courseId: string): string => {
  const [subject, ...rest] = courseId.trim().split(/\s+/);
  const number = rest.join(" ").replace(/^\d+/, (digits) => digits.padStart(3));
  return number === "" ? subject : `${subject} ${number}`;
};

/**
 * The widest course number the Combined Allocation table shows, "CMPSC 190DD": the subject area
 * this app manages (CMPSC, `app.subjectArea`), a space, and a 3-digit number with up to two letters,
 * in the form of {@link compactCourseNumber}: 11 characters. Until issue #383 the cell kept the
 * API's padded form and was 13 (a 7-letter subject area field, a space, "999XX").
 */
export const COURSE_NUMBER_CHARACTERS = "CMPSC 190DD".length;

/**
 * The width of a course number's cell contents: exactly {@link COURSE_NUMBER_CHARACTERS}
 * characters of the monospaced font it is shown in, so the column is just wide enough for the
 * widest course number, whether or not any course in the table has one that long. (A longer
 * subject area, if one were configured, widens the cell: it is a minimum, and the text never wraps.)
 */
export const COURSE_NUMBER_WIDTH = `${COURSE_NUMBER_CHARACTERS}ch`;
