import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import HiringStaffRecruitmentCard from "main/components/HiringStaff/HiringStaffRecruitmentCard";
import { NO_RELEASED_SOFT_OFFERS_TEXT } from "main/utils/hiringStaff";

type HiringStaffDashboardProps = {
  /** The ULA recruitments with soft offers released, as the backend orders them. */
  recruitments: Recruitment[];
  testIdPrefix?: string;
};

/**
 * The Hiring Staff section of the home page (issue #505): a card per ULA recruitment whose soft
 * offers have been released, each with its Soft Offer Results button, or a sentence when there is
 * none. The list is fetched by the page, which knows who is looking.
 */
export default function HiringStaffDashboard({
  recruitments,
  // Stryker disable next-line StringLiteral : every caller passes its own prefix
  testIdPrefix = "HiringStaffDashboard",
}: HiringStaffDashboardProps): React.JSX.Element {
  const list = Array.isArray(recruitments) ? recruitments : [];
  return (
    <div data-testid={testIdPrefix}>
      <h3 className="h5 mt-3" data-testid={`${testIdPrefix}-heading`}>
        ULA Recruitments with Soft Offers Released
      </h3>
      {list.length === 0 ? (
        <p data-testid={`${testIdPrefix}-none`}>
          {NO_RELEASED_SOFT_OFFERS_TEXT}
        </p>
      ) : (
        list.map((recruitment) => (
          <HiringStaffRecruitmentCard
            key={recruitment.id}
            recruitment={recruitment}
            testIdPrefix={`${testIdPrefix}-card-${recruitment.id}`}
          />
        ))
      )}
    </div>
  );
}
