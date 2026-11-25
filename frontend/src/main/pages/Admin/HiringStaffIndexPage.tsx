import { useBackend } from "main/utils/useBackend";
import { Link } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailTable, {
  NAMES_NOTE,
  type RoleEmail,
} from "main/components/Users/RoleEmailTable";
import {
  HIRING_STAFF_ALL_URL,
  HIRING_STAFF_CREATE_PATH,
  HIRING_STAFF_DELETE_URL,
  HIRING_STAFF_LABEL,
  HIRING_STAFF_NOTE,
} from "main/utils/hiringStaff";

/** Admin → Hiring Staff (issue #504): who holds the role, add by email, delete, like Admins. */
export default function HiringStaffIndexPage(): React.JSX.Element {
  const { data: hiringStaff } = useBackend<RoleEmail[]>(
    [HIRING_STAFF_ALL_URL],
    { method: "GET", url: HIRING_STAFF_ALL_URL },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        <Link
          className="btn btn-primary"
          to={HIRING_STAFF_CREATE_PATH}
          style={{ float: "right" }}
          data-testid="HiringStaffIndexPage-create"
        >
          New Hiring Staff
        </Link>
        <h1>{HIRING_STAFF_LABEL}</h1>
        <p data-testid="HiringStaffIndexPage-names-note">{NAMES_NOTE}</p>
        <p data-testid="HiringStaffIndexPage-role-note">{HIRING_STAFF_NOTE}</p>
        <RoleEmailTable
          // Stryker disable next-line all : the query's initial data is an empty list, never undefined
          data={hiringStaff ?? []}
          deleteEndpoint={HIRING_STAFF_DELETE_URL}
          getEndpoint={HIRING_STAFF_ALL_URL}
          testIdPrefix="HiringStaffIndexPage"
        />
      </div>
    </BasicLayout>
  );
}
