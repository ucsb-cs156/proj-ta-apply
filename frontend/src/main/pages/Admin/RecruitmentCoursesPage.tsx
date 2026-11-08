import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
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
  adminColumnChoices,
  AllocationsRelatedColumns,
  courseColumnsStorageKey,
  defaultHiddenColumns,
  isSummerQuarter,
} from "main/utils/courseColumns";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import FakeAllocationsModal from "main/components/Recruitments/FakeAllocationsModal";
import { DeveloperFooterControls } from "main/utils/developerModeFooter";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { lastRefreshedText } from "main/utils/lastRefreshed";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useRefreshingBackend } from "main/utils/useRefreshingBackend";
import { apiErrorMessage } from "main/utils/apiError";
import { toast } from "react-toastify";
import {
  MultipleTabsBanner,
  MultipleTabsModal,
  useClientActivity,
} from "main/concurrency";

/**
 * The course list for one recruitment, in two forms (issue #278).
 *
 * The <b>view-only page</b>, /admin/recruitments/:recruitmentId/courses, is the default. Nothing on
 * it can be changed, it says nothing to the server about who has it open, and any number of tabs
 * may show it. It has an Edit button.
 *
 * The <b>edit page</b>, /admin/recruitments/:recruitmentId/courses/edit (`edit`), has the hiring
 * target, Populate, Add by enroll code, Remove / Unremove, allocation visibility, Publish
 * Assignments and the developer buttons. Only one tab or window should have a recruitment's edit
 * page open, so it heartbeats under the key `courses-edit:<recruitmentId>` and shows the shared
 * warning, with a question to the newest tab, when another has it open.
 *
 * Since issue #358 neither page has the budget columns (Enrollment Estimate, Allocation, Unrounded
 * Allocation, Delta, TA:student / ULA:student ratio) or the controls that acted on them (Set
 * enrollment estimates from max / actual, Auto assign allocations): they need to be seen for TAs
 * and ULAs together, so they live on the Combined Allocation page, /admin/allocations/QXX, which
 * both pages point to. The Combined Allocation page heartbeats under this page's key too, so the
 * two warn each other.
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

  // Removed courses are hidden by default; the toggle is for operations and debugging, to see
  // what an earlier Populate left out.
  const [includeRemoved, setIncludeRemoved] = useState(false);
  // The enroll code typed into the add-by-enroll-code box (issue #125).
  const [enrollCode, setEnrollCode] = useState("");

  const { data: courses } = useRefreshingBackend<RecruitmentCourse[]>(
    ["/api/recruitmentcourses/all", includeRemoved],
    {
      // Stryker disable next-line StringLiteral : GET is axios's default method
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
    // Stryker disable next-line StringLiteral : GET is axios's default method
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
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
      // Stryker disable next-line StringLiteral : GET is axios's default method
      method: "GET",
      url: `/api/instructor/recruitments/${recruitmentId}/admin-course-rankings`,
      params: { includeRemoved },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
    // Stryker disable next-line BooleanLiteral : whether a failed read toasts is not under test here
    true,
    // Stryker disable next-line all : the route always carries a recruitment id, so the query is always enabled
    { enabled: Boolean(recruitmentId) },
  );
  const rankingSummaryByCourse = useMemo(
    () =>
      new Map(
        // Stryker disable next-line all : the query's initial data is an empty list, never undefined
        (rankingSummaries ?? []).map((summary) => [
          summary.recruitmentCourseId,
          summary,
        ]),
      ),
    [rankingSummaries],
  );

  const courseColumnChoices = adminColumnChoices(
    showRankings,
    isSummerQuarter(recruitment?.quarter),
  );
  // Issue #358: where the estimates and allocations went, once the quarter is known.
  const quarterQyy = recruitment ? yyyyqToQyy(recruitment.quarter) : null;
  // Issue #320: the title names the quarter and the type, "W26 TA Courses", once the recruitment
  // is known; until then (and for an unknown recruitment) it is the generic one.
  const title = recruitment
    ? `${quarterQyy} ${recruitment.type} Courses`
    : "Recruitment Courses";

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
    // Stryker disable next-line all : the query's initial data is an empty list, never undefined
    const emails = (courses ?? [])
      .map((course) => rankingSummaryByCourse.get(course.id))
      .filter(
        (summary): summary is RecruitmentCourseRankingSummary =>
          summary?.rankingCount === 0,
      )
      .map((summary) => summary.instructorEmail)
      .filter((email): email is string => isValidEmail(email));
    // One address per person, whatever the case or spacing the mapping was typed with; the last
    // spelling seen is the one copied.
    const unique = new Map<string, string>();
    emails.forEach((email) => {
      const trimmed = email.trim();
      // Stryker disable next-line MethodExpression : folding to upper case would dedupe the same way
      unique.set(trimmed.toLowerCase(), trimmed);
    });
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

  // Issue #225: the developer-mode button, in the footer's developer slot (which shows only while
  // developer mode is on), opens the Fake Hiring Targets and Allocations modal. Create Fake
  // Rankings used to sit beside it; since issue #385 it is on the Assignments page.
  const [showFakeAllocations, setShowFakeAllocations] = useState(false);
  // Stryker disable next-line all : useBackend answers [] until the list arrives; this guards the type only
  const loadedCourses = courses ?? [];
  const courseCount = loadedCourses.filter((c) => !c.removed).length;
  const developerButtons = (
    <Button
      variant="danger"
      size="sm"
      disabled={courseCount === 0}
      onClick={() => setShowFakeAllocations(true)}
      data-testid="RecruitmentCoursesPage-fake-allocations"
    >
      Fake Hiring Targets and Allocations
    </Button>
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
        <h1 data-testid="RecruitmentCoursesPage-title">{title}</h1>
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
              Click Edit to: populate the course list, add a lecture by enroll
              code, remove a course, or release allocations to faculty.
            </span>
          </p>
        )}
        {/* The edit page is the controls and the table alone (issue #358): no description, no
            pointer and no hiring target, which is entered on the Budget page. */}
        {!edit && (
          <>
            <p data-testid="RecruitmentCoursesPage-description">
              These are the courses for which the department plans to hire{" "}
              {recruitment ? `${recruitment.type}s` : "TAs/ULAs"}.
            </p>
            {/* Issue #320: a recruitment's list is the lectures of the courses flagged for its type
                on the admin Courses page, so that is where a missing course is put right. */}
            <p data-testid="RecruitmentCoursesPage-populate-hint">
              If courses do not appear, please go to the{" "}
              <Link
                to="/admin/courses"
                data-testid="RecruitmentCoursesPage-courses-link"
              >
                Courses
              </Link>{" "}
              page and click <em>Populate</em>.
            </p>
          </>
        )}
        {!edit && quarterQyy !== null && (
          <p data-testid="RecruitmentCoursesPage-combined-pointer">
            Enrollment estimates and allocations are not on this page: they are
            edited for TAs and ULAs together on the{" "}
            <Link
              to={`/admin/allocations/${quarterQyy}`}
              data-testid="RecruitmentCoursesPage-combined-link"
            >
              Combined Allocation page for {quarterQyy}
            </Link>
            .
          </p>
        )}

        {!edit && recruitment && (
          <HiringTargetPanel
            recruitment={recruitment}
            allocatedSoFar={allocatedSoFar}
            testIdPrefix="RecruitmentCoursesPage-hiring-target"
            readOnly
          />
        )}
        {edit && recruitment && (
          <AllocationVisibilityPanel
            recruitment={recruitment}
            testIdPrefix="RecruitmentCoursesPage-allocation-visibility"
          />
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
          // Stryker disable next-line all : the query's initial data is an empty list, never undefined
          courses={courses ?? []}
          type={recruitment?.type}
          quarter={recruitment?.quarter}
          hiddenColumns={hiddenColumns}
          hideLinks={{
            choices: courseColumnChoices,
            onHide: (columnId) => toggleColumn(columnId, true),
          }}
          // Stryker disable next-line all : the query's initial data is an empty list, never undefined
          rankingSummaries={rankingSummaries ?? []}
          showRankings={showRankings}
          onCopyEmail={(email) =>
            copyToClipboard(email, "Email copied to clipboard.")
          }
          includeRemoved={includeRemoved}
          testIdPrefix="RecruitmentCoursesPage"
          readOnly={!edit}
          // Issue #358: the budget columns are on the Combined Allocation page, not here.
          omitColumns={AllocationsRelatedColumns}
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
                None of the rows with zero rankings have an email address
                available
              </span>
            )}
          </div>
        )}
        {edit && showFakeAllocations && (
          <FakeAllocationsModal
            recruitments={[
              { recruitmentId: recruitmentId as string, courseCount },
            ]}
            onHide={() => setShowFakeAllocations(false)}
            testIdPrefix="RecruitmentCoursesPage-fake-allocations-modal"
          />
        )}
      </div>
    </BasicLayout>
  );
}
