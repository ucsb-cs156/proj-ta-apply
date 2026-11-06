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
 * The "QXX Budget" card the admin home page puts above each quarter's recruitment cards
 * (issue #357): a link to the quarter's Budget page and to the Edit Courses (allocations) page
 * of its TA and of its ULA recruitment. An allocations button is greyed out and does nothing
 * when the quarter has no recruitment of that type.
 */
export default function AdminBudgetCard({
  quarter,
  ta,
  ula,
  testIdPrefix = "AdminBudgetCard",
}: AdminBudgetCardProps): React.JSX.Element {
  const qyy = yyyyqToQyy(quarter);
  const id = (suffix: string) => `${testIdPrefix}-${qyy}-${suffix}`;

  const allocations = (
    label: string,
    suffix: string,
    target: AllocationTarget,
  ) =>
    target === undefined ? (
      <Button
        variant="outline-secondary"
        disabled
        aria-disabled="true"
        data-testid={id(suffix)}
      >
        {label}
      </Button>
    ) : (
      <Link
        className="btn btn-outline-primary"
        to={`/admin/recruitments/${target.id}/courses/edit`}
        data-testid={id(suffix)}
      >
        {label}
      </Link>
    );

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
          Budget
        </Link>
        {allocations("TA allocations", "ta-allocations", ta)}
        {allocations("ULA allocations", "ula-allocations", ula)}
      </Card.Body>
    </Card>
  );
}
