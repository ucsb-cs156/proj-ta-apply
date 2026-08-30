import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailForm, {
  type RoleEmailFormFields,
} from "main/components/Users/RoleEmailForm";
import { Navigate } from "react-router";
import { useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";

type AdminsCreatePageProps = {
  storybook?: boolean;
};

export default function AdminsCreatePage({
  storybook = false,
}: AdminsCreatePageProps): React.JSX.Element {
  const objectToAxiosParams = (
    admin: RoleEmailFormFields,
  ): AxiosRequestConfig => ({
    url: "/api/admin/post",
    method: "POST",
    params: {
      email: admin.email,
    },
  });

  const onSuccess = (admin: RoleEmailFormFields) => {
    toast(`New admin added - email: ${admin.email}`);
  };

  const mutation = useBackendMutation(
    objectToAxiosParams,
    { onSuccess },
    ["/api/admin/all"], // mutation makes this key stale so that pages relying on it reload
  );

  const { isSuccess } = mutation;

  const onSubmit = async (data: RoleEmailFormFields) => {
    mutation.mutate(data);
  };

  if (isSuccess && !storybook) {
    return <Navigate to="/admin/admins" />;
  }

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Add New Admin</h1>
        <RoleEmailForm submitAction={onSubmit} />
      </div>
    </BasicLayout>
  );
}
