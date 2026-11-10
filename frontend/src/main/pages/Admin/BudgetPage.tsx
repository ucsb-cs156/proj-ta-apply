import { Link, useNavigate, useParams } from "react-router";
import { Alert, Button, Col, Row, Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import SavedOnChangeInput from "main/components/Budget/SavedOnChangeInput";
import BudgetAuditTrailCard from "main/components/Budget/BudgetAuditTrailCard";
import type {
  BudgetSide,
  BudgetSummary,
} from "main/components/Budget/budgetTypes";
import {
  BUDGET_KEY,
  useBudgetSaves,
  type BudgetLine,
  type Side,
} from "main/components/Budget/useBudgetSaves";
import {
  MultipleTabsBanner,
  MultipleTabsModal,
  useClientActivity,
} from "main/concurrency";
import { useRefreshingBackend } from "main/utils/useRefreshingBackend";
import { SIDE_BY_SIDE_REFRESH_SEC } from "main/utils/refreshInterval";
import { qyyToYyyyq } from "main/utils/quarterUtilities";
import { isValidHiringTarget } from "main/utils/allocations";
import {
  bottomLineDisplay,
  dollarsForInput,
  formatDollars,
  isValidDollars,
  overallRatioDisplay,
  wholeForInput,
} from "main/utils/currency";

const TYPE_OF: Record<Side, "TA" | "ULA"> = { ta: "TA", ula: "ULA" };

/**
 * Admin → Budget for Quarter → one quarter: /admin/budget/:qyy (issue #177). The costs and funds
 * table (issue #388), every figure of it the quarter's budget row: the estimated cost per TA, the
 * ULA hourly rate and hours per quarter and their product, the estimated cost per ULA; the three
 * temp subzero lines and the other funds for ASEs.
 * Then the hiring targets of both recruitments beside what has been allocated so far, the
 * enrollment totals and ratios, and the anticipated expenses, funds and bottom line. Every box saves
 * as it is typed and the whole page recomputes from the backend. The summary is re-read in the
 * background about every 10 seconds (issue #426); what is being typed in a box stays. At the
 * bottom, closed by default, the Audit Trail card of the two hiring targets' changes (issue #391).
 */
export default function BudgetPage(): React.JSX.Element {
  const { qyy } = useParams();
  // Made afresh for each quarter, so nothing the page knows about one is taken for another's.
  return <BudgetForQuarter key={qyy} qyy={qyy} />;
}

function BudgetForQuarter({
  qyy,
}: {
  qyy: string | undefined;
}): React.JSX.Element {
  const yyyyq = qyyToYyyyq(qyy);

  // Re-read in the background about every 10 seconds (issue #426), so that a change made on the
  // Combined Allocation page in a window beside this one shows here without a click.
  const { data: summary, dataUpdatedAt } =
    useRefreshingBackend<BudgetSummary | null>(
      [BUDGET_KEY, yyyyq],
      { method: "GET", url: BUDGET_KEY, params: { quarter: yyyyq } },
      null,
      false,
      { enabled: yyyyq !== null },
      SIDE_BY_SIDE_REFRESH_SEC,
    );

  // Tells the server this tab is on this quarter's budget, and learns whether another one is
  // (issues #277, #284). It starts once the quarter is known to exist.
  const activity = useClientActivity({
    heartbeatUrl: summary ? `${BUDGET_KEY}/heartbeat?quarter=${yyyyq}` : null,
    leaveUrl: summary ? `${BUDGET_KEY}/leave?quarter=${yyyyq}` : null,
  });
  const navigate = useNavigate();
  const { conflicts, save, takeTheirs, overwrite, startEditing, stopEditing } =
    useBudgetSaves(yyyyq, summary, activity.headers, dataUpdatedAt);

  if (yyyyq === null) {
    return (
      <BasicLayout>
        <div className="pt-2" data-testid="BudgetPage">
          <h1>Budget for Quarter</h1>
          <p data-testid="BudgetPage-bad-quarter">
            &ldquo;{qyy}&rdquo; is not a quarter. Quarters are written as a
            letter and two digits, such as F26.{" "}
            <Link to="/admin/budget/selectQuarter">Choose a quarter</Link>.
          </p>
        </div>
      </BasicLayout>
    );
  }

  const header = (
    <>
      <h1>Budget for {qyy}</h1>
      <p>
        <Link to="/admin/budget/selectQuarter">Choose another quarter</Link>
        {" | "}
        <Link to={`/admin/allocations/${qyy}`}>Combined allocations</Link>
      </p>
    </>
  );

  if (!summary) {
    return (
      <BasicLayout>
        <div className="pt-2" data-testid="BudgetPage">
          {header}
          <p data-testid="BudgetPage-loading">Loading…</p>
        </div>
      </BasicLayout>
    );
  }

  const side = (which: Side): BudgetSide | null => summary[which];

  /**
   * A budget line's box (issue #388): whole dollars, except the ULA hourly rate, which is dollars
   * and cents; the hours per ULA have no dollar sign. The cost per TA is a budget line too, so it
   * is there to enter whether or not the quarter has a TA recruitment.
   */
  const budgetInput = (line: BudgetLine) => (
    <SavedOnChangeInput
      id={`BudgetPage-${line}`}
      prefix={line === "estimatedHoursPerULAPerQuarter" ? undefined : "$"}
      stored={
        line === "ulaRateDollarsPerHour"
          ? dollarsForInput(summary.budget[line])
          : wholeForInput(summary.budget[line])
      }
      isValid={isValidDollars}
      onSave={(amount) => save(line, amount)}
      onEdit={() => startEditing(line)}
      onEditEnd={() => stopEditing(line)}
    />
  );

  /** The label of a box, in a cell of its own. */
  const labelFor = (id: string, text: string) => (
    <label htmlFor={id} className="mb-0">
      {text}
    </label>
  );

  const ulaCost = summary.estimatedCostPerULAPerQuarter;

  /** One row of the costs and funds table: three cells of costs, a spacer, two of funds. */
  const costsAndFundsRow = (
    key: string,
    costLabel: React.ReactNode,
    rateOrHours: React.ReactNode,
    costPerQuarter: React.ReactNode,
    fundsLine: BudgetLine,
    fundsLabel: string,
  ) => (
    <tr data-testid={`BudgetPage-costs-funds-${key}`}>
      <td>{costLabel}</td>
      <td className="text-end">{rateOrHours}</td>
      <td className="text-end">{costPerQuarter}</td>
      <td className="px-4"></td>
      <td>{labelFor(`BudgetPage-${fundsLine}`, fundsLabel)}</td>
      <td className="text-end">{budgetInput(fundsLine)}</td>
    </tr>
  );

  const targetBlock = (which: Side) => {
    const type = TYPE_OF[which];
    const s = side(which);
    if (s === null) {
      return (
        <p data-testid={`BudgetPage-target-${which}-none`}>
          No {type} recruitment for {qyy}.
        </p>
      );
    }
    const difference = s.allocationDifference;
    const differenceText =
      difference > 0 ? `+${difference}` : String(difference);
    return (
      <div data-testid={`BudgetPage-target-${which}`}>
        <SavedOnChangeInput
          id={`BudgetPage-target-${which}-input`}
          label={`Total number of ${type}s expected to be hired:`}
          stored={String(s.totalHiringTarget)}
          isValid={isValidHiringTarget}
          width="6em"
          onSave={(target) => save(`target-${which}`, target)}
          onEdit={() => startEditing(`target-${which}`)}
          onEditEnd={() => stopEditing(`target-${which}`)}
        />
        <div data-testid={`BudgetPage-target-${which}-allocated`}>
          {type}s allocated to courses so far: {s.totalAllocation}
        </div>
        <div
          data-testid={`BudgetPage-target-${which}-difference`}
          className={difference === 0 ? "" : "text-danger fw-bold"}
        >
          Difference (allocated minus target): {differenceText}
        </div>
        {difference !== 0 && (
          <div
            className="text-danger"
            data-testid={`BudgetPage-target-${which}-mismatch`}
          >
            The allocations do not add up to the target. Adjust them on the{" "}
            <Link to={`/admin/recruitments/${s.recruitmentId}/courses/edit`}>
              {type} Recruitment Courses page
            </Link>
            .
          </div>
        )}
      </div>
    );
  };

  const enrollmentBlock = (which: Side) => {
    const type = TYPE_OF[which];
    const s = side(which);
    if (s === null) {
      return null;
    }
    return (
      <div data-testid={`BudgetPage-enrollment-${which}`}>
        <div data-testid={`BudgetPage-enrollment-${which}-total`}>
          Total enrollment estimate for {type} courses:{" "}
          {s.totalEnrollmentEstimate}
        </div>
        <div data-testid={`BudgetPage-enrollment-${which}-ratio`}>
          Overall {type}:student ratio:{" "}
          {overallRatioDisplay(s.studentsPerPosition)}
        </div>
      </div>
    );
  };

  const costRow = (which: Side) => {
    const type = TYPE_OF[which];
    const s = side(which);
    return (
      <tr data-testid={`BudgetPage-expenses-${which}`}>
        <td>Total anticipated cost for {type}s</td>
        <td className="text-end">{formatDollars(s?.anticipatedCost ?? 0)}</td>
      </tr>
    );
  };

  const bottom = bottomLineDisplay(summary.bottomLine);

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="BudgetPage">
        {header}
        <MultipleTabsBanner
          others={activity.others}
          noun="budget page"
          audience="admin"
          newest={activity.newest}
          testId="BudgetPage-multiple-tabs"
        />
        {/* Only the newest tab is asked; the older ones keep the banner alone. */}
        <MultipleTabsModal
          others={activity.others}
          newest={activity.newest}
          arrivedAt={activity.arrivedAt}
          noun="budget page"
          audience="admin"
          onLeave={() => {
            activity.leave();
            navigate("/");
          }}
          testId="BudgetPage-multiple-tabs-modal"
        />
        {conflicts.map((conflict) => (
          <Alert
            key={conflict.field}
            variant="warning"
            data-testid={`BudgetPage-conflict-${conflict.field}`}
          >
            <span data-testid={`BudgetPage-conflict-${conflict.field}-message`}>
              The {conflict.name} was changed in another tab or window. It is
              now {conflict.current}; you entered {conflict.entered}.
            </span>
            <Button
              className="ms-2"
              size="sm"
              variant="outline-secondary"
              data-testid={`BudgetPage-conflict-${conflict.field}-theirs`}
              onClick={() => takeTheirs(conflict.field)}
            >
              Use theirs
            </Button>
            <Button
              className="ms-2"
              size="sm"
              variant="warning"
              data-testid={`BudgetPage-conflict-${conflict.field}-overwrite`}
              onClick={() => overwrite(conflict.field)}
            >
              Overwrite
            </Button>
          </Alert>
        ))}
        <>
          <h2 className="h4 mt-3">Costs and funds</h2>
          <p className="small">
            The estimated cost per ULA per quarter is the ULA hourly rate times
            the estimated hours per ULA. Any of the three temp subzero lines may
            be zero in a given quarter; other funds available for ASEs, such as
            gift funds, count towards the total funds. For planning, the
            restricted lines (TAs only, ULAs only) are spent first and anything
            further comes from the unrestricted pool.{" "}
            <Link to="/help/admins#budget">More about these figures</Link>.
          </p>
          <Table
            size="sm"
            borderless
            className="w-auto align-middle"
            data-testid="BudgetPage-costs-funds"
          >
            <thead>
              <tr>
                <th colSpan={3}>Costs</th>
                <th className="px-4"></th>
                <th colSpan={2}>Funds</th>
              </tr>
            </thead>
            <tbody>
              {costsAndFundsRow(
                "ta",
                labelFor(
                  "BudgetPage-taCostPerQuarter",
                  "TA: Estimated cost per TA per quarter:",
                ),
                null,
                budgetInput("taCostPerQuarter"),
                "unrestrictedBudget",
                "Unrestricted temp subzero for quarter:",
              )}
              {costsAndFundsRow(
                "rate",
                labelFor(
                  "BudgetPage-ulaRateDollarsPerHour",
                  "ULA: Hourly rate:",
                ),
                budgetInput("ulaRateDollarsPerHour"),
                null,
                "tasOnlyBudget",
                "Temp subzero for TAs only for quarter:",
              )}
              {costsAndFundsRow(
                "hours",
                labelFor(
                  "BudgetPage-estimatedHoursPerULAPerQuarter",
                  "ULA: Estimated hours per ULA per quarter:",
                ),
                budgetInput("estimatedHoursPerULAPerQuarter"),
                null,
                "ulasOnlyBudget",
                "Temp subzero for ULAs only for quarter:",
              )}
              {costsAndFundsRow(
                "ulaCost",
                "ULA: Estimated cost per ULA per quarter:",
                null,
                <span data-testid="BudgetPage-ulaCost" className="fw-bold">
                  {ulaCost === null ? "—" : formatDollars(ulaCost)}
                </span>,
                "giftFundsForASEs",
                "Other funds available for ASEs (e.g. gift funds):",
              )}
            </tbody>
          </Table>

          <h2 className="h4 mt-3">Hiring targets</h2>
          <Row>
            <Col md={6}>{targetBlock("ta")}</Col>
            <Col md={6}>{targetBlock("ula")}</Col>
          </Row>

          <h2 className="h4 mt-3">Enrollment</h2>
          <p className="small">
            The two totals may differ, since the TA and ULA recruitments may
            cover different courses. Each ratio is the total estimate divided by
            the hiring target.
          </p>
          <Row>
            <Col md={6}>{enrollmentBlock("ta")}</Col>
            <Col md={6}>{enrollmentBlock("ula")}</Col>
          </Row>

          <h2 className="h4 mt-3">Budget</h2>
          <Row>
            <Col md={6}>
              <Table size="sm" bordered data-testid="BudgetPage-expenses">
                <thead>
                  <tr>
                    <th colSpan={2}>Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {costRow("ta")}
                  {costRow("ula")}
                  {/* Two blank rows, so the totals line up with the funds' four lines (#388). */}
                  <tr data-testid="BudgetPage-expenses-blank">
                    <td>&nbsp;</td>
                    <td></td>
                  </tr>
                  <tr data-testid="BudgetPage-expenses-blank-2">
                    <td>&nbsp;</td>
                    <td></td>
                  </tr>
                  <tr
                    className="fw-bold"
                    data-testid="BudgetPage-expenses-total"
                  >
                    <td>Total anticipated expenses</td>
                    <td className="text-end">
                      {formatDollars(summary.totalExpenses)}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Col>
            <Col md={6}>
              <Table size="sm" bordered data-testid="BudgetPage-funds">
                <thead>
                  <tr>
                    <th colSpan={2}>Funds</th>
                  </tr>
                </thead>
                <tbody>
                  <tr data-testid="BudgetPage-funds-tasOnly">
                    <td>TAs only budget</td>
                    <td className="text-end">
                      {formatDollars(summary.budget.tasOnlyBudget)}
                    </td>
                  </tr>
                  <tr data-testid="BudgetPage-funds-ulasOnly">
                    <td>ULAs only budget</td>
                    <td className="text-end">
                      {formatDollars(summary.budget.ulasOnlyBudget)}
                    </td>
                  </tr>
                  <tr data-testid="BudgetPage-funds-unrestricted">
                    <td>Unrestricted budget</td>
                    <td className="text-end">
                      {formatDollars(summary.budget.unrestrictedBudget)}
                    </td>
                  </tr>
                  <tr data-testid="BudgetPage-funds-gift">
                    <td>Other funds available for ASEs</td>
                    <td className="text-end">
                      {formatDollars(summary.budget.giftFundsForASEs ?? 0)}
                    </td>
                  </tr>
                  <tr className="fw-bold" data-testid="BudgetPage-funds-total">
                    <td>Total anticipated funds</td>
                    <td className="text-end">
                      {formatDollars(summary.totalFunds)}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Col>
          </Row>
          <p className="fs-5">
            Bottom line (funds minus expenses):{" "}
            <strong
              className={bottom.className}
              data-testid="BudgetPage-bottom-line"
            >
              {bottom.text}
            </strong>
          </p>
          {/* Issue #391: the changes to the two hiring targets, closed until asked for. */}
          <BudgetAuditTrailCard yyyyq={yyyyq} />
        </>
      </div>
    </BasicLayout>
  );
}
