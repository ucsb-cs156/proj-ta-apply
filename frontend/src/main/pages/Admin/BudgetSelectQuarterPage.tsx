import { Link } from "react-router";
import { Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import type { BudgetQuarter } from "main/components/Budget/budgetTypes";

/**
 * Admin → Budget for Quarter: /admin/budget/selectQuarter (issue #177). Every quarter that has a
 * recruitment, most recent first, each linking to its budget page, with an x under TA and under ULA
 * for the recruitments it has.
 */
export default function BudgetSelectQuarterPage(): React.JSX.Element {
  const { data } = useBackend<BudgetQuarter[]>(
    // Stryker disable next-line all : the key is only observable through invalidation, and nothing on this page invalidates
    ["/api/admin/budget/quarters"],
    { method: "GET", url: "/api/admin/budget/quarters" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const quarters = data ?? [];

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="BudgetSelectQuarterPage">
        <h1>Budget for Quarter</h1>
        <p>
          Choose a quarter to plan its TA and ULA hiring against the money
          available. Only quarters with a recruitment are listed; create the
          recruitment from the home page first.
        </p>
        {quarters.length === 0 ? (
          <p data-testid="BudgetSelectQuarterPage-empty">
            No recruitments yet, so there is nothing to budget for.
          </p>
        ) : (
          <Table
            striped
            bordered
            size="sm"
            style={{ width: "auto" }}
            data-testid="BudgetSelectQuarterPage-table"
          >
            <thead>
              <tr>
                <th>Quarter</th>
                <th className="text-center">TA</th>
                <th className="text-center">ULA</th>
              </tr>
            </thead>
            <tbody>
              {quarters.map((quarter) => {
                const qyy = yyyyqToQyy(quarter.quarter);
                return (
                  <tr
                    key={quarter.quarter}
                    data-testid={`BudgetSelectQuarterPage-row-${quarter.quarter}`}
                  >
                    <td>
                      <Link
                        to={`/admin/budget/${qyy}`}
                        data-testid={`BudgetSelectQuarterPage-link-${quarter.quarter}`}
                      >
                        {qyy}
                      </Link>
                    </td>
                    <td
                      className="text-center"
                      data-testid={`BudgetSelectQuarterPage-ta-${quarter.quarter}`}
                    >
                      {quarter.hasTa ? "x" : ""}
                    </td>
                    <td
                      className="text-center"
                      data-testid={`BudgetSelectQuarterPage-ula-${quarter.quarter}`}
                    >
                      {quarter.hasUla ? "x" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </BasicLayout>
  );
}
