import OurTable from "main/components/Common/OurTable";

/** What GET …/cancelled returns (issue #199): just enough to say what became of an applicant. */
export type CancelledApplication = {
  applicationId: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  cancellationReason: string | null;
};

type CancelledApplicationsTableProps = {
  cancelled: CancelledApplication[];
  /** Who is reading: changes the sentence that says why the table is there. */
  audience: "faculty" | "admin";
  testIdPrefix?: string;
};

/**
 * The applications to the recruitment that the applicant cancelled (issue #199): name, email and
 * their reason. It sits at the bottom of the ranking page and of the admin Assignments page so that
 * someone wondering why an applicant is missing can answer the question themselves.
 */
export default function CancelledApplicationsTable({
  cancelled,
  audience,
  testIdPrefix = "CancelledApplicationsTable",
}: CancelledApplicationsTableProps): React.JSX.Element {
  const columns = [
    {
      header: "Name",
      id: "name",
      accessorFn: (row: CancelledApplication) =>
        `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    },
    { header: "Email", accessorKey: "email" },
    {
      header: "Reason for cancellation",
      id: "cancellationReason",
      accessorFn: (row: CancelledApplication) => row.cancellationReason ?? "",
    },
  ];
  return (
    <section
      aria-label="Cancelled applications"
      className="mt-4"
      data-testid={testIdPrefix}
    >
      <h2 className="h4">Cancelled applications</h2>
      <p className="small text-muted" data-testid={`${testIdPrefix}-why`}>
        {audience === "faculty"
          ? "Applicants who withdrew their application are not among the candidates above. This list is here so that, if you expected to see someone, you can tell what happened to them."
          : "Applicants who withdrew their application are not among the rows above and cannot be assigned. This list is here so that, if you expected to see someone, you can tell what happened to them."}
      </p>
      {cancelled.length === 0 ? (
        <p data-testid={`${testIdPrefix}-empty`}>
          No applicant has cancelled their application.
        </p>
      ) : (
        <OurTable
          data={cancelled}
          columns={columns}
          testid={`${testIdPrefix}-table`}
          fitContent
        />
      )}
    </section>
  );
}
