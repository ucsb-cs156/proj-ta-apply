import { Button, Card } from "react-bootstrap";
import { Link } from "react-router";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

export type AllocationTarget = { id: number } | undefined;

type AdminBudgetCardProps = {
  /** The quarter as yyyyq, such as "20261". */
  quarter: string;
  /** The quarter's TA recruitment, if it has one. */
  ta?: AllocationTarget;
  /** The quarter's ULA recruitment, if it has one. */
  ula?: AllocationTarget;
  testIdPrefix?: string;
};

/**
 * The label of the card's allocation button (issue #358): which recruitments the quarter has, since
 * the Combined Allocation page shows the columns of each. A quarter with neither (which the home
 * page never shows, as the card only appears above a recruitment's card) gets the full label.
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
 * The "QXX Budget" card the admin home page puts above each quarter's recruitment cards
 * (issue #357): a Budget Planning link to the quarter's Budget page, and one button to the
 * quarter's Combined Allocation page, /admin/allocations/QXX (issue #358), labelled by the
 * recruitments the quarter has: "Allocate TA slots to Courses", "Allocate ULA slots to Courses" or
 * "Allocate TA and ULA slots to Courses". With neither recruitment the button is greyed out and
 * does nothing.
 */
export default function AdminBudgetCard({
  quarter,
  ta,
  ula,
  testIdPrefix = "AdminBudgetCard",
}: AdminBudgetCardProps): React.JSX.Element {
  const qyy = yyyyqToQyy(quarter);
  const id = (suffix: string) => `${testIdPrefix}-${qyy}-${suffix}`;
  const hasTa = ta !== undefined;
  const hasUla = ula !== undefined;
  const label = allocateLabel(hasTa, hasUla);

  return (
    <Card className="mb-2 w-100 bg-light" data-testid={id("card")}>
      <Card.Body className="d-flex align-items-center flex-wrap gap-2 py-2">
        <strong className="fs-5 me-2" data-testid={id("title")}>
          {qyy} Budget
        </strong>
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
      </Card.Body>
    </Card>
  );
}
