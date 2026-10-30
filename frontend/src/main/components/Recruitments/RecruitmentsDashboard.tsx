import { useState } from "react";
import { Button } from "react-bootstrap";
import Modal from "react-bootstrap/Modal";
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";
import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import RecruitmentDeleteModal from "main/components/Recruitments/RecruitmentDeleteModal";
import RecruitmentForm, {
  type RecruitmentFormFields,
} from "main/components/Recruitments/RecruitmentForm";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useSystemInfo } from "main/utils/systemInfo";
import { quarterRange } from "main/utils/quarterUtilities";
import { toast } from "react-toastify";

type RecruitmentsDashboardProps = {
  testIdPrefix?: string;
};

/**
 * An admin's recruitments, in full: the explanation, the Create New Recruitment button and its
 * modal, a card per recruitment with its buttons, and the delete confirmation. This was the
 * Admin > Recruitments page until issue #141 put it on the admin's home page, where it was always
 * meant to be; it is a component so the home page can carry it whole.
 */
export default function RecruitmentsDashboard({
  testIdPrefix = "RecruitmentsDashboard",
}: RecruitmentsDashboardProps): React.JSX.Element {
  const { data: systemInfo } = useSystemInfo();

  // Stryker disable OptionalChaining
  const startQtr = systemInfo?.startQtrYYYYQ || "20211";
  const endQtr = systemInfo?.endQtrYYYYQ || "20254";
  // Stryker restore OptionalChaining

  const quarters = quarterRange(startQtr, endQtr);

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
  const [pendingDelete, setPendingDelete] = useState<Recruitment | null>(null);

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
