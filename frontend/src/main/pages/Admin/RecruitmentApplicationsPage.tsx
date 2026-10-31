import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { useParams } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import {
  APPLICATIONS_TABLE_KEY,
  DEFAULTS_MARKER,
  applicationColumnChoices,
  defaultHiddenColumns,
} from "main/utils/applicationColumns";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import type { Application } from "main/components/Applications/ApplicationTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { receivedText } from "main/utils/adminApplications";
import RecruitmentAuditTrailTable, {
  type RecruitmentAuditTrailPage,
} from "main/components/Recruitments/RecruitmentAuditTrailTable";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";

// Stryker disable next-line all : the page before the first answer; nothing reads its fields
const emptyAuditPage: RecruitmentAuditTrailPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

/** An admin's overview of one recruitment's applications: /admin/recruitments/:recruitmentId/applications */
export default function RecruitmentApplicationsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  const { data: applications } = useBackend<Application[]>(
    ["/api/admin/applications/all", recruitmentId],
    {
      method: "GET",
      url: "/api/admin/applications/all",
      params: { recruitmentId },
    },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );
  const applicationList = Array.isArray(applications) ? applications : [];

  // Issue #189: which columns the admin has hidden on this recruitment's table, kept on the
  // backend so they stay hidden across visits and browsers. The first time a recruitment's table
  // is opened, the columns that start hidden are written there, with a marker so that an admin
  // who later shows every column is not given the defaults again.
  // Stryker disable all : a shorter key still prefixes the same query; invalidation is tested
  const hiddenColumnsKey = [
    "/api/admin/hiddencolumns",
    APPLICATIONS_TABLE_KEY,
    recruitmentId,
  ];
  // Stryker restore all
  const { data: hiddenColumnsData, isFetchedAfterMount: hiddenColumnsFetched } =
    useBackend<string[]>(
      hiddenColumnsKey,
      {
        // Stryker disable next-line all : GET is axios's default method
        method: "GET",
        url: "/api/admin/hiddencolumns",
        params: { tableKey: APPLICATIONS_TABLE_KEY, recruitmentId },
      },
      // Stryker disable next-line all : don't test default value of empty list
      [],
    );
  // Stryker disable all : the query's initial data is an empty list, never undefined
  const hiddenColumns = useMemo(
    () => hiddenColumnsData ?? [],
    [hiddenColumnsData],
  );
  // Stryker restore all
  const hideColumnMutation = useBackendMutation<
    { columnId: string; hidden: boolean },
    string[]
  >(
    ({ columnId, hidden }) => ({
      url: "/api/admin/hiddencolumns",
      method: "PUT",
      params: {
        tableKey: APPLICATIONS_TABLE_KEY,
        recruitmentId,
        columnId,
        hidden,
      },
    }),
    {},
    hiddenColumnsKey,
  );
  const seedDefaultsMutation = useBackendMutation<string[], string[]>(
    (columnIds) => ({
      url: "/api/admin/hiddencolumns/all",
      method: "PUT",
      params: {
        tableKey: APPLICATIONS_TABLE_KEY,
        recruitmentId,
        columnIds: columnIds.join(","),
      },
    }),
    {},
    hiddenColumnsKey,
  );
  const defaultsChecked = useRef(false);
  const seedDefaults = seedDefaultsMutation.mutate;
  const recruitmentType = recruitment?.type;
  // Stryker disable all : the ref guard and the dependency list only matter across re-renders,
  // which the tests cannot tell apart; the seeding itself is tested
  useEffect(() => {
    if (
      defaultsChecked.current ||
      !hiddenColumnsFetched ||
      recruitmentType === undefined
    ) {
      return;
    }
    defaultsChecked.current = true;
    if (!hiddenColumns.includes(DEFAULTS_MARKER)) {
      seedDefaults(defaultHiddenColumns(recruitmentType));
    }
  }, [hiddenColumnsFetched, recruitmentType, hiddenColumns, seedDefaults]);
  // Stryker restore all

  // Issue #139: the recruitment's own audit trail, paged on the server, newest first.
  const [auditPage, setAuditPage] = useState(0);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const { data: auditTrail } = useBackend<RecruitmentAuditTrailPage>(
    [
      "/api/admin/recruitmentaudittrail/all",
      recruitmentId,
      auditPage,
      auditPageSize,
    ],
    {
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
        <h1>
          Applications
          {recruitment &&
            `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`}
        </h1>

        <RecruitmentTable
          recruitments={recruitment ? [recruitment] : []}
          testIdPrefix="RecruitmentApplicationsPage-recruitment"
        />

        <h2 className="h4 mt-4" data-testid="RecruitmentApplicationsPage-count">
          {receivedText(applicationList)}
        </h2>

        <div className="mb-2">
          <ColumnVisibilityControl
            choices={applicationColumnChoices(recruitment?.type ?? "TA")}
            hidden={hiddenColumns}
            onToggle={(columnId, hidden) =>
              hideColumnMutation.mutate({ columnId, hidden })
            }
            testIdPrefix="RecruitmentApplicationsPage-columns"
          />
        </div>
        <AdminApplicationTable
          applications={applicationList}
          type={recruitment?.type ?? "TA"}
          hiddenColumns={hiddenColumns}
          testIdPrefix="RecruitmentApplicationsPage-applications"
        />

        <h2 className="h4 mt-4">Change History</h2>
        <p data-testid="RecruitmentApplicationsPage-audit-intro">
          Every change to this recruitment itself, newest first: when it was
          created, each time it was opened or closed, and each date that
          changed. Changes to individual applications are on the Audit Trail
          page.
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
              data-testid="RecruitmentApplicationsPage-audit-page-size"
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
              data-testid="RecruitmentApplicationsPage-audit-previous"
            >
              Previous
            </Button>
            <span data-testid="RecruitmentApplicationsPage-audit-page-indicator">
              Page {auditPageNumber + 1} of {Math.max(auditTotalPages, 1)}
            </span>
            <Button
              variant="secondary"
              onClick={() => setAuditPage((previousPage) => previousPage + 1)}
              disabled={auditPage + 1 >= auditTotalPages}
              data-testid="RecruitmentApplicationsPage-audit-next"
            >
              Next
            </Button>
          </div>
        </div>
        <p data-testid="RecruitmentApplicationsPage-audit-total">
          {auditTotal} changes recorded.
        </p>
        <RecruitmentAuditTrailTable
          rows={auditRows}
          testIdPrefix="RecruitmentApplicationsPage-audit"
        />
      </div>
    </BasicLayout>
  );
}
