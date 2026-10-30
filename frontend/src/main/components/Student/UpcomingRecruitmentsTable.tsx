import type { Cell } from "@tanstack/react-table";
import OurTable from "main/components/Common/OurTable";
import type { LegacyColumn } from "main/components/Common/OurTableUtils";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { daysUntil, opensInText } from "main/utils/studentRecruitments";

type UpcomingRecruitmentsTableProps = {
  recruitments: Recruitment[];
  testIdPrefix?: string;
};

/** The recruitments that have not opened yet, with how long until each is expected to (issue #107). */
export default function UpcomingRecruitmentsTable({
  recruitments,
  testIdPrefix = "UpcomingRecruitmentsTable",
}: UpcomingRecruitmentsTableProps): React.JSX.Element {
  const shrink = { style: { width: "1%", whiteSpace: "nowrap" as const } };

  const columns: LegacyColumn[] = [
    {
      header: "Quarter",
      accessorKey: "quarter",
      meta: shrink,
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) =>
        yyyyqToQyy(cell.row.original.quarter),
    },
    { header: "Type", accessorKey: "type", meta: shrink },
    {
      header: "Tentative Opening Date",
      accessorKey: "tentativeOpeningDate",
      meta: shrink,
    },
    {
      header: "Opens in",
      id: "opensIn",
      accessorFn: (recruitment: Recruitment) =>
        recruitment.tentativeOpeningDate
          ? daysUntil(recruitment.tentativeOpeningDate)
          : null,
      meta: { style: { width: "100%" } },
      cell: ({ cell }: { cell: Cell<Recruitment, unknown> }) => {
        const date = cell.row.original.tentativeOpeningDate;
        return date ? opensInText(daysUntil(date)) : "";
      },
    },
  ];

  return (
    <OurTable
      data={Array.isArray(recruitments) ? recruitments : []}
      columns={columns}
      testid={testIdPrefix}
    />
  );
}
