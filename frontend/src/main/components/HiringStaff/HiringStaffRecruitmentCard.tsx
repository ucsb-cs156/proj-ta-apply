import { Card } from "react-bootstrap";
import { Link } from "react-router";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import { formatPacificDateTime } from "main/utils/pacificTime";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import {
  SOFT_OFFER_RESULTS_LABEL,
  softOfferResultsPath,
} from "main/utils/softOffers";

type HiringStaffRecruitmentCardProps = {
  recruitment: Recruitment;
  testIdPrefix?: string;
};

/**
 * One card of the Hiring Staff section (issue #505): the recruitment's name, when its soft offers
 * were released and their deadline, and the one button the role has, Soft Offer Results.
 */
export default function HiringStaffRecruitmentCard({
  recruitment,
  // Stryker disable next-line StringLiteral : every caller passes its own prefix
  testIdPrefix = "HiringStaffRecruitmentCard",
}: HiringStaffRecruitmentCardProps): React.JSX.Element {
  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;
  return (
    <Card className="mb-3 w-100" data-testid={id("card")}>
      <Card.Header className="d-flex align-items-center gap-3 px-3 py-2">
        <strong className="fs-5" data-testid={id("name")}>
          {yyyyqToQyy(recruitment.quarter)} {recruitment.type}
        </strong>
      </Card.Header>
      <Card.Body>
        <p className="mb-0" data-testid={id("release")}>
          Soft offers released{" "}
          {formatPacificDateTime(recruitment.softOffersReleasedAt)}. Deadline:{" "}
          {formatPacificDateTime(recruitment.softOfferDeadline)}.
        </p>
      </Card.Body>
      <Card.Footer className="d-flex flex-wrap gap-2">
        <Link
          className="btn btn-primary"
          to={softOfferResultsPath(recruitment.id)}
          data-testid={id("soft-offer-results-button")}
        >
          {SOFT_OFFER_RESULTS_LABEL}
        </Link>
      </Card.Footer>
    </Card>
  );
}
