import React from "react";
import ApplicationTable from "main/components/Applications/ApplicationTable";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/Applications/ApplicationTable",
  component: ApplicationTable,
};

const Template = (args) => <ApplicationTable {...args} />;

export const Empty = Template.bind({});
Empty.args = { applications: [], recruitments: [] };

/** Edit while applications are open; once closed, a disabled Edit (hover it) and a View link. */
export const TwoApplications = Template.bind({});
TwoApplications.args = {
  applications: applicationsFixtures.twoApplications,
  recruitments: recruitmentsFixtures.threeRecruitments,
};

/** An admin's test run sits alongside real applications, flagged in the Test column. */
export const IncludingATestApplication = Template.bind({});
IncludingATestApplication.args = {
  applications: applicationsFixtures.threeApplicationsIncludingATest,
  recruitments: recruitmentsFixtures.threeRecruitments,
  showTestColumn: true,
};
