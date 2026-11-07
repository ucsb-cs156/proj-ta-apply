import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { Alert, Button, Table } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import CombinedAllocationTable from "main/components/Allocations/CombinedAllocationTable";
import SavedOnChangeInput from "main/components/Budget/SavedOnChangeInput";
import type { BudgetSummary } from "main/components/Budget/budgetTypes";
import {
  BUDGET_KEY,
  useBudgetSaves,
} from "main/components/Budget/useBudgetSaves";
import type { RecruitmentCourse } from "main/components/Recruitments/RecruitmentCourseTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { useBackend } from "main/utils/useBackend";
import { qyyToYyyyq } from "main/utils/quarterUtilities";
import { formatDollars } from "main/utils/currency";
import {
  combineCourses,
  CONVERSION_FACTOR_EXPLANATION,
  CONVERSION_FACTOR_INVALID_MESSAGE,
  costRatioDisplay,
  isValidConversionFactor,
} from "main/utils/combinedAllocations";

/** The conversion factor's saves name no tab: the page does not heartbeat. */
const NO_HEADERS: Record<string, string> = {};

/**
 * Admin → Combined Allocation page: /admin/allocations/:qyy (issue #358, for example
 * /admin/allocations/W26). The courses of the quarter's TA and ULA recruitments side by side, one
 * row per section, with each type's allocation columns; the allocations are edited here exactly as
 * on each recruitment's Edit Courses page. When the quarter has both recruitments the page also
 * shows what a TA and a ULA cost, the TA to ULA conversion factor, and the ASE:Student ratio.
 */
export default function CombinedAllocationsPage(): React.JSX.Element {
  const { qyy } = useParams();
  // Made afresh for each quarter, so nothing the page knows about one is taken for another's.
  return <CombinedAllocationsForQuarter key={qyy} qyy={qyy} />;
}

