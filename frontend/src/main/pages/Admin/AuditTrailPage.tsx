import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
import AuditTrailTable, {
  type AuditTrailRow,
} from "main/components/AuditTrail/AuditTrailTable";
import { SORT_OPTIONS, type SortColumn } from "main/utils/auditTrail";

type AuditTrailPage = {
  content: AuditTrailRow[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

const pageSizeOptions = [10, 25, 50, 100, 500];

const emptyPage: AuditTrailPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

/**
 * The whole audit trail, paged and sorted on the server: /admin/audittrail. Sorting is chosen
 * above the table rather than by clicking a header, because a header click could only reorder
 * the one page already fetched.
 */
export default function AuditTrailPage(): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<SortColumn>("id");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const { data: trailPage } = useBackend<AuditTrailPage>(
    ["/api/admin/audittrail/all", page, pageSize, sort, direction],
    {
      method: "GET",
      url: "/api/admin/audittrail/all",
      params: { page, size: pageSize, sort, direction },
    },
    emptyPage,
  );

  const totalPages = Math.max(trailPage?.totalPages ?? 0, 1);
  const currentPage = (trailPage?.number ?? 0) + 1;

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Audit Trail</h1>
        <p>
          Every change an admin has made to a field of a student&apos;s
          application: which application, which field, and the value before and
          after. Values longer than a line are cut short here; use{" "}
          <i>[See value]</i> to read the whole thing.
        </p>
        <div className="d-flex align-items-end justify-content-between mb-3 gap-3 flex-wrap">
          <div className="d-flex align-items-end gap-3 flex-wrap">
            <Form.Group controlId="audit-trail-sort">
              <Form.Label>Sort by</Form.Label>
              <Form.Select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortColumn);
                  setPage(0);
                }}
                data-testid="AuditTrailPage-sort"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="audit-trail-direction">
              <Form.Label>Direction</Form.Label>
              <Form.Select
                value={direction}
                onChange={(event) => {
                  setDirection(event.target.value as "asc" | "desc");
                  setPage(0);
                }}
                data-testid="AuditTrailPage-direction"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </Form.Select>
            </Form.Group>
            <Form.Group controlId="audit-trail-page-size">
              <Form.Label>Page size</Form.Label>
              <Form.Select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(0);
                }}
                data-testid="AuditTrailPage-page-size"
              >
                {pageSizeOptions.map((sizeOption) => (
                  <option key={sizeOption} value={sizeOption}>
                    {sizeOption}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setPage((previousPage) => Math.max(previousPage - 1, 0))
              }
              disabled={page === 0}
              data-testid="AuditTrailPage-previous"
            >
              Previous
            </Button>
            <span data-testid="AuditTrailPage-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((previousPage) => previousPage + 1)}
              disabled={page + 1 >= (trailPage?.totalPages ?? 0)}
              data-testid="AuditTrailPage-next"
            >
              Next
            </Button>
          </div>
        </div>
        <p data-testid="AuditTrailPage-total">
          {trailPage?.totalElements ?? 0} changes recorded.
        </p>
        <AuditTrailTable
          rows={trailPage?.content ?? []}
          testIdPrefix="AuditTrailPage-table"
        />
      </div>
    </BasicLayout>
  );
}
