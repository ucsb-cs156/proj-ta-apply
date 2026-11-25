import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailForm, {
  type RoleEmailFormFields,
} from "main/components/Users/RoleEmailForm";
import { Navigate } from "react-router";
import { useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";
import {
  HIRING_STAFF_ALL_URL,
  HIRING_STAFF_PATH,
  HIRING_STAFF_POST_URL,
  hiringStaffAddedToast,
} from "main/utils/hiringStaff";

type HiringStaffCreatePageProps = {
  storybook?: boolean;
};

/** Admin → Hiring Staff → New Hiring Staff (issue #504): one email, then back to the list. */
export default function HiringStaffCreatePage({
  storybook = false,
}: HiringStaffCreatePageProps): React.JSX.Element {
  const objectToAxiosParams = (
    fields: RoleEmailFormFields,
  ): AxiosRequestConfig => ({
    url: HIRING_STAFF_POST_URL,
    method: "POST",
    params: { email: fields.email },
  });

  const onSuccess = (fields: RoleEmailFormFields) => {
    toast(hiringStaffAddedToast(fields.email));
  };

  const mutation = useBackendMutation(objectToAxiosParams, { onSuccess }, [
    HIRING_STAFF_ALL_URL,
  ]);

  const onSubmit = async (data: RoleEmailFormFields) => {
    mutation.mutate(data);
  };

  if (mutation.isSuccess && !storybook) {
    return <Navigate to={HIRING_STAFF_PATH} />;
  }

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Add New Hiring Staff</h1>
        <RoleEmailForm submitAction={onSubmit} />
      </div>
    </BasicLayout>
  );
}
