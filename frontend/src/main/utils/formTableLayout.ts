import type { CSSProperties } from "react";

/**
 * Layout for the application form's selection tables (topic proficiencies, interests and course
 * interests; issue #194): the table is only as wide as its content, the label column takes its
 * natural width, and the choice columns are all the same width so the radio buttons line up and
 * sit next to their labels rather than far across the page.
 */

/** On the table: Bootstrap's `w-auto` so it shrinks to its content instead of filling the page. */
export const SELECTION_TABLE_CLASS = "align-middle w-auto";

/** On the label column's heading and cells: as wide as the widest label, on one line. */
export const LABEL_CELL_STYLE: CSSProperties = {
  width: "1%",
  whiteSpace: "nowrap",
};

/** Every choice column is this wide, whatever its heading says; long headings wrap. */
export const CHOICE_COLUMN_WIDTH = "8em";

/** On each choice column's heading. */
export const CHOICE_CELL_STYLE: CSSProperties = {
  width: CHOICE_COLUMN_WIDTH,
  whiteSpace: "normal",
};
