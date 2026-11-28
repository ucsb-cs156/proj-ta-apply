import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import FundingSourceForm, {
  type FundingSourceFormFields,
} from "main/components/FundingSources/FundingSourceForm";
import { Navigate } from "react-router";
import { useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";
import {
  FUNDING_SOURCES_ALL_URL,
  FUNDING_SOURCES_PATH,
  FUNDING_SOURCES_POST_URL,
  type FundingSource,
  fundingSourceCreatedToast,
} from "main/utils/fundingSources";

type FundingSourcesCreatePageProps = {
  storybook?: boolean;
};

/** Admin → Funding Sources → Create (issue #512): abbreviation and explanation, then the list. */
export default function FundingSourcesCreatePage({
  storybook = false,
}: FundingSourcesCreatePageProps): React.JSX.Element {
  const objectToAxiosParams = (
    fields: FundingSourceFormFields,
  ): AxiosRequestConfig => ({
    url: FUNDING_SOURCES_POST_URL,
    method: "POST",
    params: {
      abbreviation: fields.abbreviation,
      explanation: fields.explanation,
    },
  });

  const onSuccess = (created: FundingSource) => {
    toast(fundingSourceCreatedToast(created.abbreviation));
  };

  const mutation = useBackendMutation<FundingSourceFormFields, FundingSource>(
    objectToAxiosParams,
    { onSuccess },
    [FUNDING_SOURCES_ALL_URL],
  );

  const onSubmit = async (data: FundingSourceFormFields) => {
    mutation.mutate(data);
  };

  if (mutation.isSuccess && !storybook) {
    return <Navigate to={FUNDING_SOURCES_PATH} />;
  }

  return (
    <BasicLayout>
      <div className="pt-2">
        <h1>Create Funding Source</h1>
        <FundingSourceForm submitAction={onSubmit} />
      </div>
    </BasicLayout>
  );
}
