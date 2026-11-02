import type { ApplicationOrigin } from "main/components/Applications/ApplicationTable";
import { originLabel } from "main/utils/adminApplications";

type Props = {
  origin: ApplicationOrigin;
  /** Show just "test" or "fake", for a table cell, instead of the long name. */
  short?: boolean;
  testId: string;
};

/**
 * Marks an application an admin entered (yellow) or Developer Mode generated (red), so neither is
 * mistaken for an applicant's. A real applicant's own application gets no badge (issue #219).
 */
export default function ApplicationOriginBadge({
  origin,
  short = false,
  testId,
}: Props): React.JSX.Element | null {
  if (origin === "APPLICANT") return null;
  const test = origin === "ADMIN_TEST";
  return (
    <span
      className={`badge ms-2 ${test ? "text-bg-warning" : "text-bg-danger"}`}
      data-testid={testId}
    >
      {short ? (test ? "test" : "fake") : originLabel(origin)}
    </span>
  );
}
