import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailForm, {
  type RoleEmailFormFields,
} from "main/components/Users/RoleEmailForm";
import { useNavigate } from "react-router";
import { useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";

type GradStudentsCreatePageProps = {
  storybook?: boolean;
};

export default function GradStudentsCreatePage({
  storybook = false,
}: GradStudentsCreatePageProps): React.JSX.Element {
  const navigation = useNavigate();
  const objectToAxiosParams = (
    gradStudent: RoleEmailFormFields,
  ): AxiosRequestConfig => ({
    url: "/api/admin/gradstudents/post",
    method: "POST",
    params: {
      email: gradStudent.email,
    },
  });

  const onSuccess = (gradStudent: RoleEmailFormFields) => {
    toast(`New grad student added - email: ${gradStudent.email}`);
    if (!storybook) navigation("/admin/gradstudents");
  };

  const mutation = useBackendMutation(
    objectToAxiosParams,
    { onSuccess },
    // Must match the key the index page reads ("/get"); invalidating "/all" hit nothing.
    ["/api/admin/gradstudents/get"],
  );

  const onSubmit = async (data: RoleEmailFormFields) => {
    mutation.mutate(data);
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Add New Grad Student</h1>
        <RoleEmailForm submitAction={onSubmit} />
      </div>
    </BasicLayout>
  );
}
