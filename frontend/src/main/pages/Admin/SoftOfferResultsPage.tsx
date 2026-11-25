import { useState } from "react";
import { Button, Table } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ChangeSoftOfferDeadlineModal from "main/components/Recruitments/ChangeSoftOfferDeadlineModal";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { apiErrorMessage } from "main/utils/apiError";
import { formatPacificDateTime } from "main/utils/pacificTime";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  CHANGE_DEADLINE_LABEL,
  SOFT_OFFER_RESULTS_LABEL,
  SOFT_OFFER_RESULTS_URL,
  STAMP_COLUMN,
  STATUS_COLUMN,
  UNASSIGNED_STAMP_COLUMN,
  UNASSIGNED_STATUS_COLUMN,
  countsSentence,
  formatStamp,
  isStaleStatus,
  softOfferResultsCsvFileName,
  softOfferResultsCsvUrl,
  type SoftOfferResults,
} from "main/utils/softOffers";
import { useBackend } from "main/utils/useBackend";

type ResultsTableProps = {
  headers: string[];
  rows: string[][];
  statusColumn: number;
  stampColumn: number;
  testIdPrefix: string;
};

/** A text table: the status cell muted when it answered for another lecture, the stamp in Pacific. */
function ResultsTable({
  headers,
  rows,
  statusColumn,
  stampColumn,
  testIdPrefix,
}: ResultsTableProps): React.JSX.Element {
  return (
    <Table striped bordered size="sm" responsive data-testid={testIdPrefix}>
      <thead>
        <tr>
          {headers.map((header, i) => (
            <th key={i} data-testid={`${testIdPrefix}-header-${i}`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} data-testid={`${testIdPrefix}-row-${r}`}>
            {row.map((cell, c) => (
              <td
                key={c}
                className={
                  c === statusColumn && isStaleStatus(cell)
                    ? "text-muted fst-italic"
                    : undefined
                }
                data-testid={`${testIdPrefix}-row-${r}-c${c}`}
              >
                {c === stampColumn ? formatStamp(cell) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * The admin's Soft Offer Results (issue #487): /admin/recruitments/:recruitmentId/softOffers. When
 * the soft offers were released and their deadline (with Change Deadline), how many assigned ULAs
 * have answered each way, one row per assigned ULA with their answer, a second table of answers
 * from applicants no longer assigned, and the main table as a CSV. Admins only: the answers carry
 * the applicants' comments.
 */
export default function SoftOfferResultsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const [changing, setChanging] = useState(false);

  // Stryker disable all : the query key and axios's default GET are not observable; what is done
  // with the answer is tested
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    [],
  );
  // Stryker restore all
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  // Errors are shown on the page rather than toasted: "not released" is the usual one.
  const { data, isError, error } = useBackend<SoftOfferResults | null>(
    // Stryker disable next-line all : the key is only a cache name, read here alone
    [SOFT_OFFER_RESULTS_URL, recruitmentId],
    { url: SOFT_OFFER_RESULTS_URL, params: { recruitmentId } },
    null,
    true,
  );

  const name = recruitment
    ? `${yyyyqToQyy(recruitment.quarter)} ${recruitment.type}`
    : "";

  return (
    <BasicLayout>
      <div className="pt-2" data-testid="SoftOfferResultsPage">
        <h1 data-testid="SoftOfferResultsPage-title">
          {SOFT_OFFER_RESULTS_LABEL}
          {name !== "" && `: ${name}`}
        </h1>
        {isError ? (
          <p role="alert" data-testid="SoftOfferResultsPage-error">
            {apiErrorMessage(error)}
          </p>
        ) : (
          data && (
            <>
              <p data-testid="SoftOfferResultsPage-release">
                Soft offers released {formatPacificDateTime(data.releasedAt)}.
                Deadline: {formatPacificDateTime(data.deadline)}.{" "}
                {recruitment && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => setChanging(true)}
                    data-testid="SoftOfferResultsPage-change-deadline"
                  >
                    {CHANGE_DEADLINE_LABEL}
                  </Button>
                )}
              </p>
              <p data-testid="SoftOfferResultsPage-counts">
                {countsSentence(data.counts)}
              </p>
              <ResultsTable
                headers={data.headers}
                rows={data.rows}
                statusColumn={STATUS_COLUMN}
                stampColumn={STAMP_COLUMN}
                testIdPrefix="SoftOfferResultsPage-table"
              />
              {data.unassigned.length > 0 && (
                <>
                  <h2
                    className="h5"
                    data-testid="SoftOfferResultsPage-unassigned-title"
                  >
                    Responses from applicants no longer assigned
                  </h2>
                  <ResultsTable
                    headers={data.unassignedHeaders}
                    rows={data.unassigned}
                    statusColumn={UNASSIGNED_STATUS_COLUMN}
                    stampColumn={UNASSIGNED_STAMP_COLUMN}
                    testIdPrefix="SoftOfferResultsPage-unassigned"
                  />
                </>
              )}
              {/* A plain link, so the browser saves the file itself under the backend's name. */}
              <a
                className="btn btn-outline-secondary mt-3"
                href={softOfferResultsCsvUrl(String(recruitmentId))}
                download={softOfferResultsCsvFileName(String(recruitmentId))}
                data-testid="SoftOfferResultsPage-csv"
              >
                Download CSV
              </a>
            </>
          )
        )}
        {changing && recruitment && (
          <ChangeSoftOfferDeadlineModal
            recruitment={recruitment}
            show
            onHide={() => setChanging(false)}
            testIdPrefix="SoftOfferResultsPage-deadline"
          />
        )}
      </div>
    </BasicLayout>
  );
}
