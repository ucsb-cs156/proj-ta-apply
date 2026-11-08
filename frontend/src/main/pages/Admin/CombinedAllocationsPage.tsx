import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Alert,
  Button,
  Modal,
  OverlayTrigger,
  Table,
  Tooltip,
} from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "react-toastify";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import {
  combinedColumnChoices,
  combinedColumnsStorageKey,
  defaultHiddenCombinedColumns,
} from "main/utils/combinedColumns";
import { isSummerQuarter } from "main/utils/courseColumns";
import { autoAssignTooltip } from "main/utils/allocations";
import { apiErrorMessage } from "main/utils/apiError";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import CombinedAllocationTable from "main/components/Allocations/CombinedAllocationTable";
import SavedOnChangeInput from "main/components/Budget/SavedOnChangeInput";
import type { BudgetSummary } from "main/components/Budget/budgetTypes";
import {
  BUDGET_KEY,
  useBudgetSaves,
} from "main/components/Budget/useBudgetSaves";
import type {
  RecruitmentCourse,
  RecruitmentCourseRankingSummary,
} from "main/components/Recruitments/RecruitmentCourseTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import FakeAllocationsModal from "main/components/Recruitments/FakeAllocationsModal";
import { DeveloperFooterControls } from "main/utils/developerModeFooter";
import {
  MultipleTabsBanner,
  MultipleTabsModal,
  mergeStandings,
  useClientActivity,
} from "main/concurrency";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { qyyToYyyyq } from "main/utils/quarterUtilities";
import { formatDollars } from "main/utils/currency";
import {
  combineCourses,
  CONVERSION_FACTOR_EXPLANATION,
  CONVERSION_FACTOR_INVALID_MESSAGE,
  costRatioDisplay,
  isValidConversionFactor,
} from "main/utils/combinedAllocations";

/**
 * The conversion factor's saves name no tab: the page does not heartbeat for the quarter's budget
 * (`budget:<quarter>`), whose only field it edits is guarded by a version check of its own, the
 * budget row's `conversionVersion` (issue #375), and a save that named a tab the Budget page never
 * hears a heartbeat from would make that page warn about a tab that is not there.
 */
const NO_HEADERS: Record<string, string> = {};

/** The Courses edit page's heartbeat and goodbye for one recruitment; null without one. */
const heartbeatUrl = (recruitmentId: number | undefined) =>
  recruitmentId === undefined
    ? null
    : `/api/recruitmentcourses/heartbeat?recruitmentId=${recruitmentId}`;
const leaveUrl = (recruitmentId: number | undefined) =>
  recruitmentId === undefined
    ? null
    : `/api/recruitmentcourses/leave?recruitmentId=${recruitmentId}`;

type Type = "TA" | "ULA";

