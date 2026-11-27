import { Link, useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Button } from "react-bootstrap";
import type { Cell } from "@tanstack/react-table";
import type { AxiosRequestConfig } from "axios";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import OurTable from "main/components/Common/OurTable";
import { apiErrorMessage } from "main/utils/apiError";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import {
  FUNDING_SOURCES_ALL_URL,
  FUNDING_SOURCES_CREATE_PATH,
  FUNDING_SOURCES_DELETE_URL,
  FUNDING_SOURCES_LABEL,
  FUNDING_SOURCES_NOTE,
  type FundingSource,
  fundingSourceEditPath,
  sortFundingSources,
} from "main/utils/fundingSources";

const TEST_ID = "FundingSourcesIndexPage";

/** What a button column's cells need, handed to them through the column's meta. */
type ButtonMeta = {
  label: string;
  variant: string;
  onClick: (cell: Cell<FundingSource, unknown>) => void;
};

/**
 * One row's Edit or Delete button. A module-level component, as in RoleEmailTable: a cell function
 * written inside the page would be a new component on every render.
 */
function ButtonCell({
  cell,
}: {
  cell: Cell<FundingSource, unknown>;
}): React.JSX.Element {
  const { label, variant, onClick } = cell.column.columnDef.meta as ButtonMeta;
  return (
    <Button
      variant={variant}
      onClick={() => onClick(cell)}
      data-testid={`${TEST_ID}-cell-row-${cell.row.index}-col-${cell.column.id}-button`}
    >
      {label}
    </Button>
  );
}

/**
 * Admin → Funding Sources (issue #512): the sources sorted by abbreviation, each with Edit and
 * Delete, and a Create button. Delete asks no confirmation, like the Admins and Hiring Staff pages.
 */
export default function FundingSourcesIndexPage(): React.JSX.Element {
  const navigate = useNavigate();

  const { data: fundingSources } = useBackend<FundingSource[]>(
    [FUNDING_SOURCES_ALL_URL],
    { method: "GET", url: FUNDING_SOURCES_ALL_URL },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const deleteMutation = useBackendMutation<
    Cell<FundingSource, unknown>,
    { message: string }
  >(
    (cell): AxiosRequestConfig => ({
      url: FUNDING_SOURCES_DELETE_URL,
      method: "DELETE",
      params: { abbreviation: cell.row.original.abbreviation },
    }),
    {
      onSuccess: (data) => toast(data.message),
      // Issue #512, part 2: a source that hiring records carry is refused with the count; the
      // backend's message says so, where the default toast would only name the status code.
      onError: (error) => toast(apiErrorMessage(error)),
    },
    [FUNDING_SOURCES_ALL_URL],
  );

  const columns = [
    { header: "Abbreviation", accessorKey: "abbreviation" },
    { header: "Explanation", accessorKey: "explanation" },
    {
      header: "Edit",
      id: "edit",
      meta: {
        label: "Edit",
        variant: "primary",
        onClick: (cell) =>
          navigate(fundingSourceEditPath(cell.row.original.abbreviation)),
      } satisfies ButtonMeta,
      cell: ButtonCell,
    },
    {
      header: "Delete",
      id: "delete",
      meta: {
        label: "Delete",
        variant: "danger",
        onClick: (cell) => deleteMutation.mutate(cell),
      } satisfies ButtonMeta,
      cell: ButtonCell,
    },
  ];

  return (
    <BasicLayout>
      <div className="pt-2">
        <Link
          className="btn btn-primary"
          to={FUNDING_SOURCES_CREATE_PATH}
          style={{ float: "right" }}
          data-testid={`${TEST_ID}-create`}
        >
          Create Funding Source
        </Link>
        <h1>{FUNDING_SOURCES_LABEL}</h1>
        <p data-testid={`${TEST_ID}-note`}>{FUNDING_SOURCES_NOTE}</p>
        <OurTable
          data={sortFundingSources(fundingSources)}
          columns={columns}
          testid={TEST_ID}
          fitContent
        />
      </div>
    </BasicLayout>
  );
}
