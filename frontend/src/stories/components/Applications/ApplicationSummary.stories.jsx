import React from "react";
import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import applicationsFixtures from "fixtures/applicationsFixtures";

export default {
  title: "components/Applications/ApplicationSummary",
  component: ApplicationSummary,
};

const Template = (args) => <ApplicationSummary {...args} />;

export const TaApplication = Template.bind({});
TaApplication.args = {
  application: applicationsFixtures.oneTaApplication,
  type: "TA",
};

export const UlaApplication = Template.bind({});
UlaApplication.args = {
  application: applicationsFixtures.oneUlaApplication,
  type: "ULA",
};
