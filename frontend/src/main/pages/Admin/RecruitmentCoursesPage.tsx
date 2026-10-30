import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RecruitmentCourseTable, {
  type RecruitmentCourse,
} from "main/components/Recruitments/RecruitmentCourseTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { lastRefreshedText } from "main/utils/lastRefreshed";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";

/** The course list for one recruitment: /admin/recruitments/:recruitmentId/courses */
export default function RecruitmentCoursesPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  // Removed courses are hidden by default; the toggle is for operations and debugging, to see
  // what an earlier Populate left out.
  const [includeRemoved, setIncludeRemoved] = useState(false);

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
          un-cancels it.
        </p>

        <p data-testid="RecruitmentCoursesPage-last-refreshed">
          {lastRefreshedText(recruitment?.lastPopulatedAt)} Open, upcoming and
          recently closed recruitments are also refreshed automatically every
          night.
        </p>

        <div className="d-flex align-items-center gap-3 mb-3">
          <Button
            onClick={() => populateMutation.mutate()}
            data-testid="RecruitmentCoursesPage-populate"
          >
            Populate
          </Button>
          <Form.Check
            type="checkbox"
            id="RecruitmentCoursesPage-show-removed"
            label="Show removed courses"
            checked={includeRemoved}
            onChange={() => setIncludeRemoved(!includeRemoved)}
            data-testid="RecruitmentCoursesPage-show-removed"
          />
        </div>

        <RecruitmentCourseTable
          courses={courses ?? []}
          includeRemoved={includeRemoved}
          testIdPrefix="RecruitmentCoursesPage"
        />
      </div>
    </BasicLayout>
  );
}
