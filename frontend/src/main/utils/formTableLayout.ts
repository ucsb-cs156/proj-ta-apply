/**
 * Layout for the application's selection tables (topic proficiencies, interests and course
 * interests; issue #194), on the form and, read-only, in the application summary (issue #443): the
 * table is only as wide as its content, the label column takes its natural width, and the choice
 * columns are all the same width so the radio buttons line up and sit next to their labels rather
 * than far across the page. The classes other than Bootstrap's are in index.css.
 */

/** On the table: Bootstrap's `w-auto` so it shrinks to its content instead of filling the page. */
export const SELECTION_TABLE_CLASS = "align-middle w-auto";

/** Also on a read-only table, whose radio buttons are disabled but drawn at full strength. */
export const READ_ONLY_SELECTION_TABLE_CLASS = "selection-table-read-only";

/**
 * On the label column's heading and cells: as wide as the widest label, on one line. It sets no
 * width, which in this auto-width table would stretch the table (issue #451).
 */
export const LABEL_CELL_CLASS = "selection-table-label";

/** Also on a course label cell: monospace with its spaces kept, so padded course ids line up. */
export const COURSE_LABEL_CELL_CLASS = "selection-table-course";

/** On each choice column's heading: every choice column is 8em wide; long headings wrap. */
export const CHOICE_CELL_CLASS = "selection-table-choice";

/**
 * Also on each of the course table's choice columns: a little wider, so "Not Applicable /" fits on
 * one line above "Not Interested" rather than breaking after every word.
 */
export const COURSE_CHOICE_CELL_CLASS = "selection-table-course-choice";

/** A name as it appears in a row's test id: each run of spaces made a hyphen. */
export const rowSlug = (name: string): string => name.replace(/\s+/g, "-");
