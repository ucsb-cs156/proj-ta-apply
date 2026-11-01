import { useState } from "react";
import { useParams } from "react-router";
import { Form } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { useBackend } from "main/utils/useBackend";
import { apiErrorMessage } from "main/utils/apiError";
import {
  LAYOUT_LABELS,
  assignmentsCsvFileName,
  assignmentsCsvUrl,
  type AssignmentsLayout,
  type PublishedAssignmentsTable,
} from "main/utils/publishedAssignments";
import { TENTATIVE_NOTE } from "main/utils/recruitmentSteps";

const LAYOUTS: AssignmentsLayout[] = ["course", "student"];

/**
 * The published assignments of a recruitment, read-only, for admins and instructors (issue
 * #180): /recruitments/:recruitmentId/assignments. One row per course or one row per TA/ULA, as
 * the radio buttons say, and the same table as a CSV download in either layout.
 */
export default function PublishedAssignmentsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const [layout, setLayout] = useState<AssignmentsLayout>("course");

  // Errors are shown on the page rather than toasted: the usual one is "not published yet".
  const { data, isError, error } = useBackend<PublishedAssignmentsTable | null>(
    // Stryker disable next-line all : the key is only a cache name, read here alone
    ["/api/assignments", recruitmentId, layout],
    { url: "/api/assignments", params: { recruitmentId, layout } },
    null,
    true,
  );

  // Every cell is text; a row becomes an object keyed c0, c1, ... so two columns may share a
  // heading (the TA columns do).
  const columns: LegacyColumn[] = (data?.headers ?? []).map((header, i) => ({
    id: `c${i}`,
    header,
    accessorKey: `c${i}`,
  }));
  const rows = (data?.rows ?? []).map((row) =>
    Object.fromEntries(row.map((cell, i) => [`c${i}`, cell])),
  );

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="PublishedAssignmentsPage">
        <h1>Assignments</h1>
        {data?.tentative === true && (
          <p
            className="fw-bold text-warning-emphasis"
            data-testid="PublishedAssignmentsPage-tentative"
          >
            {TENTATIVE_NOTE}
          </p>
        )}
        {data && (
          <p data-testid="PublishedAssignmentsPage-type">
            {data.type} recruitment: who has been assigned to each course.
          </p>
        )}
        <Form className="mb-3" data-testid="PublishedAssignmentsPage-layout">
          {LAYOUTS.map((option) => (
            <Form.Check
              key={option}
              inline
              type="radio"
              name="layout"
              id={`PublishedAssignmentsPage-layout-${option}`}
              label={LAYOUT_LABELS[option]}
              value={option}
              checked={layout === option}
              onChange={() => setLayout(option)}
              data-testid={`PublishedAssignmentsPage-layout-${option}`}
            />
          ))}
        </Form>
        {isError ? (
          <p role="alert" data-testid="PublishedAssignmentsPage-error">
            {apiErrorMessage(error)}
          </p>
        ) : (
          <OurTable
            data={rows}
            columns={columns}
            testid="PublishedAssignmentsPage-table"
          />
        )}
        <div className="d-flex flex-wrap gap-2 mt-3">
          {/* Plain links, so the browser saves the file itself under the backend's name. */}
          <a
            className="btn btn-outline-secondary"
            href={assignmentsCsvUrl(String(recruitmentId), "course")}
            download={assignmentsCsvFileName(String(recruitmentId), "course")}
            data-testid="PublishedAssignmentsPage-csv-course"
          >
            Download CSV (row per course)
          </a>
          <a
            className="btn btn-outline-secondary"
            href={assignmentsCsvUrl(String(recruitmentId), "student")}
            download={assignmentsCsvFileName(String(recruitmentId), "student")}
            data-testid="PublishedAssignmentsPage-csv-student"
          >
            Download CSV (row per student)
          </a>
        </div>
      </div>
    </BasicLayout>
  );
}
