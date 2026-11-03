import React from "react";
import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";

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

/** Issue #292: a first quarter applicant has no GPAs yet, so the summary says so. */
export const TaFirstQuarter = Template.bind({});
TaFirstQuarter.args = {
  application: {
    ...applicationsFixtures.oneTaApplication,
    firstQuarter: true,
    gpaMajor: null,
    gpaOverall: null,
  },
  type: "TA",
};

/** Issue #296: a draft in the same summary; a yes/no question not yet answered is blank. */
export const UlaDraft = Template.bind({});
UlaDraft.args = {
  application: draftApplicationsFixtures.savedUlaDraft,
  type: "ULA",
  draft: true,
};

/** A draft nothing has been saved to: every answer blank. */
export const EmptyUlaDraft = Template.bind({});
EmptyUlaDraft.args = {
  application: draftApplicationsFixtures.emptyUlaDraft,
  type: "ULA",
  draft: true,
};
