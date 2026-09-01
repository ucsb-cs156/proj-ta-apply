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

/** The action column says what is still possible: editing, commenting, or only looking. */
export const TwoApplications = Template.bind({});
TwoApplications.args = {
  applications: applicationsFixtures.twoApplications,
  recruitments: recruitmentsFixtures.threeRecruitments,
};
