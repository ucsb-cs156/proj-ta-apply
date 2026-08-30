import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import RoleEmailForm, {
  type RoleEmailFormFields,
} from "main/components/Users/RoleEmailForm";
import { useNavigate } from "react-router";
import { useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";

type InstructorsCreatePageProps = {
  storybook?: boolean;
};

export default function InstructorsCreatePage({
  storybook = false,
}: InstructorsCreatePageProps): React.JSX.Element {
  const navigation = useNavigate();
  const objectToAxiosParams = (
    instructor: RoleEmailFormFields,
  ): AxiosRequestConfig => ({
    url: "/api/admin/instructors/post",
    method: "POST",
    params: {
      email: instructor.email,
    },
  });

  const onSuccess = (instructor: RoleEmailFormFields) => {
    toast(`New instructor added - email: ${instructor.email}`);
    if (!storybook) navigation("/admin/instructors");
  };

  const mutation = useBackendMutation(
    objectToAxiosParams,
    { onSuccess },
    ["/api/admin/instructors/all"], // mutation makes this key stale so that pages relying on it reload
  );

  const onSubmit = async (data: RoleEmailFormFields) => {
    mutation.mutate(data);
  };

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Add New Instructor</h1>
        <RoleEmailForm submitAction={onSubmit} />
      </div>
    </BasicLayout>
  );
}
