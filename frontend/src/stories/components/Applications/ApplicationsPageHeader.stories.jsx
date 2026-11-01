import React from "react";
import ApplicationsPageHeader from "main/components/Applications/ApplicationsPageHeader";

export default {
  title: "components/Applications/ApplicationsPageHeader",
  component: ApplicationsPageHeader,
};

const Template = (args) => <ApplicationsPageHeader {...args} />;

export const Default = Template.bind({});
Default.args = { recruitmentId: 7 };

export const WithQuarterInTitle = Template.bind({});
WithQuarterInTitle.args = { recruitmentId: 7, title: "W26 TA Applications" };
