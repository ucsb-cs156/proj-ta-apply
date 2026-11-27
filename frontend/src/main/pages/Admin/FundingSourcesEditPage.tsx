import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import FundingSourceForm, {
  type FundingSourceFormFields,
} from "main/components/FundingSources/FundingSourceForm";
import { Navigate, useParams } from "react-router";
import { useBackend, useBackendMutation } from "main/utils/useBackend";
import { toast } from "react-toastify";
import type { AxiosRequestConfig } from "axios";
import {
  FUNDING_SOURCES_ALL_URL,
  FUNDING_SOURCES_PATH,
  FUNDING_SOURCES_PUT_URL,
  type FundingSource,
  findFundingSource,
  fundingSourceUpdatedToast,
} from "main/utils/fundingSources";

type FundingSourcesEditPageProps = {
  storybook?: boolean;
};

/**
 * Admin → Funding Sources → Edit (issue #512): /admin/fundingSources/edit/:abbreviation. Only the
 * explanation can change; the abbreviation is the key and is shown read-only. There is no
 * single-item endpoint, so the source is picked out of the list.
 */
export default function FundingSourcesEditPage({
  storybook = false,
}: FundingSourcesEditPageProps): React.JSX.Element {
  const { abbreviation } = useParams<{ abbreviation: string }>();

  const { data: fundingSources, isFetching } = useBackend<FundingSource[]>(
    [FUNDING_SOURCES_ALL_URL],
    { method: "GET", url: FUNDING_SOURCES_ALL_URL },
    // Stryker disable next-line all : don't test default value of empty list
    [],
  );

  const fundingSource = findFundingSource(fundingSources, abbreviation);

  const objectToAxiosParams = (
    fields: FundingSourceFormFields,
  ): AxiosRequestConfig => ({
    url: FUNDING_SOURCES_PUT_URL,
    method: "PUT",
    params: { abbreviation: fields.abbreviation },
    data: { explanation: fields.explanation },
  });

  const onSuccess = (updated: FundingSource) => {
    toast(fundingSourceUpdatedToast(updated.abbreviation));
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
        <h1>Edit Funding Source</h1>
        {fundingSource ? (
          <FundingSourceForm
            initialContents={fundingSource}
            submitAction={onSubmit}
            buttonLabel="Update"
            abbreviationReadOnly
          />
        ) : (
          <p data-testid="FundingSourcesEditPage-missing">
            {isFetching
              ? "Loading..."
              : `There is no funding source with the abbreviation ${abbreviation}.`}
          </p>
        )}
      </div>
    </BasicLayout>
  );
}
