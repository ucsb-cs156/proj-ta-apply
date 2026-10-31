import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Modal, OverlayTrigger, Tooltip } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RecruitmentCourseTable, {
  isValidEmail,
  type RecruitmentCourse,
  type RecruitmentCourseRankingSummary,
} from "main/components/Recruitments/RecruitmentCourseTable";
import HiringTargetPanel from "main/components/Recruitments/HiringTargetPanel";
import PublishAssignmentsPanel from "main/components/Recruitments/PublishAssignmentsPanel";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { lastRefreshedText } from "main/utils/lastRefreshed";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import { autoAssignTooltip } from "main/utils/allocations";
import { toast } from "react-toastify";

/** The course list for one recruitment: /admin/recruitments/:recruitmentId/courses */
export default function RecruitmentCoursesPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  // Removed courses are hidden by default; the toggle is for operations and debugging, to see
  // what an earlier Populate left out.
  const [includeRemoved, setIncludeRemoved] = useState(false);
  // The enroll code typed into the add-by-enroll-code box (issue #125).
  const [enrollCode, setEnrollCode] = useState("");

  const { data: courses } = useBackend<RecruitmentCourse[]>(
    ["/api/recruitmentcourses/all", includeRemoved],
    {
      method: "GET",
      url: "/api/recruitmentcourses/all",
      params: { recruitmentId, includeRemoved },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  // For the last-refreshed line (issue #124); every Populate stamps the recruitment.
  const { data: recruitments } = useBackend<Recruitment[]>(
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
      params: { recruitmentId },
    }),
    {
      onSuccess: () => {
        setShowAutoAssign(false);
        toast("Allocations assigned from the enrollment estimates.");
      },
    },
    ["/api/recruitmentcourses/all"],
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
      <div className="pt-2">
        <h1>Recruitment Courses</h1>
        <p>
          The courses in this recruitment: every lecture of a course flagged for
          its type that is offered that quarter. Re-running Populate picks up
          newly flagged courses and refreshes the offering details, leaves
          removed courses out, and marks as stale any lecture it no longer finds
          in the UCSB schedule or whose course is no longer flagged. Stale
          lectures are hidden from applicants until a later Populate finds them
          again; Remove them if they are not coming back. A cancelled lecture is
          hidden from applicants too, and comes back by itself if the schedule
          un-cancels it. A lecture can also be added by hand by its enroll code,
          flagged course or not; Populate keeps refreshing it for as long as the
          schedule lists it.
        </p>

        {recruitment && (
          <HiringTargetPanel
            recruitment={recruitment}
            allocatedSoFar={allocatedSoFar}
            testIdPrefix="RecruitmentCoursesPage-hiring-target"
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
          <Button
            onClick={() => populateMutation.mutate()}
            data-testid="RecruitmentCoursesPage-populate"
          >
            Populate
          </Button>
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
          <Form.Check
            type="checkbox"
            id="RecruitmentCoursesPage-show-removed"
            label="Show removed courses"
            checked={includeRemoved}
            onChange={() => setIncludeRemoved(!includeRemoved)}
            data-testid="RecruitmentCoursesPage-show-removed"
          />
        </div>

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

        {recruitment && (
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
              This will overwrite all values currently in the allocation fields.
              This cannot be undone.
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

        {rankingSummariesError && (
          <p role="alert">
            Unable to load ranking counts and instructor emails:{" "}
            {apiErrorMessage(rankingSummariesFailure)}
          </p>
        )}
        <RecruitmentCourseTable
          courses={courses ?? []}
          type={recruitment?.type}
          rankingSummaries={rankingSummaries ?? []}
          showRankings={showRankings}
          onCopyEmail={(email) =>
            copyToClipboard(email, "Email copied to clipboard.")
          }
          includeRemoved={includeRemoved}
          testIdPrefix="RecruitmentCoursesPage"
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
        {recruitment && (
          <PublishAssignmentsPanel
            recruitment={recruitment}
            testIdPrefix="RecruitmentCoursesPage-publish"
          />
        )}
      </div>
    </BasicLayout>
  );
}
