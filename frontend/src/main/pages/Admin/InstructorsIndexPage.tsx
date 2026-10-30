import { useBackend, useBackendMutation } from "main/utils/useBackend";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailTable, {
  NAMES_NOTE,
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

/** Shown under the names note on the Instructors page (issue #120). */
export const CATALOG_NAME_NOTE =
  "Catalog Name is how the course schedule spells the instructor; choose it so their courses can be matched to them. The list is filled in by the Populate job on the Courses page.";

export default function InstructorsIndexPage(): React.JSX.Element {
  const { data: instructors } = useBackend<RoleEmail[]>(
    ["/api/admin/instructors/get"],
    { method: "GET", url: "/api/admin/instructors/get" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const { data: catalogNames } = useBackend<string[]>(
    ["/api/admin/instructors/catalogNames"],
    { method: "GET", url: "/api/admin/instructors/catalogNames" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const catalogNameMutation = useBackendMutation<
    { email: string; catalogName: string | null },
    RoleEmail
  >(
    ({ email, catalogName }) => ({
      url: "/api/admin/instructors/catalogName",
      method: "PUT",
      params: { email, catalogName: catalogName ?? "" },
    }),
    { onSuccess: () => toast("Catalog name saved.") },
    ["/api/admin/instructors/get"],
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
        <p data-testid="InstructorsIndexPage-names-note">{NAMES_NOTE}</p>
        <p data-testid="InstructorsIndexPage-catalog-note">
          {CATALOG_NAME_NOTE}
        </p>
        <RoleEmailTable
          data={instructors ?? []}
          deleteEndpoint="/api/admin/instructors/delete"
          getEndpoint="/api/admin/instructors/get"
          catalogNames={catalogNames ?? []}
          onCatalogNameChange={(email, catalogName) =>
            catalogNameMutation.mutate({ email, catalogName })
          }
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
