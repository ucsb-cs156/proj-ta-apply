import { Link } from "react-router";

type ApplicationsPageHeaderProps = {
  recruitmentId: number | string;
  title?: string;
  testIdPrefix?: string;
};

/**
 * The top of the admin Applications page as docs/design/AdminUserInterfaceDesign.md lays it out:
 * the title, then the two controls that move here from the recruitment card, Download Applications
 * as CSV (the former Download CSV) and Test Application. Designed in Storybook first (issue #230);
 * issue #234 puts it on the page.
 */
export default function ApplicationsPageHeader({
  recruitmentId,
  title = "Applications",
  testIdPrefix = "ApplicationsPageHeader",
}: ApplicationsPageHeaderProps): React.JSX.Element {
  return (
    <div
      className="d-flex align-items-center flex-wrap gap-2 mb-3"
      data-testid={testIdPrefix}
    >
      <h1 className="me-auto mb-0">{title}</h1>
      <a
        className="btn btn-outline-primary"
        href={`/api/admin/applications/csv?recruitmentId=${recruitmentId}`}
        download={`applications-${recruitmentId}.csv`}
        data-testid={`${testIdPrefix}-download-csv`}
      >
        Download Applications as CSV
      </a>
      <Link
        className="btn btn-outline-secondary"
        to={`/admin/recruitments/${recruitmentId}/test-application`}
        data-testid={`${testIdPrefix}-test-application`}
      >
        Test Application
      </Link>
    </div>
  );
}
