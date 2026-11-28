import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import ChangeSoftOfferDeadlineModal from "main/components/Recruitments/ChangeSoftOfferDeadlineModal";
import CopySoftOfferEmails from "main/components/SoftOffers/CopySoftOfferEmails";
import SoftOfferResultsTable from "main/components/SoftOffers/SoftOfferResultsTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { apiErrorMessage } from "main/utils/apiError";
import {
  FUNDING_SOURCES_ALL_URL,
  type FundingSource,
  sortFundingSources,
} from "main/utils/fundingSources";
import { formatPacificDateTime } from "main/utils/pacificTime";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  CHANGE_DEADLINE_LABEL,
  HIRING_URL,
  SOFT_OFFER_RESULTS_LABEL,
  SOFT_OFFER_RESULTS_URL,
  countsSentence,
  pendingChange,
  softOfferResultsCsvFileName,
  softOfferResultsCsvUrl,
  withHiringRecord,
  type HiringChange,
  type HiringRecord,
  type SoftOfferResults,
} from "main/utils/softOffers";
import {
  OPT_IN_COLUMN_IDS,
  RESULTS_COLUMN_IDS,
  SOFT_OFFER_COLUMNS_STORAGE_KEY,
  UNASSIGNED_COLUMN_IDS,
  columnChoices,
} from "main/utils/softOfferResultsColumns";
import { HIRING_STAFF_RECRUITMENTS_URL } from "main/utils/hiringStaff";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useStoredHiddenColumns } from "main/utils/useStoredHiddenColumns";

/**
 * The admin's Soft Offer Results (issue #487): /admin/recruitments/:recruitmentId/softOffers. When
 * the soft offers were released and their deadline (with Change Deadline), how many assigned ULAs
 * have answered each way, one row per assigned ULA with their answer, a second table of answers
 * from applicants no longer assigned, and the main table as a CSV. Above the toolbar, the Copy
 * Soft Offer Emails buttons copy the assigned ULAs' emails by answer (issue #511). For admins and hiring staff
 * (issue #505), who look the recruitment up in the list of those with soft offer results, since
 * only admins may read the list of every recruitment; the answers carry the applicants' comments. Every column but First name and Last name can be hidden from the
 * Columns menu (issue #494), a choice the browser remembers for every recruitment's results, and
 * the second table follows the same choices for the columns it shares.
 *
 * The main table also holds the staff's hiring-tracking fields (issue #509) and Funding (issue
 * #512), shown by default and editable by admins and hiring staff alike: each change is PUT at
 * once, the row shows the stored value and stamp the backend answers with, and the results are
 * re-read.
 */
export default function SoftOfferResultsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();
  const [changing, setChanging] = useState(false);
  const queryClient = useQueryClient();
  const { hiddenColumns, toggleColumn } = useStoredHiddenColumns(
    SOFT_OFFER_COLUMNS_STORAGE_KEY,
    [],
    [...OPT_IN_COLUMN_IDS],
  );
  const hide = (columnId: string) => toggleColumn(columnId, true);

  // Stryker disable all : the query key and axios's default GET are not observable; what is done
  // with the answer is tested
  const { data: recruitments } = useBackend<Recruitment[]>(
    [HIRING_STAFF_RECRUITMENTS_URL],
    { method: "GET", url: HIRING_STAFF_RECRUITMENTS_URL },
    [],
  );
  // The Funding dropdown's choices (issue #512), read once for every row.
  const { data: fundingSources } = useBackend<FundingSource[]>(
    [FUNDING_SOURCES_ALL_URL],
    { method: "GET", url: FUNDING_SOURCES_ALL_URL },
    [],
  );
  // Stryker restore all
  // Stryker disable next-line all : the query's initial data is an empty list, never undefined
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  // Errors are shown on the page rather than toasted: "not released" is the usual one.
  const resultsKey = [SOFT_OFFER_RESULTS_URL, recruitmentId];
  const { data, isError, error } = useBackend<SoftOfferResults | null>(
    resultsKey,
    { url: SOFT_OFFER_RESULTS_URL, params: { recruitmentId } },
    null,
    true,
  );

  // One PUT per field change (issue #509). Its answer, the row's whole record, replaces the row's
  // record at once, so the stored value and stamp show before the re-read that follows (the
  // mutation's query key) has answered. A refusal is toasted, as usual.
  const hiringMutation = useBackendMutation<HiringChange, HiringRecord>(
    (change) => ({ url: HIRING_URL, method: "PUT", params: change }),
    {
      onSuccess: (record) =>
        queryClient.setQueryData<SoftOfferResults | null>(
          resultsKey,
          (current) => withHiringRecord(current, record),
        ),
    },
    [SOFT_OFFER_RESULTS_URL],
  );

  const name = recruitment
    ? `${yyyyqToQyy(recruitment.quarter)} ${recruitment.type}`
    : "";
  // The main table's columns, less First name and Last name: the second table follows the same
  // choices for the columns it shares, and its own column stays.
  // Stryker disable next-line ArrayDeclaration : the menu and the tables are only shown once data has arrived
  const choices = columnChoices(RESULTS_COLUMN_IDS, data?.headers ?? []);

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
              {/* Issue #511: copy the assigned ULAs' emails, by how they answered. */}
              <CopySoftOfferEmails
                rows={data.rows}
                testIdPrefix="SoftOfferResultsPage-copy-emails"
              />
              {/* The CSV is a plain link, so the browser saves the file itself under the backend's
                  name; it holds every column, whatever is hidden here. */}
              <div
                className="d-flex flex-wrap gap-2 mb-2"
                data-testid="SoftOfferResultsPage-toolbar"
              >
                <ColumnVisibilityControl
                  choices={choices}
                  hidden={hiddenColumns}
                  onToggle={toggleColumn}
                  testIdPrefix="SoftOfferResultsPage-columns"
                />
                <a
                  className="btn btn-outline-secondary btn-sm"
                  href={softOfferResultsCsvUrl(String(recruitmentId))}
                  download={softOfferResultsCsvFileName(String(recruitmentId))}
                  data-testid="SoftOfferResultsPage-csv"
                >
                  Download CSV
                </a>
              </div>
              <SoftOfferResultsTable
                headers={data.headers}
                rows={data.rows}
                columnIds={RESULTS_COLUMN_IDS}
                hiddenColumns={hiddenColumns}
                choices={choices}
                onHide={hide}
                testIdPrefix="SoftOfferResultsPage-table"
                hiring={{
                  applicationIds: data.applicationIds,
                  records: data.hiring,
                  // The query's initial data is an empty list, never undefined; sorting (the
                  // backend's order already) is how the type says so.
                  fundingSources: sortFundingSources(fundingSources),
                  onChange: (change) => hiringMutation.mutate(change),
                  pending: pendingChange(
                    hiringMutation.isPending,
                    hiringMutation.variables,
                  ),
                }}
              />
              {data.unassigned.length > 0 && (
                <>
                  <h2
                    className="h5"
                    data-testid="SoftOfferResultsPage-unassigned-title"
                  >
                    Responses from applicants no longer assigned
                  </h2>
                  <SoftOfferResultsTable
                    headers={data.unassignedHeaders}
                    rows={data.unassigned}
                    columnIds={UNASSIGNED_COLUMN_IDS}
                    hiddenColumns={hiddenColumns}
                    choices={choices}
                    onHide={hide}
                    testIdPrefix="SoftOfferResultsPage-unassigned"
                  />
                </>
              )}
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
