import { Alert, Table } from "react-bootstrap";
import { Link } from "react-router";
import { useBackend } from "main/utils/useBackend";
import { adminApplicationPath } from "main/utils/adminApplications";

/** One student with both a draft and a finalized application to the recruitment (issue #417). */
export type DraftConflict = {
  email: string;
  draftApplicationId: number;
  applicationId: number;
};

export const DRAFT_CONFLICTS_URL = "/api/admin/applications/draftConflicts";

type DraftConflictWarningProps = {
  /** The recruitment whose students are checked; the page's own, from the route. */
  recruitmentId: string | undefined;
  testIdPrefix?: string;
};

/**
 * Issue #417: a warning at the top of an admin's Applications and Draft Applications pages, listing
 * every student who has both a draft and a finalized (not cancelled) application to the
 * recruitment. That is not supposed to be possible, since submitting an application deletes its
 * draft, so normally the list is empty and nothing is shown. The check is made again each time the
 * page is loaded; the warning only reports, and changes nothing.
 */
export default function DraftConflictWarning({
  recruitmentId,
  testIdPrefix = "DraftConflictWarning",
}: DraftConflictWarningProps): React.JSX.Element | null {
  // Stryker disable all : the query key and axios's default GET are not observable; what the
  // request carries, and what is done with the answer, is tested
  const { data } = useBackend<DraftConflict[]>(
    [DRAFT_CONFLICTS_URL, recruitmentId],
    { method: "GET", url: DRAFT_CONFLICTS_URL, params: { recruitmentId } },
    [],
  );
  // useBackend hands back its initial list until the answer arrives; the guard is for the types
  const conflicts = Array.isArray(data) ? data : [];
  // Stryker restore all

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Alert variant="danger" className="mb-3" data-testid={testIdPrefix}>
      <Alert.Heading as="h2" className="h4">
        WARNING
      </Alert.Heading>
      <p>
        The following students have both a draft application and a regular
        application. This is not supposed to be possible, and represents a bug
        in the application.
      </p>
      <Table
        bordered
        size="sm"
        className="mb-0"
        data-testid={`${testIdPrefix}-table`}
      >
        <thead>
          <tr>
            <th>email</th>
            <th>draft application</th>
            <th>finalized application</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((conflict) => (
            <tr
              // Stryker disable next-line StringLiteral : React key property not exposed in dom
              key={`${conflict.draftApplicationId}-${conflict.applicationId}`}
              data-testid={`${testIdPrefix}-row`}
            >
              <td>{conflict.email}</td>
              <td>
                <Link
                  to={adminApplicationPath(conflict.draftApplicationId, true)}
                  data-testid={`${testIdPrefix}-draft-link`}
                >
                  {conflict.draftApplicationId}
                </Link>
              </td>
              <td>
                <Link
                  to={adminApplicationPath(conflict.applicationId)}
                  data-testid={`${testIdPrefix}-application-link`}
                >
                  {conflict.applicationId}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Alert>
  );
}
