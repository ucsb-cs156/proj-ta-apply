import { Link } from "react-router";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import ApplicationTable, {
  type Application,
} from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

type ApplicantDashboardProps = {
  /** "TA" for a grad student, "ULA" for an undergrad. */
  type: "TA" | "ULA";
  open: Recruitment[];
  upcoming: Recruitment[];
  recentlyClosed: Recruitment[];
  applications: Application[];
  applicable: Recruitment[];
  testIdPrefix?: string;
};

const asList = <T,>(value: T[] | undefined | null): T[] =>
  Array.isArray(value) ? value : [];

/**
 * What an applicant sees on the home page. Each of the four states stands on its own: there may
 * be nothing open, something open, something closed to report on, something upcoming, or several
 * of those at once.
 */
export default function ApplicantDashboard({
  type,
  open,
  upcoming,
  recentlyClosed,
  applications,
  applicable,
  testIdPrefix = "ApplicantDashboard",
}: ApplicantDashboardProps): React.JSX.Element {
  const openList = asList(open);
  const upcomingList = asList(upcoming);
  const closedList = asList(recentlyClosed);
  const applicationList = asList(applications);

  const positions = type === "TA" ? "TA" : "ULA";
  const applied = new Set(applicationList.map((a) => a.recruitmentId));

  return (
    <div data-testid={testIdPrefix}>
      {openList.length === 0 && (
        <p data-testid={`${testIdPrefix}-none-open`}>
          Applications for {positions} positions are not currently being
          accepted.
        </p>
      )}

      {openList.map((recruitment) => (
        <p
          key={recruitment.id}
          data-testid={`${testIdPrefix}-open-${recruitment.id}`}
        >
          Applications for {positions} positions in{" "}
          {yyyyqToQyy(recruitment.quarter)} are open.{" "}
          {applied.has(recruitment.id) ? (
            <span data-testid={`${testIdPrefix}-applied-${recruitment.id}`}>
              You have already applied; your application is listed below.
            </span>
          ) : (
            <Link
              to={`/apply/${recruitment.id}`}
              data-testid={`${testIdPrefix}-apply-${recruitment.id}`}
            >
              Apply now
            </Link>
          )}
          {recruitment.primaryConsiderationDate && (
            <span data-testid={`${testIdPrefix}-deadline-${recruitment.id}`}>
              {" "}
              Applications received by {
                recruitment.primaryConsiderationDate
              }{" "}
              get primary consideration.
            </span>
          )}
        </p>
      ))}

      {upcomingList.map((recruitment) => (
        <p
          key={recruitment.id}
          data-testid={`${testIdPrefix}-upcoming-${recruitment.id}`}
        >
          Applications for {positions} positions in{" "}
          {yyyyqToQyy(recruitment.quarter)} are expected to open on{" "}
          {recruitment.tentativeOpeningDate}.
        </p>
      ))}

      {closedList.map((recruitment) => (
        <p
          key={recruitment.id}
          data-testid={`${testIdPrefix}-closed-${recruitment.id}`}
        >
          The most recent round of {positions} applications, for{" "}
          {yyyyqToQyy(recruitment.quarter)}, opened on{" "}
          {recruitment.actualOpeningDate} and closed on{" "}
          {recruitment.actualClosingDate}.
        </p>
      ))}

      <h2 className="h4 mt-4">Your Applications</h2>
      {applicationList.length === 0 ? (
        <p data-testid={`${testIdPrefix}-no-applications`}>
          You have not applied for any {positions} positions yet.
        </p>
      ) : (
        <ApplicationTable
          applications={applicationList}
          recruitments={asList(applicable)}
          testIdPrefix={`${testIdPrefix}-applications`}
        />
      )}
    </div>
  );
}
