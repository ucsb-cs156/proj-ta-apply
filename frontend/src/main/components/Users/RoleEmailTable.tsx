import OurTable from "main/components/Common/OurTable";

import { useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import { Button } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";

export type RoleEmail = {
  email: string;
  isInAdminEmails?: boolean;
  /** From the users table, so known only once this person has logged in. */
  givenName?: string | null;
  familyName?: string | null;
};

/** Shown above the Admins and Instructors tables, where the name columns are often blank. */
export const NAMES_NOTE =
  "First and Last name are populated when the user logs in for the first time.";

type RoleEmailTableProps = {
  data: RoleEmail[];
  deleteEndpoint?: string;
  getEndpoint?: string;
  testIdPrefix?: string;
  customDeleteCallback?: ((cell: Cell<RoleEmail, unknown>) => void) | null;
};

export default function RoleEmailTable({
  data,
  deleteEndpoint = "/api/admin/delete",
  getEndpoint = "/api/admin/all",
  testIdPrefix = "RoleEmailTable",
  customDeleteCallback = null, // optional deleteCallback, used in AdminsIndexPage
}: RoleEmailTableProps): React.JSX.Element {
  const cellToAxiosParamsDelete = (
    cell: Cell<RoleEmail, unknown>,
    deleteEndpoint: string,
  ): AxiosRequestConfig => {
    return {
      url: deleteEndpoint,
      method: "DELETE",
      params: {
        email: cell.row.original.email,
      },
    };
  };

  const onDeleteSuccess = (message: string) => {
    toast(message);
  };

  const deleteMutation = useBackendMutation<Cell<RoleEmail, unknown>, string>(
    (cell) => cellToAxiosParamsDelete(cell, deleteEndpoint),
    { onSuccess: onDeleteSuccess },
    [getEndpoint],
  );
  const defaultDeleteCallback = async (cell: Cell<RoleEmail, unknown>) => {
    deleteMutation.mutate(cell);
  };

  const deleteCallback = customDeleteCallback || defaultDeleteCallback;

  const columns = [
    {
      header: "Email",
      accessorKey: "email", // accessor is the "key" in the data
      // Takes the slack from Bootstrap's full-width table, so Delete shrinks to its button
      // instead of the two columns splitting the width evenly.
      meta: { style: { width: "100%" } },
    },
    {
      header: "First Name",
      accessorKey: "givenName",
      meta: { style: { width: "1%", whiteSpace: "nowrap" as const } },
    },
    {
      header: "Last Name",
      accessorKey: "familyName",
      meta: { style: { width: "1%", whiteSpace: "nowrap" as const } },
    },
    {
      header: "Delete",
      accessorKey: "isInAdminEmails",
      meta: { style: { width: "1%", whiteSpace: "nowrap" as const } },
      cell: ({ cell }: { cell: Cell<RoleEmail, unknown> }) => {
        if (!cell.row.original.isInAdminEmails) {
          return (
            <Button
              className="btn btn-danger"
              onClick={() => deleteCallback(cell)}
              data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-col-delete-button`}
            >
              Delete
            </Button>
          );
        }
        return (
          <span
            data-testid={`${testIdPrefix}-cell-row-${cell.row.index}-cannot-delete`}
          >
            In <code>ADMIN_EMAILS</code>
          </span>
        );
      },
    },
  ];

  return (
    <OurTable
      data={Array.isArray(data) ? data : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
