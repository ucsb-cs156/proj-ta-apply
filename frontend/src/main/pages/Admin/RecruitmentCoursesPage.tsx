import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RecruitmentCourseTable, {
  isValidEmail,
  type RecruitmentCourse,
  type RecruitmentCourseRankingSummary,
} from "main/components/Recruitments/RecruitmentCourseTable";
import HiringTargetPanel from "main/components/Recruitments/HiringTargetPanel";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import {
  columnChoices,
  courseColumnsStorageKey,
  defaultHiddenColumns,
  isSummerQuarter,
} from "main/utils/courseColumns";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import PublishAssignmentsPanel from "main/components/Recruitments/PublishAssignmentsPanel";
import FakeAllocationsModal from "main/components/Recruitments/FakeAllocationsModal";
import FakeRankingsModal from "main/components/Recruitments/FakeRankingsModal";
import { canCreateFakeRankings } from "main/utils/fakeRankings";
import { useDeveloperModeFooterControls } from "main/utils/developerModeFooter";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { lastRefreshedText } from "main/utils/lastRefreshed";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useRefreshingBackend } from "main/utils/useRefreshingBackend";
import { apiErrorMessage } from "main/utils/apiError";
import { autoAssignTooltip } from "main/utils/allocations";
import { toast } from "react-toastify";
import {
  MultipleTabsBanner,
  MultipleTabsModal,
  useClientActivity,
} from "main/concurrency";

/**
 * Registers the page's developer-mode controls in the footer. It has to be rendered inside
 * BasicLayout, which provides the footer slot; the page itself sits outside it.
 */
function DeveloperFooterControls({
  controls,
}: {
  controls: React.ReactNode;
}): null {
  useDeveloperModeFooterControls(controls);
  return null;
}

/**
 * The course list for one recruitment, in two forms (issue #278).
 *
 * The <b>view-only page</b>, /admin/recruitments/:recruitmentId/courses, is the default. Nothing on
 * it can be changed, it says nothing to the server about who has it open, and any number of tabs
 * may show it. It has an Edit button.
 *
 * The <b>edit page</b>, /admin/recruitments/:recruitmentId/courses/edit (`edit`), is the page as it
 * always was: estimated enrollments, allocations, Auto Allocate, Populate and the rest. Only one
 * tab or window should have a recruitment's edit page open, so it heartbeats under the key
 * `courses-edit:<recruitmentId>`, names itself in each save, and shows the shared warning, with a
 * question to the newest tab, when another has it open.
 */
