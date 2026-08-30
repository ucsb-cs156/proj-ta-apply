import { useBackend } from "main/utils/useBackend";
import { Link } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailTable, {
  type RoleEmail,
} from "main/components/Users/RoleEmailTable";

export default function AdminsIndexPage(): React.JSX.Element {
  const { data: admins } = useBackend<RoleEmail[]>(
    ["/api/admin/all"],
    { method: "GET", url: "/api/admin/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const createButton = () => {
    return (
      <Link
        className="btn btn-primary"
        to="/admin/admins/create"
        style={{ float: "right" }}
      >
        New Admin
      </Link>
    );
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        {createButton()}
        <h1>Admins</h1>
        <RoleEmailTable
          data={admins ?? []}
          deleteEndpoint="/api/admin/delete"
          getEndpoint="/api/admin/all"
          testIdPrefix="AdminsIndexPage"
        />
        <p>
          Note: Initial admins that are set in the <code>ADMIN_EMAILS</code>
          &nbsp; configuration cannot be deleted through the application.
        </p>
      </div>
    </BasicLayout>
  );
}
