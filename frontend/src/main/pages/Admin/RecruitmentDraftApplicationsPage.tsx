import { Link, useParams } from "react-router";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { toast } from "react-toastify";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { useBackend } from "main/utils/useBackend";
import ColumnVisibilityControl from "main/components/Common/ColumnVisibilityControl";
import { applicationColumnChoices } from "main/utils/applicationColumns";
import { useHiddenApplicationColumns } from "main/utils/useHiddenApplicationColumns";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  adminApplicationUrls,
  applicationsListPath,
  draftEmailsCopiedText,
  draftEmailsTooltip,
  draftsText,
} from "main/utils/adminApplications";
import type { AdminDraftApplication } from "main/utils/draftApplications";

/**
 * An admin's overview of one recruitment's draft applications (issue #296), the applications
 * students have started and not yet submitted: /admin/recruitments/:recruitmentId/draft-applications.
 *
 * It is the Applications page's table, with the same columns (and the same choice of which to
 * hide), but without the Edit column: an admin may leave comments on a draft, and they go with it
 * to the application when it is submitted, but may not change what the student wrote.
 */
export default function RecruitmentDraftApplicationsPage(): React.JSX.Element {
  const { recruitmentId } = useParams();

  // Stryker disable all : the query keys and axios's default GET are not observable; what the
  // requests carry, and what is done with the answers, is tested
  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    [],
  );
  const recruitment = (recruitments ?? []).find(
    (r) => String(r.id) === recruitmentId,
  );

  const urls = adminApplicationUrls(true);
  const { data: drafts } = useBackend<AdminDraftApplication[]>(
    [urls.all, recruitmentId],
    { method: "GET", url: urls.all, params: { recruitmentId } },
    [],
  );
  // useBackend hands back its initial list until the answer arrives; the guards are for the types
  const draftList = Array.isArray(drafts) ? drafts : [];
  // Stryker restore all

  const columnChoices = applicationColumnChoices(
    recruitment?.type ?? "TA",
    true,
  );
  const { hiddenColumns, toggleColumn } = useHiddenApplicationColumns(
    recruitmentId,
    recruitment?.type,
  );

  // Issue #411: the addresses of everyone with a draft, one per line in the table's order, so an
  // admin can remind them to submit before the deadline.
  const copyDraftEmails = async () => {
    try {
      await navigator.clipboard.writeText(
        draftList.map((draft) => draft.email).join("\n"),
      );
      toast(draftEmailsCopiedText(draftList.length));
    } catch {
      toast(
        "Unable to copy to clipboard. Check your browser clipboard permissions.",
      );
    }
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
          <h1 className="me-auto mb-0">
            {`Draft Applications${
              recruitment
                ? `: ${recruitment.type} positions, ${yyyyqToQyy(recruitment.quarter)}`
                : ""
            }`}
          </h1>
          <Link
            className="btn btn-outline-primary"
            // Stryker disable next-line StringLiteral : the route always supplies the id
            to={applicationsListPath(recruitmentId ?? "")}
            data-testid="RecruitmentDraftApplicationsPage-applications-link"
          >
            Applications
          </Link>
        </div>

        <RecruitmentTable
          recruitments={recruitment ? [recruitment] : []}
          testIdPrefix="RecruitmentDraftApplicationsPage-recruitment"
        />

        <h2
          className="h4 mt-4"
          data-testid="RecruitmentDraftApplicationsPage-count"
        >
          {draftsText(draftList.length)}
        </h2>
        <p
          className="text-muted"
          data-testid="RecruitmentDraftApplicationsPage-about"
        >
          Applications that students have started but not yet submitted. They
          are not considered until submitted. You can leave comments on a draft;
          they are copied to the application when it is submitted.
        </p>

        {draftList.length === 0 ? (
          <p data-testid="RecruitmentDraftApplicationsPage-none">
            No one has a draft application for this recruitment right now.
          </p>
        ) : (
          <>
            <div className="mb-2">
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip id="RecruitmentDraftApplicationsPage-copy-emails-tooltip">
                    {draftEmailsTooltip(recruitment?.primaryConsiderationDate)}
                  </Tooltip>
                }
              >
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={copyDraftEmails}
                  data-testid="RecruitmentDraftApplicationsPage-copy-emails"
                >
                  Copy emails of draft applicants to clipboard
                </Button>
              </OverlayTrigger>
            </div>
            <div className="mb-2">
              <ColumnVisibilityControl
                choices={columnChoices}
                hidden={hiddenColumns}
                onToggle={toggleColumn}
                testIdPrefix="RecruitmentDraftApplicationsPage-columns"
              />
            </div>
            <AdminApplicationTable
              applications={draftList}
              draft
              type={recruitment?.type ?? "TA"}
              hiddenColumns={hiddenColumns}
              hideLinks={{
                choices: columnChoices,
                onHide: (columnId) => toggleColumn(columnId, true),
              }}
              testIdPrefix="RecruitmentDraftApplicationsPage-drafts"
            />
          </>
        )}
      </div>
    </BasicLayout>
  );
}
