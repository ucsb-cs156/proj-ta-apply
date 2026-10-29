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
    },
    {
      header: "First Name",
      accessorKey: "givenName",
    },
    {
      header: "Last Name",
      accessorKey: "familyName",
    },
    {
      header: "Delete",
      accessorKey: "isInAdminEmails",
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

  // The table takes its natural width (issue #84): on a wide screen the email column no
  // longer stretches to fill the page, and the extra room is left on the right.
  return (
    <OurTable
      data={Array.isArray(data) ? data : []}
      columns={columns}
      testid={testIdPrefix}
      fitContent
    />
  );
}
