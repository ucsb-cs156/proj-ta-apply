/**
 * Column presentation shared by the course tables (the Recruitment Courses table and the Combined
 * Allocation table, issue #358).
 */
import { Fragment } from "react";

/**
 * A heading on two lines in a smaller font (80% of the other headings), so a column is no wider
 * than its values (issue #185). The space before the break keeps the heading's text whole for
 * screen readers and tests.
 */
export const stacked = (top: string, bottom: string): React.JSX.Element => (
  <span style={{ fontSize: "80%" }}>
    {top} <br />
    {bottom}
  </span>
);

/** The size of the lines under a {@link stackedLead} heading's lead word, relative to the headings. */
export const STACKED_LEAD_REST_FONT_SIZE = "70%";

/**
 * A heading whose first word stays at the headings' full size with the rest of its words under it,
 * each on its own line in a smaller font (issue #383): "TA" over "Allocation", or "TA" over
 * "Unrounded" over "Allocation". The column is then no wider than its widest word, and the lead
 * word (the type, TA or ULA) is what the eye picks out. The lines are blocks of their own so each
 * is only as tall as its small text; the heading is an inline block so a sort caret still follows
 * its last line. The space before each line keeps the heading's text whole ("TA Unrounded
 * Allocation") for tests and screen readers, and the title repeats the whole phrase on hover.
 */
export const stackedLead = (
  lead: string,
  ...rest: string[]
): React.JSX.Element => (
  <span
    title={[lead, ...rest].join(" ")}
    style={{ display: "inline-block", lineHeight: 1.2 }}
  >
    {lead}
    {rest.map((line) => (
      <Fragment key={line}>
        {" "}
        <span
          style={{ display: "block", fontSize: STACKED_LEAD_REST_FONT_SIZE }}
        >
          {line}
        </span>
      </Fragment>
    ))}
  </span>
);

/** A column no wider than its values. */
export const shrinkToContent = {
  style: { width: "1%", whiteSpace: "nowrap" as const },
};

/** Numbers line up on the right (issue #185). */
export const numeric = {
  style: { ...shrinkToContent.style, textAlign: "right" as const },
};
