import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { Button, Form } from "react-bootstrap";
import CollapsibleCard from "main/components/Common/CollapsibleCard";
import RecruitmentAuditTrailTable, {
  type RecruitmentAuditTrailPage,
} from "main/components/Recruitments/RecruitmentAuditTrailTable";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";
import { useBackend } from "main/utils/useBackend";

/**
 * The query key, and the URL, of a quarter's hiring-target changes. A hiring target saved on the
 * Budget page invalidates it (see useBudgetSaves), so an open card shows the new row.
 */
export const HIRING_TARGET_AUDIT_KEY =
  "/api/admin/recruitmentaudittrail/hiringTargets";

/**
 * Issue #391: the Audit Trail card at the bottom of the Budget page. Closed by default; open, it
 * lists every change to the hiring target of the quarter's TA and ULA recruitments, newest first,
 * paged on the server, each row with the type of the recruitment it belongs to. Nothing else about
 * the budget is audited, so nothing else is listed.
 */
export default function BudgetAuditTrailCard({
  yyyyq,
}: {
  /** The quarter, as the backend knows it: 20264. */
  yyyyq: string;
}): React.JSX.Element {
  return (
    <CollapsibleCard
      title="Audit Trail"
      subtitle="Track changes to hiring targets"
      storageKey="BudgetPage-auditTrail"
      testIdPrefix="BudgetPage-auditTrail"
    >
      <HiringTargetChanges yyyyq={yyyyq} />
    </CollapsibleCard>
  );
}

/** The card's body: only rendered, so only fetched, while the card is open. */
function HiringTargetChanges({ yyyyq }: { yyyyq: string }): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  // No page until the first answer, and then, while the next page is fetched, the one before it,
  // so that turning a page never shows the empty sentence in between.
  const { data: trail } = useBackend<RecruitmentAuditTrailPage | undefined>(
    [HIRING_TARGET_AUDIT_KEY, yyyyq, page, pageSize],
    {
      method: "GET",
      url: HIRING_TARGET_AUDIT_KEY,
      params: {
        quarter: yyyyq,
        page,
        size: pageSize,
        sort: "id",
        direction: "desc",
      },
    },
    undefined,
    false,
    { placeholderData: keepPreviousData },
  );

  if (trail === undefined) {
    return (
      <p className="mb-0" data-testid="BudgetPage-audit-loading">
        Loading…
      </p>
    );
  }

  if (trail.totalElements === 0) {
    return (
      <p className="mb-0" data-testid="BudgetPage-audit-empty">
        No hiring target has been changed yet for this quarter.
      </p>
    );
  }

  return (
    <>
      <div className="d-flex align-items-end justify-content-between mb-3 gap-3 flex-wrap">
        <Form.Group controlId="budget-audit-page-size">
          <Form.Label>Page size</Form.Label>
          <Form.Select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            data-testid="BudgetPage-audit-page-size"
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
            // Disabled on the first page, so the clamp below is never exercised.
            // Stryker disable next-line all
            onClick={() => setPage((previous) => Math.max(previous - 1, 0))}
            disabled={page === 0}
            data-testid="BudgetPage-audit-previous"
          >
            Previous
          </Button>
          <span data-testid="BudgetPage-audit-page-indicator">
            Page {trail.number + 1} of {trail.totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((previous) => previous + 1)}
            disabled={page + 1 >= trail.totalPages}
            data-testid="BudgetPage-audit-next"
          >
            Next
          </Button>
        </div>
      </div>
      <p data-testid="BudgetPage-audit-total">
        {trail.totalElements} changes recorded.
      </p>
      <RecruitmentAuditTrailTable
        rows={trail.content}
        showType
        testIdPrefix="BudgetPage-audit"
      />
    </>
  );
}
