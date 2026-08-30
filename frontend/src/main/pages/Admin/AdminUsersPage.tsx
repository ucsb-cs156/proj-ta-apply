import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import UsersTable, { type User } from "main/components/Users/UsersTable";
import { useBackend } from "main/utils/useBackend";

type UsersPage = {
  content: User[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

const pageSizeOptions = [10, 25, 50, 100, 500];

const emptyUsersPage: UsersPage = {
  content: [],
  number: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
};

export default function AdminUsersPage(): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const { data: usersPage } = useBackend<UsersPage>(
    ["/api/admin/users", page, pageSize],
    {
      method: "GET",
      url: "/api/admin/users",
      params: { page, size: pageSize },
    },
    emptyUsersPage,
  );

  const totalPages = Math.max(usersPage?.totalPages ?? 0, 1);
  const currentPage = (usersPage?.number ?? 0) + 1;

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Users</h1>
        <div className="d-flex align-items-end justify-content-between mb-3 gap-3 flex-wrap">
          <Form.Group controlId="admin-users-page-size">
            <Form.Label>Page size</Form.Label>
            <Form.Select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {pageSizeOptions.map((sizeOption) => (
                <option key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setPage((previousPage) => Math.max(previousPage - 1, 0))
              }
              disabled={page === 0}
            >
              Previous
            </Button>
            <span data-testid="AdminUsersPage-page-indicator">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((previousPage) => previousPage + 1)}
              disabled={page + 1 >= (usersPage?.totalPages ?? 0)}
            >
              Next
            </Button>
          </div>
        </div>
        <UsersTable users={usersPage?.content ?? []} />
      </div>
    </BasicLayout>
  );
}
