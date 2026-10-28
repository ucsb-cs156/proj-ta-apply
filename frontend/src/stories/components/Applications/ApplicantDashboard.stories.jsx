import React from "react";
import ApplicantDashboard from "main/components/Applications/ApplicantDashboard";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

export default {
  title: "components/Applications/ApplicantDashboard",
  component: ApplicantDashboard,
};

const Template = (args) => <ApplicantDashboard {...args} />;

const empty = {
  open: [],
  upcoming: [],
  recentlyClosed: [],
  applications: [],
  applicable: [],
};

/** The commonest state: nothing is open, and there is nothing to report. */
export const NothingOpen = Template.bind({});
NothingOpen.args = { ...empty };

export const OpenForApplications = Template.bind({});
OpenForApplications.args = {
  ...empty,
  open: [openUla, { ...upcomingTa, id: 9 }],
};

export const AlreadyApplied = Template.bind({});
AlreadyApplied.args = {
  ...empty,
  open: [openUla],
  applications: [applicationsFixtures.oneUlaApplication],
  applicable: [openUla],
};

export const UpcomingAndRecentlyClosed = Template.bind({});
UpcomingAndRecentlyClosed.args = {
  ...empty,
  upcoming: [upcomingTa],
  recentlyClosed: [closedTa],
};
