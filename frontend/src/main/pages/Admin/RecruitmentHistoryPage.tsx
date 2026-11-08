import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { Link, useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import RecruitmentAuditTrailTable, {
  type RecruitmentAuditTrailPage,
} from "main/components/Recruitments/RecruitmentAuditTrailTable";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

// Stryker disable all : the page before the first answer; nothing reads its fields
const emptyAuditPage: RecruitmentAuditTrailPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};
// Stryker restore all

/**
 * The change history of one recruitment (issue #390): /admin/recruitments/:recruitmentId/history.
 * Every change to the recruitment itself (issue #139), paged on the server, newest first, with the
 * admin who made it (issue #337). Until #390 this was a collapsible card at the bottom of the
 * recruitment's Applications page; the card's Change History button opens this page instead.
 */
export default function RecruitmentHistoryPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  // Stryker disable all : the query key and axios's default GET are not observable; what is done
  // with the answer is tested
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    [],
  );
  // Stryker restore all
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  // Issue #139: the recruitment's own audit trail, paged on the server, newest first.
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const { data: auditTrail } = useBackend<RecruitmentAuditTrailPage>(
    [
      // Stryker disable next-line StringLiteral : the query key is not observable
      "/api/admin/recruitmentaudittrail/all",
      recruitmentId,
      auditPage,
      auditPageSize,
    ],
    {
      // Stryker disable next-line StringLiteral : axios's default is GET
      method: "GET",
      url: "/api/admin/recruitmentaudittrail/all",
      params: {
        recruitmentId,
        page: auditPage,
        size: auditPageSize,
        sort: "id",
        direction: "desc",
      },
    },
    emptyAuditPage,
  );
  // useBackend always hands back the initial page, so the guards below never fire; the Previous
  // button is disabled on the first page, so its clamp is never exercised either.
  // Stryker disable next-line all
  const auditTotalPages = auditTrail?.totalPages ?? 0;
  // Stryker disable next-line all
  const auditPageNumber = auditTrail?.number ?? 0;
  // Stryker disable next-line all
  const auditTotal = auditTrail?.totalElements ?? 0;
  // Stryker disable next-line all
  const auditRows = auditTrail?.content ?? [];
  const previousAuditPage = () =>
    // Stryker disable next-line all
    setAuditPage((previousPage) => Math.max(previousPage - 1, 0));

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1 className="mb-3" data-testid="RecruitmentHistoryPage-title">
          {`Change History${
            recruitment
              ? `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`
              : ""
          }`}
        </h1>

        <RecruitmentTable
          recruitments={recruitment ? [recruitment] : []}
          testIdPrefix="RecruitmentHistoryPage-recruitment"
        />

        <p className="mt-4" data-testid="RecruitmentHistoryPage-audit-intro">
          Every change to this recruitment itself, newest first: when it was
          created, each time it was opened or closed, and each date that
          changed. Changes to individual applications are on the{" "}
          <Link
            to="/admin/audittrail"
            data-testid="RecruitmentHistoryPage-audit-trail-link"
          >
            Audit Trail page
          </Link>
          .
        </p>
        <div className="d-flex align-items-end justify-content-between mb-3 gap-3 flex-wrap">
          <Form.Group controlId="recruitment-audit-page-size">
            <Form.Label>Page size</Form.Label>
            <Form.Select
              value={auditPageSize}
              onChange={(event) => {
                setAuditPageSize(Number(event.target.value));
                setAuditPage(0);
              }}
              data-testid="RecruitmentHistoryPage-audit-page-size"
            >
              {AUDIT_PAGE_SIZES.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="secondary"
              onClick={previousAuditPage}
              disabled={auditPage === 0}
              data-testid="RecruitmentHistoryPage-audit-previous"
            >
              Previous
            </Button>
            <span data-testid="RecruitmentHistoryPage-audit-page-indicator">
              Page {auditPageNumber + 1} of {Math.max(auditTotalPages, 1)}
            </span>
            <Button
              variant="secondary"
              onClick={() => setAuditPage((previousPage) => previousPage + 1)}
              disabled={auditPage + 1 >= auditTotalPages}
              data-testid="RecruitmentHistoryPage-audit-next"
            >
              Next
            </Button>
          </div>
        </div>
        <p data-testid="RecruitmentHistoryPage-audit-total">
          {auditTotal} changes recorded.
        </p>
        <RecruitmentAuditTrailTable
          rows={auditRows}
          testIdPrefix="RecruitmentHistoryPage-audit"
        />
      </div>
    </BasicLayout>
  );
}
