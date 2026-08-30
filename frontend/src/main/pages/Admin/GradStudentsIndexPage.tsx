import { useBackend, useBackendMutation } from "main/utils/useBackend";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailTable, {
  type RoleEmail,
} from "main/components/Users/RoleEmailTable";
import GradStudentCSVUploadForm, {
  type GradStudentCSVUploadFormFields,
} from "main/components/Users/GradStudentCSVUploadForm";
import { Link } from "react-router";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";

/** Shape of the response from POST /api/admin/gradstudents/upload/csv */
export type UploadResult = {
  inserted: number;
  alreadyPresent: number;
  invalid: number;
  invalidEmails: string[];
};

export default function GradStudentsIndexPage(): React.JSX.Element {
  const { data: gradstudents } = useBackend<RoleEmail[]>(
    ["/api/admin/gradstudents/get"],
    { method: "GET", url: "/api/admin/gradstudents/get" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const objectToAxiosParams = (
    data: GradStudentCSVUploadFormFields,
  ): AxiosRequestConfig => {
    const formData = new FormData();
    formData.append("file", data.upload[0]);
    return {
      url: "/api/admin/gradstudents/upload/csv",
      method: "POST",
      data: formData,
      headers: { "Content-Type": "multipart/form-data" },
    };
  };

  const onSuccess = (result: UploadResult) => {
    let message = `Upload complete: ${result.inserted} added, ${result.alreadyPresent} already present, ${result.invalid} invalid`;
    if (result.invalidEmails?.length > 0) {
      message += ` (${result.invalidEmails.join(", ")})`;
    }
    toast(message);
  };

  const uploadMutation = useBackendMutation<
    GradStudentCSVUploadFormFields,
    UploadResult
  >(objectToAxiosParams, { onSuccess }, ["/api/admin/gradstudents/get"]);

  const onUpload = async (data: GradStudentCSVUploadFormFields) => {
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
        <GradStudentCSVUploadForm submitAction={onUpload} />
      </div>
    </BasicLayout>
  );
}
