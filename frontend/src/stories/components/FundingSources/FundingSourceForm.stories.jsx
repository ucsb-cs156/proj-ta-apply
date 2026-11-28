import React from "react";
import FundingSourceForm from "main/components/FundingSources/FundingSourceForm";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";

export default {
  title: "components/FundingSources/FundingSourceForm",
  component: FundingSourceForm,
};

const Template = (args) => <FundingSourceForm {...args} />;

/** The create page's form: both fields empty. Submit logs the trimmed values. */
export const Create = Template.bind({});
Create.args = {
  submitAction: (data) => {
    console.log("Submit was clicked with data: ", data);
    window.alert("Submit was clicked with data: " + JSON.stringify(data));
  },
};

/** The edit page's form: the abbreviation is the key and cannot change. */
export const Edit = Template.bind({});
Edit.args = {
  initialContents: fundingSourcesFixtures.oneSource,
  buttonLabel: "Update",
  abbreviationReadOnly: true,
  submitAction: (data) => {
    console.log("Submit was clicked with data: ", data);
    window.alert("Submit was clicked with data: " + JSON.stringify(data));
  },
};
