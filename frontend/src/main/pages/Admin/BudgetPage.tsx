import { Link, useParams } from "react-router";
import { Col, Row, Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import SavedOnChangeInput from "main/components/Budget/SavedOnChangeInput";
import type {
  BudgetSide,
  BudgetSummary,
} from "main/components/Budget/budgetTypes";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { qyyToYyyyq } from "main/utils/quarterUtilities";
import { isValidHiringTarget } from "main/utils/allocations";
import {
  bottomLineDisplay,
  dollarsForInput,
  formatDollars,
  isValidDollars,
  overallRatioDisplay,
} from "main/utils/currency";

type BudgetLine = "unrestrictedBudget" | "tasOnlyBudget" | "ulasOnlyBudget";
type Side = "ta" | "ula";
const TYPE_OF: Record<Side, "TA" | "ULA"> = { ta: "TA", ula: "ULA" };

/** The query key of the summary; every mutation on the page invalidates it. */
const BUDGET_KEY = "/api/admin/budget";

/**
 * Admin → Budget for Quarter → one quarter: /admin/budget/:qyy (issue #177). The average cost of a
 * TA and of a ULA, the three budget lines, the hiring targets of both recruitments beside what has
 * been allocated so far, the enrollment totals and ratios, and the anticipated expenses, funds and
 * bottom line. Every box saves as it is typed and the whole page recomputes from the backend.
 */
export default function BudgetPage(): React.JSX.Element {
  const { qyy } = useParams();
  const yyyyq = qyyToYyyyq(qyy);

  const { data: summary } = useBackend<BudgetSummary | null>(
    [BUDGET_KEY, yyyyq],
    { method: "GET", url: BUDGET_KEY, params: { quarter: yyyyq } },
    null,
    false,
    { enabled: yyyyq !== null },
  );

  const budgetMutation = useBackendMutation<
    { line: BudgetLine; amount: string },
    BudgetSummary
  >(
    ({ line, amount }) => ({
      url: BUDGET_KEY,
      method: "PUT",
      params: { quarter: yyyyq, [line]: amount },
    }),
    {},
    [BUDGET_KEY],
  );

  const costMutation = useBackendMutation<
    { id: number; amount: string },
    Recruitment
  >(
    ({ id, amount }) => ({
      url: "/api/admin/recruitments/avgCostPerPosition",
      method: "PUT",
      params: { id, avgCostPerPosition: amount },
    }),
    {},
    [BUDGET_KEY],
  );

  const targetMutation = useBackendMutation<
    { id: number; target: string },
    Recruitment
  >(
    ({ id, target }) => ({
      url: "/api/admin/recruitments/totalHiringTarget",
      method: "PUT",
      params: { id, totalHiringTarget: Number(target) },
    }),
    {},
    [BUDGET_KEY],
  );

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

  const costInput = (which: Side) => {
    const type = TYPE_OF[which];
    const s = side(which);
    return (
      <SavedOnChangeInput
        id={`BudgetPage-avgCost-${which}`}
        label={`Total estimated average cost per ${type}:`}
        prefix="$"
        stored={dollarsForInput(s?.avgCostPerPosition)}
        isValid={isValidDollars}
        disabled={s === null}
        hint={s === null ? `No ${type} recruitment for ${qyy}.` : undefined}
        onSave={(amount) => {
          // Stryker disable next-line all : the box is disabled, so this cannot be reached
          if (s === null) return;
          costMutation.mutate({ id: s.recruitmentId, amount });
        }}
      />
    );
  };

  const budgetInput = (line: BudgetLine, label: string) => (
    <SavedOnChangeInput
      id={`BudgetPage-${line}`}
      label={label}
      prefix="$"
      stored={dollarsForInput(summary.budget[line])}
      isValid={isValidDollars}
      onSave={(amount) => budgetMutation.mutate({ line, amount })}
    />
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
          onSave={(target) =>
            targetMutation.mutate({ id: s.recruitmentId, target })
          }
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
            <Link to={`/admin/recruitments/${s.recruitmentId}/courses`}>
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
        <>
          <h2 className="h4 mt-3">Costs and funds</h2>
          <p className="small">
            The three budget lines may each include subzero and/or gift money,
            and any of them may be zero in a given quarter. For planning, the
            restricted lines (TAs only, ULAs only) are spent first and anything
            further comes from the unrestricted pool.{" "}
            <Link to="/help/admins#budget">More about these figures</Link>.
          </p>
          <Row>
            <Col md={6}>
              {costInput("ta")}
              {costInput("ula")}
            </Col>
            <Col md={6}>
              {budgetInput(
                "unrestrictedBudget",
                'Total estimated "unrestricted" budget:',
              )}
              {budgetInput(
                "tasOnlyBudget",
                'Total estimated additional "TAs only" budget:',
              )}
              {budgetInput(
                "ulasOnlyBudget",
                'Total estimated additional "ULAs only" budget:',
              )}
            </Col>
          </Row>

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
                  <tr data-testid="BudgetPage-expenses-blank">
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
        </>
      </div>
    </BasicLayout>
  );
}
