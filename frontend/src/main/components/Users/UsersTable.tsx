import OurTable from "main/components/Common/OurTable";
import type { Cell } from "@tanstack/react-table";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import { formatTime } from "main/utils/dateUtils";

export type User = {
  id: number;
  givenName: string;
  familyName: string;
  email: string;
  admin: boolean;
  instructor: boolean;
  /** ISO instant of their last request; null for a row from before this was recorded. */
  lastOnline?: string | null;
};

const columns: LegacyColumn[] = [
  {
    Header: "id",
    accessor: "id", // accessor is the "key" in the data
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
    header: "Email",
    accessorKey: "email",
  },
  {
    header: "Last Online",
    accessorKey: "lastOnline",
    // Sorted on the ISO value; shown in the admin's own time zone, blank when never recorded.
    cell: ({ cell }: { cell: Cell<User, unknown> }) =>
      formatTime(cell.getValue() as string | null),
  },
  {
    header: "Admin",
    id: "admin",
    accessorKey: "admin",
    cell: ({ cell }: { cell: Cell<User, unknown> }) => {
      return String(cell.getValue());
    }, // convert boolean to string for display
  },
  {
    header: "Instructor",
    id: "instructor",
    accessorKey: "instructor",
    cell: ({ cell }: { cell: Cell<User, unknown> }) => {
      return String(cell.getValue());
    }, // convert boolean to string for display
  },
];

type UsersTableProps = {
  users: User[];
};

export default function UsersTable({
  users,
}: UsersTableProps): React.JSX.Element {
  return <OurTable data={users} columns={columns} testid={"UsersTable"} />;
}
