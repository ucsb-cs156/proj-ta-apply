import { Dropdown, Form, OverlayTrigger, Tooltip } from "react-bootstrap";

export type ColumnChoice = {
  id: string;
  label: string;
  /**
   * Show the label in a monospace font with its spaces kept, for labels padded to line up (the
   * Assignments page's lectures, issue #355). The label itself stays plain text for the "hide"
   * links' accessible names.
   */
  monospace?: boolean;
};

/** A per-course column and whether its course has met its hiring target (assigned >= target). */
export type CourseColumn = { id: string; complete: boolean };

/** What the "Show Only Incomplete Courses" action says it does, for its tooltip. */
export const INCOMPLETE_COURSES_TOOLTIP =
  "This will hide all course columns except the ones where the number of assigned TAs/ULAs is currently less than the hiring target.";

type ColumnVisibilityControlProps = {
  /** Every column that may be hidden, in table order. */
  choices: ColumnChoice[];
  /** The ids currently hidden. */
  hidden: string[];
  onToggle: (columnId: string, hidden: boolean) => void;
  testIdPrefix?: string;
  /**
   * The per-course columns among the choices, when the page has them (the Assignments page). With
   * at least one, the menu also offers "Show All Courses" and "Show Only Incomplete Courses";
   * pages that leave it out never show those two actions.
   */
  courseColumns?: CourseColumn[];
};

/**
 * A "Columns" menu of checkboxes, one per hideable column (issue #185): unticking hides the column
 * and ticking brings it back. "Show All" shows every column at once and "Show None" hides them
 * all (the columns outside the menu, such as ids and action links, always stay). The menu stays
 * open while boxes are ticked, so several can be changed in one visit.
 */
export default function ColumnVisibilityControl({
  choices,
  hidden,
  onToggle,
  testIdPrefix = "ColumnVisibilityControl",
  courseColumns = [],
}: ColumnVisibilityControlProps): React.JSX.Element {
  const hiddenHere = choices.filter((choice) => hidden.includes(choice.id));
  const shownHere = choices.filter((choice) => !hidden.includes(choice.id));
  const setHidden = (ids: string[], shouldHide: boolean) =>
    ids
      .filter((id) => hidden.includes(id) === !shouldHide)
      .forEach((id) => onToggle(id, shouldHide));
  const tooltipId = `${testIdPrefix}-incomplete-courses-tooltip`;
  return (
    <Dropdown autoClose="outside" data-testid={testIdPrefix}>
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        id={`${testIdPrefix}-toggle`}
        data-testid={`${testIdPrefix}-toggle`}
      >
        Columns
        {hiddenHere.length > 0 && ` (${hiddenHere.length} hidden)`}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item
          as="button"
          disabled={hiddenHere.length === 0}
          onClick={() =>
            hiddenHere.forEach((choice) => onToggle(choice.id, false))
          }
          data-testid={`${testIdPrefix}-select-all`}
        >
          Show All
        </Dropdown.Item>
        <Dropdown.Item
          as="button"
          disabled={shownHere.length === 0}
          onClick={() =>
            shownHere.forEach((choice) => onToggle(choice.id, true))
          }
          data-testid={`${testIdPrefix}-select-none`}
        >
          Show None
        </Dropdown.Item>
        {courseColumns.length > 0 && (
          <>
            <Dropdown.Item
              as="button"
              onClick={() =>
                setHidden(
                  courseColumns.map((c) => c.id),
                  false,
                )
              }
              data-testid={`${testIdPrefix}-show-all-courses`}
            >
              Show All Courses
            </Dropdown.Item>
            <OverlayTrigger
              placement="left"
              overlay={
                <Tooltip id={tooltipId}>{INCOMPLETE_COURSES_TOOLTIP}</Tooltip>
              }
            >
              <Dropdown.Item
                as="button"
                aria-describedby={`${tooltipId}-text`}
                onClick={() => {
                  setHidden(
                    courseColumns.filter((c) => c.complete).map((c) => c.id),
                    true,
                  );
                  setHidden(
                    courseColumns.filter((c) => !c.complete).map((c) => c.id),
                    false,
                  );
                }}
                data-testid={`${testIdPrefix}-show-incomplete-courses`}
              >
                Show Only Incomplete Courses
              </Dropdown.Item>
            </OverlayTrigger>
            <span
              id={`${tooltipId}-text`}
              className="visually-hidden"
              data-testid={`${testIdPrefix}-show-incomplete-courses-description`}
            >
              {INCOMPLETE_COURSES_TOOLTIP}
            </span>
          </>
        )}
        <Dropdown.Divider />
        {choices.map((choice) => (
          <Dropdown.ItemText key={choice.id}>
            <Form.Check
              type="checkbox"
              id={`${testIdPrefix}-${choice.id}`}
              label={
                choice.monospace ? (
                  <span
                    className="font-monospace"
                    style={{ whiteSpace: "pre" }}
                    data-testid={`${testIdPrefix}-${choice.id}-label`}
                  >
                    {choice.label}
                  </span>
                ) : (
                  choice.label
                )
              }
              checked={!hidden.includes(choice.id)}
              onChange={(e) => onToggle(choice.id, !e.target.checked)}
              data-testid={`${testIdPrefix}-${choice.id}`}
            />
          </Dropdown.ItemText>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}
