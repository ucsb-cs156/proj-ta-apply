import { useState } from "react";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RecruitmentTable, {
  type Recruitment,
} from "main/components/Recruitments/RecruitmentTable";
import RecruitmentDeleteModal from "main/components/Recruitments/RecruitmentDeleteModal";
import RecruitmentForm, {
  type RecruitmentFormFields,
} from "main/components/Recruitments/RecruitmentForm";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { useSystemInfo } from "main/utils/systemInfo";
import { quarterRange } from "main/utils/quarterUtilities";
import { toast } from "react-toastify";

export default function RecruitmentsIndexPage(): React.JSX.Element {
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

  const [pendingDelete, setPendingDelete] = useState<Recruitment | null>(null);

  const createMutation = useBackendMutation<RecruitmentFormFields, Recruitment>(
    (data) => ({
      url: "/api/admin/recruitments/post",
      method: "POST",
      params: data,
    }),
    {
      onSuccess: () =>
        toast(
          "Recruitment created. Its course list is being filled; watch the Admin > Jobs page.",
        ),
    },
    ["/api/admin/recruitments/all"],
  );

  const deleteMutation = useBackendMutation<Recruitment, unknown>(
    (recruitment) => ({
      url: "/api/admin/recruitments/delete",
      method: "DELETE",
      params: { id: recruitment.id },
    }),
    { onSuccess: () => setPendingDelete(null) },
    ["/api/admin/recruitments/all"],
  );

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Recruitments</h1>
        <p>
          One hiring round per quarter and type. Creating one fills its course
          list from the courses flagged for that type in Admin &gt; Courses.
          Applications start closed and are opened and closed by hand.
        </p>

        <RecruitmentForm
          quarters={quarters}
          submitAction={(data) => createMutation.mutate(data)}
        />

        <hr />

        <RecruitmentTable
          recruitments={recruitments ?? []}
          onDeleteRequested={setPendingDelete}
          testIdPrefix="RecruitmentsIndexPage"
        />

        <RecruitmentDeleteModal
          recruitment={pendingDelete}
          onConfirm={() => deleteMutation.mutate(pendingDelete as Recruitment)}
          onCancel={() => setPendingDelete(null)}
        />
      </div>
    </BasicLayout>
  );
}
