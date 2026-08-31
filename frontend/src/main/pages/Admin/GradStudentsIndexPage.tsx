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

export default function GradStudentsIndexPage(): React.JSX.Element {
  const { data: gradstudents } = useBackend<RoleEmail[]>(
    ["/api/admin/gradstudents/get"],
    { method: "GET", url: "/api/admin/gradstudents/get" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const uploadMutation = useBackendMutation<
    RoleEmailCsvUploadFormFields,
    UploadResult
  >(
    (data) =>
      csvUploadAxiosParams(
        "/api/admin/gradstudents/upload/csv",
        data.upload[0],
      ),
    { onSuccess: (result: UploadResult) => toast(uploadResultMessage(result)) },
    ["/api/admin/gradstudents/get"],
  );

  const onUpload = async (data: RoleEmailCsvUploadFormFields) => {
    uploadMutation.mutate(data);
  };

  const createButton = () => {
    return (
      <Link
        className="btn btn-primary"
        to="/admin/gradstudents/create"
        style={{ float: "right" }}
      >
        New Grad Student
      </Link>
    );
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        {createButton()}
        <h1>Grad Students</h1>
        <RoleEmailTable
          data={gradstudents ?? []}
          deleteEndpoint="/api/admin/gradstudents/delete"
          getEndpoint="/api/admin/gradstudents/get"
          testIdPrefix="GradStudentsIndexPage"
        />
        <hr />
        <h2>Bulk Upload</h2>
        <RoleEmailCsvUploadForm
          submitAction={onUpload}
          label="Upload Grad Student Emails (CSV)"
          testIdPrefix="GradStudentCSVUploadForm"
        />
      </div>
    </BasicLayout>
  );
}