/**
 * Admin → Combined Allocation page: /admin/allocations/:qyy (issue #358, for example
 * /admin/allocations/W26). The courses of the quarter's TA and ULA recruitments side by side, one
 * row per section, with each type's allocation columns; the allocations are edited here exactly as
 * on each recruitment's Edit Courses page. When the quarter has both recruitments the page also
 * shows what a TA and a ULA cost, the TA to ULA conversion factor, and the ASE:Student ratio.
 *
 * The page edits the same allocations and estimates as each recruitment's Courses edit page, so it
 * heartbeats under that page's key, `courses-edit:<recruitmentId>`, for every recruitment of the
 * quarter (two heartbeats, one tab), and warns and is warned about the same copies as that page
 * does (issue #278's pattern). Its saves name the tab the same way. Leave this page goes to the
 * quarter's Budget page.
 *
 * In developer mode the footer has the Courses edit page's Fake Hiring Targets and Allocations
 * button, acting on every recruitment of the quarter in one click. Create Fake Rankings is not
 * here (issue #385): it is on each recruitment's own Assignments page, and nowhere else.
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

  // One tab on up to two things: the second heartbeat borrows the first's identifier, so every
  // heartbeat, goodbye and save of this page is the same tab to the server.
  const taActivity = useClientActivity({
    heartbeatUrl: heartbeatUrl(taId),
    leaveUrl: leaveUrl(taId),
  });
  const ulaActivity = useClientActivity({
    heartbeatUrl: heartbeatUrl(ulaId),
    leaveUrl: leaveUrl(ulaId),
    clientId: taActivity.clientId,
  });
  // Only the recruitments the quarter has have a say; a hook without a URL never hears anything.
  const activity = mergeStandings([
    ...(taId === undefined ? [] : [taActivity]),
    ...(ulaId === undefined ? [] : [ulaActivity]),
  ]);
  const requestHeaders = taActivity.headers;
  const navigate = useNavigate();

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

  // Whether each type's faculty rankings have been opened: its Rankings column exists only then,
  // as on the recruitment's own page.
  const rankingsOpened = (id: number | undefined) => {
    // Stryker disable next-line OptionalChaining : the initial data is a list, never undefined
    const status = recruitments?.find((r) => r.id === id)?.reviewStatus;
    return status !== undefined && status !== "NotStarted";
  };
  const showTaRankings = rankingsOpened(taId);
  const showUlaRankings = rankingsOpened(ulaId);
  const summaryQuery = (recruitmentId: number | undefined) => ({
    // Stryker disable all : the key only has to differ between the two recruitments, and it does by the id
    key: [
      "/api/instructor/recruitments/admin-course-rankings",
      recruitmentId,
      false,
    ],
    // Stryker restore all
    axios: {
      method: "GET" as const,
      url: `/api/instructor/recruitments/${recruitmentId}/admin-course-rankings`,
      params: { includeRemoved: false },
    },
  });
  const taSummaryQuery = summaryQuery(taId);
  const ulaSummaryQuery = summaryQuery(ulaId);
  const { data: taRankingSummaries } = useBackend<
    RecruitmentCourseRankingSummary[]
  >(
    taSummaryQuery.key,
    taSummaryQuery.axios,
    // Stryker disable next-line ArrayDeclaration : the initial data is only what shows until the answer arrives, and nothing is looked up in it by then
    [],
    true,
    { enabled: taId !== undefined },
  );
  const { data: ulaRankingSummaries } = useBackend<
    RecruitmentCourseRankingSummary[]
  >(
    ulaSummaryQuery.key,
    ulaSummaryQuery.axios,
    // Stryker disable next-line ArrayDeclaration : the initial data is only what shows until the answer arrives, and nothing is looked up in it by then
    [],
    true,
    { enabled: ulaId !== undefined },
  );

  // Which columns are hidden is remembered in this browser, per quarter.
  const { hiddenColumns, toggleColumn } = useStoredHiddenColumns(
    combinedColumnsStorageKey(qyy),
    defaultHiddenCombinedColumns(),
  );
  const columnChoices = combinedColumnChoices(
    { exists: taId !== undefined, showRankings: showTaRankings },
    { exists: ulaId !== undefined, showRankings: showUlaRankings },
    isSummerQuarter(yyyyq),
  );

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast("Email copied to clipboard.");
    } catch {
      toast(
        "Unable to copy to clipboard. Check your browser clipboard permissions.",
      );
    }
  };

  // The enrollment estimates of every recruitment of the quarter from the API's max or actual
  // enrollment in one step; the endpoint takes one recruitment, so it is called for each.
  const queryClient = useQueryClient();
  const fillEstimatesMutation = useMutation<unknown, unknown, "MAX" | "ACTUAL">(
    {
      mutationFn: (source) =>
        Promise.all(
          [taId, ulaId]
            .filter((id) => id !== undefined)
            .map((recruitmentId) =>
              axios({
                url: "/api/recruitmentcourses/enrollmentEstimates",
                method: "PUT",
                headers: requestHeaders,
                params: { recruitmentId, source },
              }),
            ),
        ),
      onSuccess: (_rows, source) =>
        toast(
          `Enrollment estimates set from ${source === "MAX" ? "maximum" : "actual"} enrollment.`,
        ),
      onError: (error) => toast(apiErrorMessage(error)),
      // Stryker disable all : cache invalidation is not observable from here
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: ["/api/recruitmentcourses/all"],
        }),
      // Stryker restore all
    },
  );

  // A first cut at one type's allocations from the enrollment estimates, behind a confirmation
  // since it overwrites every allocation of that type and cannot be undone.
  const [autoAssignType, setAutoAssignType] = useState<"TA" | "ULA" | null>(
    null,
  );
  const autoAssignMutation = useBackendMutation<"TA" | "ULA", unknown>(
    (type) => ({
      url: "/api/recruitmentcourses/autoAllocate",
      method: "POST",
      headers: requestHeaders,
      params: { recruitmentId: type === "TA" ? taId : ulaId },
    }),
    {
      onSuccess: () => {
        setAutoAssignType(null);
        toast("Allocations assigned from the enrollment estimates.");
      },
    },
    // The recruitment carries the count that Auto Allocate moves.
    // Stryker disable next-line all : cache invalidation is not observable from here
    ["/api/recruitmentcourses/all", "/api/admin/recruitments/all"],
  );

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

  // Developer mode's fake data (issue #225), for every recruitment of the quarter at once: a
  // hiring target and allocations for each that has a course.
  const [showFakeAllocations, setShowFakeAllocations] = useState(false);
  const sides = (
    [
      ["TA", taId, taCourses],
      ["ULA", ulaId, ulaCourses],
    ] as const
  )
    .filter(([, id]) => id !== undefined)
    .map(([type, id, list]) => ({
      type: type as Type,
      recruitmentId: id as number,
      // Stryker disable next-line all : the initial data is a list, never undefined
      courseCount: (list ?? []).length,
    }));
  const fakeAllocationTargets = sides.filter((side) => side.courseCount > 0);
  const developerButtons = (
    <Button
      variant="danger"
      size="sm"
      disabled={fakeAllocationTargets.length === 0}
      onClick={() => setShowFakeAllocations(true)}
      data-testid="CombinedAllocationsPage-fake-allocations"
    >
      Fake Hiring Targets and Allocations
    </Button>
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
      <DeveloperFooterControls controls={developerButtons} />
      <div className="pt-2" data-testid="CombinedAllocationsPage">
        {header}
        <MultipleTabsBanner
          others={activity.others}
          noun="quarter's allocations"
          audience="admin"
          newest={activity.newest}
          testId="CombinedAllocationsPage-multiple-tabs"
        />
        {/* Only the newest tab is asked; the older ones keep the banner alone. */}
        <MultipleTabsModal
          others={activity.others}
          newest={activity.newest}
          arrivedAt={activity.arrivedAt}
          noun="quarter's allocations"
          audience="admin"
          onLeave={() => {
            // Stryker disable next-line all : moving away unmounts the page, which says goodbye too
            taActivity.leave();
            // Stryker disable next-line all : moving away unmounts the page, which says goodbye too
            ulaActivity.leave();
            navigate(`/admin/budget/${qyy}`);
          }}
          testId="CombinedAllocationsPage-multiple-tabs-modal"
        />
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
              inline
              onSave={(factor) => save("conversionTAtoULA", factor)}
            />
          </>
        )}
        <div
          className="mb-2"
          data-testid="CombinedAllocationsPage-fill-estimates"
        >
          Set enrollment estimates from:{" "}
          <Button
            variant="link"
            className="p-0 align-baseline"
            onClick={() => fillEstimatesMutation.mutate("MAX")}
            data-testid="CombinedAllocationsPage-fill-estimates-max"
          >
            max
          </Button>
          ,{" "}
          <Button
            variant="link"
            className="p-0 align-baseline"
            onClick={() => fillEstimatesMutation.mutate("ACTUAL")}
            data-testid="CombinedAllocationsPage-fill-estimates-actual"
          >
            actual
          </Button>
          .
        </div>
        <div className="mb-2 d-flex gap-2">
          {(
            [
              ["TA", ta],
              ["ULA", ula],
            ] as const
          ).map(
            ([type, side]) =>
              side !== null && (
                <OverlayTrigger
                  key={type}
                  placement="top"
                  overlay={
                    <Tooltip
                      id={`CombinedAllocationsPage-auto-assign-${type}-tooltip`}
                    >
                      {autoAssignTooltip(side.totalHiringTarget ?? 1, type)}
                    </Tooltip>
                  }
                >
                  <Button
                    variant="outline-primary"
                    onClick={() => setAutoAssignType(type)}
                    data-testid={`CombinedAllocationsPage-auto-assign-${type}`}
                  >
                    Auto assign {type} allocations
                  </Button>
                </OverlayTrigger>
              ),
          )}
        </div>
        <Modal
          show={autoAssignType !== null}
          onHide={() => setAutoAssignType(null)}
          centered
          data-testid="CombinedAllocationsPage-auto-assign-modal"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {/* Stryker disable next-line StringLiteral : the title is only seen while the modal fades out */}
              Auto assign {autoAssignType ?? ""} allocations
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              You have requested an automatic allocation based on estimated
              enrollment.
            </p>
            <p>
              This will overwrite all values currently in the {autoAssignType}{" "}
              allocation fields. This cannot be undone.
            </p>
            <p className="mb-0">Are you sure?</p>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="danger"
              disabled={autoAssignMutation.isPending}
              // Stryker disable next-line ConditionalExpression : the button is only shown while a type is chosen
              onClick={() =>
                autoAssignType !== null &&
                autoAssignMutation.mutate(autoAssignType)
              }
              data-testid="CombinedAllocationsPage-auto-assign-confirm"
            >
              Yes, overwrite allocations
            </Button>
            <Button
              variant="secondary"
              onClick={() => setAutoAssignType(null)}
              data-testid="CombinedAllocationsPage-auto-assign-cancel"
            >
              No, keep my current allocations
            </Button>
          </Modal.Footer>
        </Modal>
        <div className="mb-2">
          <ColumnVisibilityControl
            choices={columnChoices}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            testIdPrefix="CombinedAllocationsPage-columns"
          />
        </div>
        <CombinedAllocationTable
          courses={courses}
          hasTa={ta !== null}
          hasUla={ula !== null}
          conversionFactor={summary.budget.conversionTAtoULA}
          taBulkVersion={bulkVersionOf(taId)}
          ulaBulkVersion={bulkVersionOf(ulaId)}
          // Stryker disable next-line ArrayDeclaration : the data is a list, never undefined
          taRankingSummaries={taRankingSummaries ?? []}
          // Stryker disable next-line ArrayDeclaration : the data is a list, never undefined
          ulaRankingSummaries={ulaRankingSummaries ?? []}
          showTaRankings={showTaRankings}
          showUlaRankings={showUlaRankings}
          onCopyEmail={copyEmail}
          hiddenColumns={hiddenColumns}
          summer={isSummerQuarter(yyyyq)}
          hideLinks={{
            choices: columnChoices,
            onHide: (columnId) => toggleColumn(columnId, true),
          }}
          requestHeaders={requestHeaders}
        />
        {showFakeAllocations && (
          <FakeAllocationsModal
            recruitments={fakeAllocationTargets}
            onHide={() => setShowFakeAllocations(false)}
            testIdPrefix="CombinedAllocationsPage-fake-allocations-modal"
          />
        )}
      </div>
    </BasicLayout>
  );
}
