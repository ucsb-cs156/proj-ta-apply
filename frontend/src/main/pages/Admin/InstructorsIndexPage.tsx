import { useBackend, useBackendMutation } from "main/utils/useBackend";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailTable, {
  type RoleEmail,
} from "main/components/Users/RoleEmailTable";
import RoleEmailCsvUploadForm, {
  type RoleEmailCsvUploadFormFields,
} from "main/components/Users/RoleEmailCsvUploadForm";
import { Link } from "react-router";
import { toast } from "react-toastify";
import {
  csvUploadAxiosParams,
  uploadResultMessage,
  type UploadResult,
} from "main/utils/csvUpload";

export default function InstructorsIndexPage(): React.JSX.Element {
  const { data: instructors } = useBackend<RoleEmail[]>(
    ["/api/admin/instructors/get"],
    { method: "GET", url: "/api/admin/instructors/get" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const uploadMutation = useBackendMutation<
    RoleEmailCsvUploadFormFields,
    UploadResult
  >(
    (data) =>
      csvUploadAxiosParams("/api/admin/instructors/upload/csv", data.upload[0]),
    { onSuccess: (result: UploadResult) => toast(uploadResultMessage(result)) },
    ["/api/admin/instructors/get"],
  );

  const onUpload = async (data: RoleEmailCsvUploadFormFields) => {
    uploadMutation.mutate(data);
  };

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
        <hr />
        <h2>Bulk Upload</h2>
        <RoleEmailCsvUploadForm
          submitAction={onUpload}
          label="Upload Instructor Emails (CSV)"
          testIdPrefix="InstructorCSVUploadForm"
        />
      </div>
    </BasicLayout>
  );
}
