import { useBackend } from "main/utils/useBackend";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailTable, {
  type RoleEmail,
} from "main/components/Users/RoleEmailTable";
import { Link } from "react-router";

export default function InstructorsIndexPage(): React.JSX.Element {
  const { data: instructors } = useBackend<RoleEmail[]>(
    ["/api/admin/instructors/get"],
    { method: "GET", url: "/api/admin/instructors/get" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const createButton = () => {
    return (
      <Link
        className="btn btn-primary"
        to="/admin/instructors/create"
        style={{ float: "right" }}
      >
        New Instructor
      </Link>
    );
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        {createButton()}
        <h1>Instructors</h1>
        <RoleEmailTable
          data={instructors ?? []}
          deleteEndpoint="/api/admin/instructors/delete"
          getEndpoint="/api/admin/instructors/get"
          testIdPrefix="InstructorsIndexPage"
        />
      </div>
    </BasicLayout>
  );
}