export default function RecruitmentCoursesPage({
  edit = false,
}: {
  edit?: boolean;
} = {}): React.JSX.Element {
  const { recruitmentId } = useParams();
  const navigate = useNavigate();
  const viewUrl = `/admin/recruitments/${recruitmentId}/courses`;

  // Only the edit page tells the server it is there, and learns who else is.
  const activity = useClientActivity({
    heartbeatUrl: edit
      ? `/api/recruitmentcourses/heartbeat?recruitmentId=${recruitmentId}`
      : null,
    leaveUrl: edit
      ? `/api/recruitmentcourses/leave?recruitmentId=${recruitmentId}`
      : null,
  });
  const requestHeaders = edit ? activity.headers : undefined;

  // Removed courses are hidden by default; the toggle is for operations and debugging, to see
  // what an earlier Populate left out.
  const [includeRemoved, setIncludeRemoved] = useState(false);
  // The enroll code typed into the add-by-enroll-code box (issue #125).
  const [enrollCode, setEnrollCode] = useState("");

  const { data: courses } = useRefreshingBackend<RecruitmentCourse[]>(
    ["/api/recruitmentcourses/all", includeRemoved],
    {
      method: "GET",
      url: "/api/recruitmentcourses/all",
      params: { recruitmentId, includeRemoved },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    // Stryker disable next-line BooleanLiteral : whether a failed read toasts is not under test here
    false,
    // Issue #282: only the view-only page refreshes in the background. The edit page is guarded by
    // the warning from #278, and its saves carry the versions this list holds, so the list must
    // not move under an admin who is editing; it still refetches after each save.
    // Stryker disable next-line BooleanLiteral : react-query treats `true` as no interval too (equivalent)
    edit ? { refetchInterval: false } : {},
  );

  // For the last-refreshed line (issue #124); every Populate stamps the recruitment.
  const { data: recruitments } = useRefreshingBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === String(recruitmentId),
  );
  const showRankings =
    recruitment?.reviewStatus !== undefined &&
    recruitment.reviewStatus !== "NotStarted";

  // Issue #300: which columns are hidden is remembered in this browser, per recruitment, and
  // shared by the view-only page and the edit page.
  const { hiddenColumns, toggleColumn } = useStoredHiddenColumns(
    courseColumnsStorageKey(recruitmentId),
    defaultHiddenColumns(),
  );

  // Issue #174: what the per-course allocations add up to. Removed rows are hidden by default
  // and never count, even when the toggle shows them.
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const allocatedSoFar = (courses ?? [])
    .filter((course) => !course.removed)
    .reduce((sum, course) => sum + (course.allocation ?? 0), 0);

  const {
    data: rankingSummaries,
    isError: rankingSummariesError,
    error: rankingSummariesFailure,
  } = useBackend<RecruitmentCourseRankingSummary[]>(
    [
      "/api/instructor/recruitments/admin-course-rankings",
      recruitmentId,
      includeRemoved,
    ],
    {
      method: "GET",
      url: `/api/instructor/recruitments/${recruitmentId}/admin-course-rankings`,
      params: { includeRemoved },
    },
    [],
    true,
    { enabled: Boolean(recruitmentId) },
  );
  const rankingSummaryByCourse = useMemo(
    () =>
      new Map(
        (rankingSummaries ?? []).map((summary) => [
          summary.recruitmentCourseId,
          summary,
        ]),
      ),
    [rankingSummaries],
  );

  const courseColumnChoices = columnChoices(
    showRankings,
    isSummerQuarter(recruitment?.quarter),
  );

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(successMessage);
    } catch {
      toast(
        "Unable to copy to clipboard. Check your browser clipboard permissions.",
      );
    }
  };

  const zeroRankingEmails = useMemo(() => {
    const emails = (courses ?? [])
      .filter(
        (course) => rankingSummaryByCourse.get(course.id)?.rankingCount === 0,
      )
      .map((course) => rankingSummaryByCourse.get(course.id)?.instructorEmail)
      .filter((email): email is string => isValidEmail(email));
    const unique = new Map<string, string>();
    emails.forEach((email) =>
      unique.set(email.trim().toLowerCase(), email.trim()),
    );
    return [...unique.values()];
  }, [courses, rankingSummaryByCourse]);

  const populateMutation = useBackendMutation<void, unknown>(
    () => ({
      url: "/api/jobs/launch/populateRecruitmentCourses",
      method: "POST",
      params: { recruitmentId },
    }),
    {
      onSuccess: () =>
        toast(
          "Populate job started. Watch its progress on the Developer > Jobs page.",
        ),
    },
    [
      "/api/recruitmentcourses/all",
      includeRemoved,
      "/api/admin/recruitments/all",
      "/api/instructor/recruitments/admin-course-rankings",
    ],
  );

  // Issue #175: the enrollment figures are refreshed from the UCSB API as the page opens, so the
  // numbers the admin plans from are current. The stored ones are shown meanwhile, and kept if
  // the API cannot be reached.
  const [refreshing, setRefreshing] = useState(true);
  // The backend's reason when the refresh failed; null while it is running or after it succeeded.
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshMutation = useBackendMutation<void, RecruitmentCourse[]>(
    () => ({
      url: "/api/recruitmentcourses/refresh",
      method: "POST",
      params: { recruitmentId },
    }),
    {
      onSuccess: () => setRefreshing(false),
      onError: (error) => {
        setRefreshError(apiErrorMessage(error));
        setRefreshing(false);
      },
    },
    ["/api/recruitmentcourses/all", "/api/admin/recruitments/all"],
  );
  // Once, when the page opens; a ref rather than an empty dependency list, so React's strict-mode
  // double mount in development does not refresh twice.
  const refreshed = useRef(false);
  const refresh = refreshMutation.mutate;
  // Stryker disable all : the guard only matters under strict mode's double mount, which the
  // tests do not simulate; the dependency list cannot be told apart from an empty one either.
  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    refresh();
  }, [refresh]);
  // Stryker restore all

  // Issue #175: every course's estimate from the API's max or actual enrollment in one step.
  const fillEstimatesMutation = useBackendMutation<
    "MAX" | "ACTUAL",
    RecruitmentCourse[]
  >(
    (source) => ({
      url: "/api/recruitmentcourses/enrollmentEstimates",
      method: "PUT",
      headers: requestHeaders,
      params: { recruitmentId, source },
    }),
    {
      onSuccess: (_rows, source) =>
        toast(
          `Enrollment estimates set from ${source === "MAX" ? "maximum" : "actual"} enrollment.`,
        ),
    },
    ["/api/recruitmentcourses/all"],
  );

  // Issue #176: a first cut at the allocations from the enrollment estimates, behind a
  // confirmation since it overwrites every allocation and cannot be undone.
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const autoAssignMutation = useBackendMutation<void, RecruitmentCourse[]>(
    () => ({
      url: "/api/recruitmentcourses/autoAllocate",
      method: "POST",
      headers: requestHeaders,
      params: { recruitmentId },
    }),
    {
      onSuccess: () => {
        setShowAutoAssign(false);
        toast("Allocations assigned from the enrollment estimates.");
      },
    },
    // The recruitment carries the count that Auto Allocate moves.
    // Stryker disable next-line all : cache invalidation is not observable from here
    ["/api/recruitmentcourses/all", "/api/admin/recruitments/all"],
  );

  // Issue #225: the developer-mode button, in the footer's developer slot (which shows only while
  // developer mode is on), opens the Fake Hiring Targets and Allocations modal.
  const [showFakeAllocations, setShowFakeAllocations] = useState(false);
  // Stryker disable next-line all : useBackend answers [] until the list arrives; this guards the type only
  const loadedCourses = courses ?? [];
  const courseCount = loadedCourses.filter((c) => !c.removed).length;
  // Issue #220: Create Fake Rankings sits beside it, offered only while the faculty review is Open.
  const [showFakeRankings, setShowFakeRankings] = useState(false);
  const fakeRankingsEnabled = canCreateFakeRankings(
    recruitment?.reviewStatus,
    courseCount,
  );
  const developerButtons = (
    <>
      <Button
        variant="danger"
        size="sm"
        className="me-2"
        disabled={courseCount === 0}
        onClick={() => setShowFakeAllocations(true)}
        data-testid="RecruitmentCoursesPage-fake-allocations"
      >
        Fake Hiring Targets and Allocations
      </Button>
      <Button
        variant="outline-secondary"
        size="sm"
        disabled={!fakeRankingsEnabled}
        onClick={() => setShowFakeRankings(true)}
        data-testid="RecruitmentCoursesPage-fake-rankings"
      >
        Create Fake Rankings
      </Button>
    </>
  );

  const addMutation = useBackendMutation<string, RecruitmentCourse>(
    (code) => ({
      url: "/api/recruitmentcourses/post",
      method: "POST",
      params: { recruitmentId, enrollCode: code },
    }),
    {
      onSuccess: (row) => {
        setEnrollCode("");
        toast(
          `Added ${row.courseId} section ${row.section ?? ""} (${row.enrollCode}).`,
        );
      },
      // The backend says why (unknown code, a discussion section); pass that on.
      onError: (error) => toast(apiErrorMessage(error)),
    },
    [
      "/api/recruitmentcourses/all",
      includeRemoved,
      "/api/instructor/recruitments/admin-course-rankings",
    ],
  );

  return (
    <BasicLayout>
      {edit && <DeveloperFooterControls controls={developerButtons} />}
      <div className="pt-2">
        <h1>Recruitment Courses</h1>
        {edit ? (
          <>
            <MultipleTabsBanner
              others={activity.others}
              noun="page"
              audience="admin"
              newest={activity.newest}
              testId="RecruitmentCoursesPage-multiple-tabs"
            />
            {/* Only the newest tab is asked; the older ones keep the banner alone. */}
            <MultipleTabsModal
              others={activity.others}
              newest={activity.newest}
              arrivedAt={activity.arrivedAt}
              noun="page"
              audience="admin"
              onLeave={() => {
                // Stryker disable next-line all : moving away unmounts the page, which says goodbye too
                activity.leave();
                navigate(viewUrl);
              }}
              testId="RecruitmentCoursesPage-multiple-tabs-modal"
            />
            <p>
              <Link to={viewUrl} data-testid="RecruitmentCoursesPage-view-link">
                Back to the view-only page
              </Link>
            </p>
          </>
        ) : (
          <p className="d-flex align-items-center gap-2">
            <Link
              className="btn btn-primary"
              to={`${viewUrl}/edit`}
              data-testid="RecruitmentCoursesPage-edit-button"
            >
              Edit
            </Link>
            <span data-testid="RecruitmentCoursesPage-edit-text">
              Click Edit to: change the number of TAs/ULAs expected to be hired;
              set the expected enrollments for each course; set the number of
              TAs/ULAs allocated to each course; adjust the visibility of these
              allocations.
            </span>
          </p>
        )}
        {edit ? (
          <p>
            The courses in this recruitment: every lecture of a course flagged
            for its type that is offered that quarter. Re-running Populate picks
            up newly flagged courses and refreshes the offering details, leaves
            removed courses out, and marks as stale any lecture it no longer
            finds in the UCSB schedule or whose course is no longer flagged.
            Stale lectures are hidden from applicants until a later Populate
            finds them again; Remove them if they are not coming back. A
            cancelled lecture is hidden from applicants too, and comes back by
            itself if the schedule un-cancels it. A lecture can also be added by
            hand by its enroll code, flagged course or not; Populate keeps
            refreshing it for as long as the schedule lists it.
          </p>
        ) : (
          <p data-testid="RecruitmentCoursesPage-description">
            Courses for which the department is planning to hire{" "}
            {recruitment ? `${recruitment.type}s` : "TAs/ULAs"}
            {recruitment ? ` for ${yyyyqToQyy(recruitment.quarter)}` : ""}.
          </p>
        )}

        {recruitment && (
          <>
            <HiringTargetPanel
              recruitment={recruitment}
              allocatedSoFar={allocatedSoFar}
              testIdPrefix="RecruitmentCoursesPage-hiring-target"
              readOnly={!edit}
            />
            {edit && (
              <AllocationVisibilityPanel
                recruitment={recruitment}
                testIdPrefix="RecruitmentCoursesPage-allocation-visibility"
              />
            )}
          </>
        )}

        <p data-testid="RecruitmentCoursesPage-last-refreshed">
          {lastRefreshedText(recruitment?.lastPopulatedAt)} Open, upcoming and
          recently closed recruitments are also refreshed automatically every
          night.
        </p>
        {refreshing && (
          <p role="status" data-testid="RecruitmentCoursesPage-refreshing">
            Refreshing enrollment from the UCSB API…
          </p>
        )}
        {refreshError !== null && (
          <p role="alert" data-testid="RecruitmentCoursesPage-refresh-failed">
            Enrollment could not be refreshed: {refreshError} The stored figures
            are shown.
          </p>
        )}

        <div className="d-flex align-items-center gap-3 mb-3">
          {edit && (
            <Button
              onClick={() => populateMutation.mutate()}
              data-testid="RecruitmentCoursesPage-populate"
            >
              Populate
            </Button>
          )}
          {edit && (
            <Form
              className="d-flex align-items-center gap-2"
              onSubmit={(event) => {
                // Stryker disable next-line all : without this a real browser would reload the page
                event.preventDefault();
                addMutation.mutate(enrollCode.trim());
              }}
              data-testid="RecruitmentCoursesPage-add-form"
            >
              <Form.Label
                htmlFor="RecruitmentCoursesPage-enrollCode"
                className="mb-0"
              >
                Add by enroll code
              </Form.Label>
              <Form.Control
                id="RecruitmentCoursesPage-enrollCode"
                data-testid="RecruitmentCoursesPage-enrollCode"
                size="sm"
                style={{ width: "7em" }}
                placeholder="e.g. 07492"
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline-primary"
                disabled={enrollCode.trim() === ""}
                data-testid="RecruitmentCoursesPage-add"
              >
                Add
              </Button>
            </Form>
          )}
          <Form.Check
            type="checkbox"
            id="RecruitmentCoursesPage-show-removed"
            label="Show removed courses"
            checked={includeRemoved}
            onChange={() => setIncludeRemoved(!includeRemoved)}
            data-testid="RecruitmentCoursesPage-show-removed"
          />
        </div>

        {edit && (
          <div
            className="mb-2"
            data-testid="RecruitmentCoursesPage-fill-estimates"
          >
            Set enrollment estimates from:{" "}
            <Button
              variant="link"
              className="p-0 align-baseline"
              onClick={() => fillEstimatesMutation.mutate("MAX")}
              data-testid="RecruitmentCoursesPage-fill-estimates-max"
            >
              max
            </Button>
            ,{" "}
            <Button
              variant="link"
              className="p-0 align-baseline"
              onClick={() => fillEstimatesMutation.mutate("ACTUAL")}
              data-testid="RecruitmentCoursesPage-fill-estimates-actual"
            >
              actual
            </Button>
            .
          </div>
        )}

        {edit && recruitment && (
          <div className="mb-3">
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="RecruitmentCoursesPage-auto-assign-tooltip">
                  {autoAssignTooltip(
                    recruitment.totalHiringTarget ?? 1,
                    recruitment.type,
                  )}
                </Tooltip>
              }
            >
              <Button
                variant="outline-primary"
                onClick={() => setShowAutoAssign(true)}
                data-testid="RecruitmentCoursesPage-auto-assign"
              >
                Auto assign {recruitment.type} allocations
              </Button>
            </OverlayTrigger>
          </div>
        )}
        {edit && (
          <Modal
            show={showAutoAssign}
            onHide={() => setShowAutoAssign(false)}
            centered
            data-testid="RecruitmentCoursesPage-auto-assign-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>Auto assign allocations</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <p>
                You have requested an automatic allocation based on estimated
                enrollment.
              </p>
              <p>
                This will overwrite all values currently in the allocation
                fields. This cannot be undone.
              </p>
              <p className="mb-0">Are you sure?</p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="danger"
                disabled={autoAssignMutation.isPending}
                onClick={() => autoAssignMutation.mutate()}
                data-testid="RecruitmentCoursesPage-auto-assign-confirm"
              >
                Yes, overwrite allocations
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowAutoAssign(false)}
                data-testid="RecruitmentCoursesPage-auto-assign-cancel"
              >
                No, keep my current allocations
              </Button>
            </Modal.Footer>
          </Modal>
        )}

        {rankingSummariesError && (
          <p role="alert">
            Unable to load ranking counts and instructor emails:{" "}
            {apiErrorMessage(rankingSummariesFailure)}
          </p>
        )}
        <div className="mb-2">
          <ColumnVisibilityControl
            choices={courseColumnChoices}
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            testIdPrefix="RecruitmentCoursesPage-columns"
          />
        </div>
        <RecruitmentCourseTable
          courses={courses ?? []}
          type={recruitment?.type}
          quarter={recruitment?.quarter}
          hiddenColumns={hiddenColumns}
          hideLinks={{
            choices: courseColumnChoices,
            onHide: (columnId) => toggleColumn(columnId, true),
          }}
          rankingSummaries={rankingSummaries ?? []}
          showRankings={showRankings}
          onCopyEmail={(email) =>
            copyToClipboard(email, "Email copied to clipboard.")
          }
          includeRemoved={includeRemoved}
          testIdPrefix="RecruitmentCoursesPage"
          readOnly={!edit}
          requestHeaders={requestHeaders}
          allocationBulkVersion={recruitment?.allocationBulkVersion}
        />
        {showRankings && (
          <div className="mb-3">
            <Button
              disabled={rankingSummariesError || zeroRankingEmails.length === 0}
              onClick={() =>
                copyToClipboard(
                  zeroRankingEmails.join("\n"),
                  "Faculty emails copied to clipboard.",
                )
              }
              data-testid="RecruitmentCoursesPage-copy-zero-ranking-emails"
            >
              Copy emails of faculty with zero rankings
            </Button>
            {!rankingSummariesError && zeroRankingEmails.length === 0 && (
              <span
                className="ms-2"
                data-testid="RecruitmentCoursesPage-no-zero-ranking-emails"
              >
                No mapped faculty email addresses are available.
              </span>
            )}
          </div>
        )}
        {edit && recruitment && (
          <PublishAssignmentsPanel
            recruitment={recruitment}
            testIdPrefix="RecruitmentCoursesPage-publish"
          />
        )}
        {edit && showFakeAllocations && (
          <FakeAllocationsModal
            recruitmentId={recruitmentId as string}
            courseCount={courseCount}
            onHide={() => setShowFakeAllocations(false)}
            testIdPrefix="RecruitmentCoursesPage-fake-allocations-modal"
          />
        )}
        {edit && showFakeRankings && (
          <FakeRankingsModal
            recruitmentId={recruitmentId as string}
            onHide={() => setShowFakeRankings(false)}
            testIdPrefix="RecruitmentCoursesPage-fake-rankings-modal"
          />
        )}
      </div>
    </BasicLayout>
  );
}
