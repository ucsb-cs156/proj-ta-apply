/**
 * Column presentation shared by the course tables (the Recruitment Courses table and the Combined
 * Allocation table, issue #358).
 */

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

/** A column no wider than its values. */
export const shrinkToContent = {
  style: { width: "1%", whiteSpace: "nowrap" as const },
};

/** Numbers line up on the right (issue #185). */
export const numeric = {
  style: { ...shrinkToContent.style, textAlign: "right" as const },
};
