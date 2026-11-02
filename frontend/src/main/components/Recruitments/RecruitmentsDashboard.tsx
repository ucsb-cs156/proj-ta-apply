import { useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import RecruitmentDeleteModal from "main/components/Recruitments/RecruitmentDeleteModal";
import RecruitmentForm, {
  type RecruitmentFormFields,
} from "main/components/Recruitments/RecruitmentForm";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { HOME_PAGE_QUERY_KEYS } from "main/utils/recruitmentSteps";
import AutoCreateRecruitmentsModal from "main/components/Recruitments/AutoCreateRecruitmentsModal";
import { useDeveloperMode } from "main/utils/developerMode";
import {
  nextNonSummerQuarter,
  selectableQuarters,
} from "main/utils/autoCreateRecruitments";
import { yyyyqToQyy } from "main/utils/quarterUtilities";
import { useDeveloperModeFooterControls } from "main/utils/developerModeFooter";
import { toast } from "react-toastify";

type RecruitmentsDashboardProps = {
  testIdPrefix?: string;
  /** Injected so tests and stories can fix the date; defaults to now. */
  today?: Date;
};

/**
 * An admin's recruitments, in full: the explanation, the Create New Recruitment button and its
 * modal, a card per recruitment with its buttons, and the delete confirmation. This was the
 * Admin > Recruitments page until issue #141 put it on the admin's home page, where it was always
 * meant to be; it is a component so the home page can carry it whole.
 */
export default function RecruitmentsDashboard({
  testIdPrefix = "RecruitmentsDashboard",
  today = new Date(),
}: RecruitmentsDashboardProps): React.JSX.Element {
  const { data: developerMode } = useDeveloperMode();
  // Stryker disable next-line all : the query's initial data is the "off" status, never undefined
  const developerModeOn = developerMode?.on === true;

  // The Create New Recruitment form offers a full academic year back through the next quarter (two
  // in Spring), the quarters that have courses to work with, and proposes the next one that is
  // not Summer: the quarter after this one, which is the normal case.
  const quarters = selectableQuarters(today).map((yyyyq) => ({
    yyyyq,
    qyy: yyyyqToQyy(yyyyq),
  }));
  const defaultQuarter = nextNonSummerQuarter(today);

  const { data: recruitments } = useBackend<Recruitment[]>(
    ["/api/admin/recruitments/all"],
    { method: "GET", url: "/api/admin/recruitments/all" },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  // How many applications each recruitment has on file, for the cards and the delete warning.
  const { data: applicationCounts } = useBackend<Record<string, number>>(
    ["/api/admin/recruitments/applicationCounts"],
    { method: "GET", url: "/api/admin/recruitments/applicationCounts" },
    // Stryker disable next-line all : don't test default value of empty map
    {},
  );
  const counts = applicationCounts ?? {};

  const [creating, setCreating] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Recruitment | null>(null);

  // Issues #218 and #252: Auto Create Recruitments is a developer-mode control, so it lives in
  // the footer's developer slot (red, beside the badge), not in this page's own buttons.
  const autoCreateButton = useMemo(
    () =>
      developerModeOn ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setAutoCreating(true)}
          data-testid={`${testIdPrefix}-auto-create-button`}
        >
          Auto Create Recruitments
        </Button>
      ) : null,
    [developerModeOn, testIdPrefix],
  );
  useDeveloperModeFooterControls(autoCreateButton);

  const createMutation = useBackendMutation<RecruitmentFormFields, Recruitment>(
    (data) => ({
      url: "/api/admin/recruitments/post",
      method: "POST",
      params: data,
    }),
    {
      onSuccess: () => {
        setCreating(false);
        toast(
          "Recruitment created. Its course list is being filled; watch the Developer > Jobs page.",
        );
      },
    },
    [
      "/api/admin/recruitments/all",
      "/api/admin/recruitments/applicationCounts",
      ...HOME_PAGE_QUERY_KEYS,
    ],
  );

  const deleteMutation = useBackendMutation<Recruitment, unknown>(
    (recruitment) => ({
      url: "/api/admin/recruitments/delete",
      method: "DELETE",
      params: { id: recruitment.id },
    }),
    { onSuccess: () => setPendingDelete(null) },
    [
      "/api/admin/recruitments/all",
      "/api/admin/recruitments/applicationCounts",
      ...HOME_PAGE_QUERY_KEYS,
    ],
  );

  return (
    <div data-testid={`${testIdPrefix}-dashboard`}>
      <h3 className="h4" data-testid={`${testIdPrefix}-heading`}>
        Recruitments
      </h3>
      <div data-testid={`${testIdPrefix}-intro`}>
        <p>
          Applications for new recruitments do not automatically open and close
          on the tentative dates listed; the admin must manually open and close
          the recruitments by clicking the Open or Close button.
        </p>
        <p>
          Only one recruitment of each type (TA or ULA) may be created for a
          given quarter.
        </p>
        <p>
          Recruitments are automatically populated with the undergraduate
          courses offered in the specified quarter; the list of courses can then
          be manually adjusted using the Courses button.
        </p>
      </div>

      <Button
        variant="success"
        className="mb-3"
        onClick={() => setCreating(true)}
        data-testid={`${testIdPrefix}-create-button`}
      >
        Create New Recruitment
      </Button>

      {autoCreating && (
        <AutoCreateRecruitmentsModal
          // Stryker disable next-line all : the query's initial data is an empty list, never undefined
          recruitments={recruitments ?? []}
          onHide={() => setAutoCreating(false)}
          testIdPrefix={`${testIdPrefix}-auto-create`}
        />
      )}

      {/* Mounted only while open, so each opening starts with a blank form. */}
      {creating && (
        <Modal
          show
          onHide={() => setCreating(false)}
          centered={true}
          data-testid={`${testIdPrefix}-create-modal`}
        >
          <Modal.Header closeButton>Create New Recruitment</Modal.Header>
          <RecruitmentForm
            quarters={quarters}
            defaultQuarter={defaultQuarter}
            submitAction={(data) => createMutation.mutate(data)}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}

      <RecruitmentCards
        recruitments={recruitments ?? []}
        applicationCounts={counts}
        onDeleteRequested={setPendingDelete}
        testIdPrefix={testIdPrefix}
      />

      <RecruitmentDeleteModal
        recruitment={pendingDelete}
        applicationCount={
          pendingDelete === null ? 0 : (counts[pendingDelete.id] ?? 0)
        }
        onConfirm={() => deleteMutation.mutate(pendingDelete as Recruitment)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