function CombinedAllocationsForQuarter({
  qyy,
}: {
  qyy: string | undefined;
}): React.JSX.Element {
  const yyyyq = qyyToYyyyq(qyy);

  const { data: summary, isError } = useBackend<BudgetSummary | null>(
    [BUDGET_KEY, yyyyq],
    { method: "GET", url: BUDGET_KEY, params: { quarter: yyyyq } },
    null,
    false,
    { enabled: yyyyq !== null },
  );
  const taId = summary?.ta?.recruitmentId;
  const ulaId = summary?.ula?.recruitmentId;

  // The key starts with the url, as the allocation saves refresh and update the lists under it.
  const courseQuery = (recruitmentId: number | undefined) => ({
    key: ["/api/recruitmentcourses/all", recruitmentId],
    axios: {
      method: "GET" as const,
      url: "/api/recruitmentcourses/all",
      params: { recruitmentId, includeRemoved: false },
    },
  });
  const taQuery = courseQuery(taId);
  const ulaQuery = courseQuery(ulaId);
  const { data: taCourses } = useBackend<RecruitmentCourse[]>(
    taQuery.key,
    taQuery.axios,
    [],
    false,
    { enabled: taId !== undefined },
  );
  const { data: ulaCourses } = useBackend<RecruitmentCourse[]>(
    ulaQuery.key,
    ulaQuery.axios,
    // Stryker disable next-line ArrayDeclaration : until the summary names the recruitments, both queries are one disabled cache entry, and the first one's initial data is the one it has
    [],
    false,
    { enabled: ulaId !== undefined },
  );
  // Each allocation edit proves the recruitment's Auto Allocate count it was made against.
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : replaced by the answer; until then no edit is in progress
    [],
  );
  const bulkVersionOf = (id: number | undefined) =>
    // Stryker disable next-line OptionalChaining : the initial data is a list, never undefined
    recruitments?.find((r) => r.id === id)?.allocationBulkVersion;

  const courses = useMemo(
    // Stryker disable next-line ArrayDeclaration : the initial data is a list, never undefined
    () => combineCourses(taCourses ?? [], ulaCourses ?? []),
    [taCourses, ulaCourses],
  );

  const { conflicts, save, takeTheirs, overwrite } = useBudgetSaves(
    yyyyq,
    summary,
    NO_HEADERS,
  );

  if (yyyyq === null) {
    return (
      <BasicLayout>
        <div className="pt-2" data-testid="CombinedAllocationsPage">
          <h1>Combined Allocations</h1>
          <p data-testid="CombinedAllocationsPage-bad-quarter">
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
      <h1>Allocations for {qyy}</h1>
      <p>
        <Link to={`/admin/budget/${qyy}`}>Budget for {qyy}</Link>
      </p>
    </>
  );

  if (!summary) {
    return (
      <BasicLayout>
        <div className="pt-2" data-testid="CombinedAllocationsPage">
          {header}
          <p data-testid="CombinedAllocationsPage-loading">
            {isError ? `No recruitment for ${qyy}.` : "Loading…"}
          </p>
        </div>
      </BasicLayout>
    );
  }

  const { ta, ula } = summary;

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="CombinedAllocationsPage">
        {header}
        {conflicts.map((conflict) => (
          <Alert
            key={conflict.field}
            variant="warning"
            data-testid={`CombinedAllocationsPage-conflict-${conflict.field}`}
          >
            <span
              data-testid={`CombinedAllocationsPage-conflict-${conflict.field}-message`}
            >
              The {conflict.name} was changed in another tab or window. It is
              now {conflict.current}; you entered {conflict.entered}.
            </span>
            <Button
              className="ms-2"
              size="sm"
              variant="outline-secondary"
              data-testid={`CombinedAllocationsPage-conflict-${conflict.field}-theirs`}
              onClick={() => takeTheirs(conflict.field)}
            >
              Use theirs
            </Button>
            <Button
              className="ms-2"
              size="sm"
              variant="warning"
              data-testid={`CombinedAllocationsPage-conflict-${conflict.field}-overwrite`}
              onClick={() => overwrite(conflict.field)}
            >
              Overwrite
            </Button>
          </Alert>
        ))}
        {ta !== null && ula !== null && (
          <>
            <Table
              size="sm"
              bordered
              className="w-auto"
              data-testid="CombinedAllocationsPage-costs"
            >
              <tbody>
                <tr data-testid="CombinedAllocationsPage-costs-ta">
                  <td>Cost per TA</td>
                  <td className="text-end">
                    {ta.avgCostPerPosition == null
                      ? ""
                      : formatDollars(ta.avgCostPerPosition)}
                  </td>
                </tr>
                <tr data-testid="CombinedAllocationsPage-costs-ula">
                  <td>Cost per ULA</td>
                  <td className="text-end">
                    {ula.avgCostPerPosition == null
                      ? ""
                      : formatDollars(ula.avgCostPerPosition)}
                  </td>
                </tr>
                <tr data-testid="CombinedAllocationsPage-costs-ratio">
                  <td>TA Cost/ULA Cost</td>
                  <td className="text-end">
                    {costRatioDisplay(
                      ta.avgCostPerPosition,
                      ula.avgCostPerPosition,
                    )}
                  </td>
                </tr>
              </tbody>
            </Table>
            <SavedOnChangeInput
              id="CombinedAllocationsPage-conversionTAtoULA"
              label="Nominal TA to ULA conversion factor"
              title={CONVERSION_FACTOR_EXPLANATION}
              stored={String(summary.budget.conversionTAtoULA)}
              isValid={isValidConversionFactor}
              invalidMessage={CONVERSION_FACTOR_INVALID_MESSAGE}
              width="10em"
              onSave={(factor) => save("conversionTAtoULA", factor)}
            />
          </>
        )}
        <CombinedAllocationTable
          courses={courses}
          hasTa={ta !== null}
          hasUla={ula !== null}
          conversionFactor={summary.budget.conversionTAtoULA}
          taBulkVersion={bulkVersionOf(taId)}
          ulaBulkVersion={bulkVersionOf(ulaId)}
        />
      </div>
    </BasicLayout>
  );
}
