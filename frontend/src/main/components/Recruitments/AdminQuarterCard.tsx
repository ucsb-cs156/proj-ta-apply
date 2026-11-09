import { Button, Card } from "react-bootstrap";
import { Link } from "react-router";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { useRememberedOpen } from "main/utils/useRememberedOpen";

export type AllocationTarget = { id: number } | undefined;

type AdminQuarterCardProps = {
  /** The quarter as yyyyq, such as "20261". */
  quarter: string;
  /** The quarter's TA recruitment, if it has one. */
  ta?: AllocationTarget;
  /** The quarter's ULA recruitment, if it has one. */
  ula?: AllocationTarget;
  /**
   * Whether the card starts open the first time this browser shows it (the home page opens the
   * newest quarter and closes the rest); after that it is as the admin left it.
   */
  defaultOpen?: boolean;
  /** The quarter's recruitment cards, shown while the card is open. */
  children?: React.ReactNode;
  testIdPrefix?: string;
};

/** The localStorage keys are this prefix and the quarter as QXX, such as "adminQuarterCard.W26". */
export const QUARTER_CARD_STORAGE_PREFIX = "adminQuarterCard.";

/**
 * The label of the card's allocation button (issue #358): which recruitments the quarter has, since
 * the Combined Allocation page shows the columns of each. A quarter with neither (which the home
 * page never shows, as the card only appears for a quarter that has a recruitment) gets the full
 * label.
 */
// eslint-disable-next-line react-refresh/only-export-components -- the label belongs with the card that shows it
export const allocateLabel = (hasTa: boolean, hasUla: boolean): string => {
  if (hasTa && !hasUla) {
    return "Allocate TA slots to Courses";
  }
  if (hasUla && !hasTa) {
    return "Allocate ULA slots to Courses";
  }
  return "Allocate TA and ULA slots to Courses";
};

/**
 * The admin home page's card for one quarter (issue #379; until then a flat "QXX Budget" card
 * above the quarter's recruitment cards, issue #357). Its header row is headed by the quarter as
 * QXX and has the quarter's three buttons: a Budget Planning link to the quarter's Budget page,
 * one button to the quarter's Combined Allocation page, /admin/allocations/QXX (issue #358),
 * labelled by the recruitments the quarter has: "Allocate TA slots to Courses", "Allocate ULA
 * slots to Courses" or "Allocate TA and ULA slots to Courses" (with neither the button is greyed
 * out and does nothing), and an Instructor Feedback link to /admin/instructorFeedback/QXX, the
 * instructors' feedback on the quarter's allocations (issue #427). The rest of the row is one button that opens and closes the card, so
 * clicking the row toggles it and clicking a button in it does not; it carries aria-expanded and
 * a caret. The quarter's TA and ULA recruitment cards are its children, nested inside its body,
 * which is not rendered while the card is closed. Whether it is open is remembered in this browser
 * per quarter (useRememberedOpen).
 */
export default function AdminQuarterCard({
  quarter,
  ta,
  ula,
  defaultOpen = false,
  children,
  testIdPrefix = "AdminQuarterCard",
}: AdminQuarterCardProps): React.JSX.Element {
  const qyy = yyyyqToQyy(quarter);
  const id = (suffix: string) => `${testIdPrefix}-${qyy}-${suffix}`;
  const hasTa = ta !== undefined;
  const hasUla = ula !== undefined;
  const label = allocateLabel(hasTa, hasUla);
  const [open, toggle] = useRememberedOpen(
    `${QUARTER_CARD_STORAGE_PREFIX}${qyy}`,
    defaultOpen,
  );

  return (
    <Card className="mb-3 w-100" data-testid={id("card")}>
      <Card.Header className="bg-light d-flex align-items-center flex-wrap p-0">
        <button
          type="button"
          className="btn btn-link flex-grow-1 text-start text-decoration-none text-reset d-flex align-items-center gap-2 px-3 py-2"
          aria-expanded={open}
          onClick={toggle}
          data-testid={id("toggle")}
        >
          <span aria-hidden="true" data-testid={id("caret")}>
            {open ? "▾" : "▸"}
          </span>
          <strong className="fs-5" data-testid={id("title")}>
            {qyy}
          </strong>
        </button>
        <div
          className="d-flex align-items-center flex-wrap gap-2 px-3 py-2"
          data-testid={id("buttons")}
        >
          <Link
            className="btn btn-outline-primary"
            to={`/admin/budget/${qyy}`}
            data-testid={id("budget")}
          >
            Budget Planning
          </Link>
          {hasTa || hasUla ? (
            <Link
              className="btn btn-outline-primary"
              to={`/admin/allocations/${qyy}`}
              data-testid={id("allocate")}
            >
              {label}
            </Link>
          ) : (
            <Button
              variant="outline-secondary"
              disabled
              aria-disabled="true"
              data-testid={id("allocate")}
            >
              {label}
            </Button>
          )}
          <Link
            className="btn btn-outline-primary"
            to={`/admin/instructorFeedback/${qyy}`}
            data-testid={id("instructorFeedback")}
          >
            Instructor Feedback
          </Link>
        </div>
      </Card.Header>
      {open && (
        <Card.Body className="pb-0" data-testid={id("body")}>
          {children}
        </Card.Body>
      )}
    </Card>
  );
}
