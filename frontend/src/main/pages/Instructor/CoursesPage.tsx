import { Link, useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import RecruitmentCourseTable, {
  type RecruitmentCourse,
} from "main/components/Recruitments/RecruitmentCourseTable";
import {
  AdminOnlyColumns,
  AllocationsRelatedColumns,
  courseColumnsStorageKey,
  defaultHiddenColumns,
  instructorColumnChoices,
  isSummerQuarter,
} from "main/utils/courseColumns";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";
import { useBackend } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

/**
 * What /api/instructor/recruitments/{id}/courses answers (issues #300 and #301). The three
 * allocation figures are absent from every row, not blanked, unless {@code allocationsShown}.
 */
export type CoursesView = {
  recruitmentId: number;
  quarter: string;
  type: "TA" | "ULA";
  allocationsShown: boolean;
  courses: Omit<
    RecruitmentCourse,
    "stale" | "manuallyAdded" | "allocationVersion"
  >[];
};

/**
 * The read-only Courses page for faculty (and admins who follow a faculty link):
 * /recruitments/:recruitmentId/courses (issues #300 and #301). It shows every course of the
 * recruitment. The allocation columns (Enrollment Estimate, Allocation, Unrounded Allocation,
 * Delta and TA:student ratio) are in the table only while the admin shows all courses' allocations
 * to all faculty; otherwise the server does not send the figures and the table has no such
 * columns, nor are they offered in the Columns menu. Which of the other columns are hidden is
 * remembered in this browser. This page replaces the old All Allocations page.
 */
export default function CoursesPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const url = `/api/instructor/recruitments/${recruitmentId}/courses`;
  const { data, isError, error, isFetching } = useBackend<CoursesView | null>(
    // Stryker disable next-line all : the key is only observable through invalidation, and nothing here invalidates
    [url],
    // Stryker disable next-line all : GET is axios's default method
    { method: "GET", url },
    null,
    true,
  );

  const { hiddenColumns, toggleColumn } = useStoredHiddenColumns(
    courseColumnsStorageKey(recruitmentId),
    defaultHiddenColumns(),
  );

  const choices = instructorColumnChoices(
    isSummerQuarter(data?.quarter),
    data?.allocationsShown === true,
  );

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="CoursesPage">
        <h1>Courses</h1>
        {isError ? (
          <p role="alert" data-testid="CoursesPage-error">
            Unable to load the courses: {apiErrorMessage(error)}
          </p>
        ) : data == null ? (
          <p role="status">
            {isFetching ? "Loading courses..." : "No courses were returned."}
          </p>
        ) : (
          <>
            <p data-testid="CoursesPage-description">
              Courses for which the department is planning to hire {data.type}s
              for {yyyyqToQyy(data.quarter)}. Your own courses' ranking pages
              are on your <Link to="/">home page</Link>.
            </p>
            <div className="mb-2">
              <ColumnVisibilityControl
                choices={choices}
                hidden={hiddenColumns}
                onToggle={toggleColumn}
                testIdPrefix="CoursesPage-columns"
              />
            </div>
            <RecruitmentCourseTable
              courses={data.courses as RecruitmentCourse[]}
              type={data.type}
              quarter={data.quarter}
              hiddenColumns={hiddenColumns}
              hideLinks={{
                choices,
                onHide: (columnId) => toggleColumn(columnId, true),
              }}
              omitColumns={
                data.allocationsShown
                  ? AdminOnlyColumns
                  : [...AdminOnlyColumns, ...AllocationsRelatedColumns]
              }
              // Stryker disable next-line BooleanLiteral : only part of the key a Remove would invalidate, and nothing here can remove
              includeRemoved={false}
              testIdPrefix="CoursesPage"
              readOnly
            />
          </>
        )}
      </div>
    </BasicLayout>
  );
}
