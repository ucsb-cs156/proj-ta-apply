import { useState } from "react";
import { toast } from "react-toastify";
import type { Application } from "main/components/Applications/ApplicationTable";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import CancelApplicationModals from "main/components/Student/CancelApplicationModals";
import PastRecruitmentsTable from "main/components/Student/PastRecruitmentsTable";
import StudentRecruitmentCards from "main/components/Student/StudentRecruitmentCards";
import UpcomingRecruitmentsTable from "main/components/Student/UpcomingRecruitmentsTable";
import { useBackendMutation } from "main/utils/useBackend";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { classifyRecruitments } from "main/utils/studentRecruitments";

type StudentDashboardProps = {
  /** Every recruitment, past or present. */
  recruitments: Recruitment[];
  /** The student's own applications. */
  applications: Application[];
  testIdPrefix?: string;
};

type PendingCancel = { application: Application; recruitment: Recruitment };

/**
 * The Student section of the home page (issue #107): upcoming recruitments, the current and
 * recent ones as cards with the actions that fit, and the past ones the student applied to.
 */
export default function StudentDashboard({
  recruitments,
  applications,
  testIdPrefix = "StudentDashboard",
}: StudentDashboardProps): React.JSX.Element {
  const { upcoming, current, past } = classifyRecruitments(
    recruitments,
    applications,
  );
  const applicationList = Array.isArray(applications) ? applications : [];

  const [pendingCancel, setPendingCancel] = useState<PendingCancel | null>(
    null,
  );

  const cancelMutation = useBackendMutation<
    { id: number; reason: string },
    Application
  >(
    ({ id, reason }) => ({
      url: "/api/applications/cancel",
      method: "PUT",
      params: { id, reason },
    }),
    {
      onSuccess: () => {
        setPendingCancel(null);
        toast("Your application has been cancelled.");
      },
    },
    ["/api/applications/mine", "/api/applications"],
  );

  const id = (suffix: string) => `${testIdPrefix}-${suffix}`;

  return (
    <div data-testid={testIdPrefix}>
      {upcoming.length > 0 && (
        <>
          <h3 className="h5 mt-3">Upcoming Recruitments</h3>
          <UpcomingRecruitmentsTable
            recruitments={upcoming}
            testIdPrefix={id("upcoming")}
          />
        </>
      )}

      <h3 className="h5 mt-3">Current and Recent Recruitments</h3>
      {current.length === 0 ? (
        <p data-testid={id("none-open")}>
          Applications are not currently being accepted.
        </p>
      ) : (
        <StudentRecruitmentCards
          recruitments={current}
          applications={applicationList}
          onCancelRequested={(application, recruitment) =>
            setPendingCancel({ application, recruitment })
          }
          testIdPrefix={id("current")}
        />
      )}

      {past.length > 0 && (
        <>
          <h3 className="h5 mt-3">Past Recruitments</h3>
          <PastRecruitmentsTable
            recruitments={past}
            applications={applicationList}
            testIdPrefix={id("past")}
          />
        </>
      )}

      {/* Keyed by application, so each request starts at step one with a blank reason. */}
      {pendingCancel && (
        <CancelApplicationModals
          key={pendingCancel.application.id}
          show
          recruitmentName={`${pendingCancel.recruitment.type} positions, ${yyyyqToQyy(pendingCancel.recruitment.quarter)}`}
          onConfirm={(reason) =>
            cancelMutation.mutate({ id: pendingCancel.application.id, reason })
          }
          onClose={() => setPendingCancel(null)}
          testIdPrefix={id("cancel")}
        />
      )}
    </div>
  );
}
