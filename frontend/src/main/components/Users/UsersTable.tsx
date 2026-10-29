import OurTable from "main/components/Common/OurTable";
import type { Cell } from "@tanstack/react-table";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";

export type User = {
  id: number;
  givenName: string;
  familyName: string;
  email: string;
  admin: boolean;
  instructor: boolean;
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
