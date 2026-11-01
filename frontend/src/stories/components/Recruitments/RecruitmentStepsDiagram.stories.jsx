import React from "react";
import { fn } from "storybook/test";
import RecruitmentStepsDiagram from "main/components/Recruitments/RecruitmentStepsDiagram";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

export default {
  title: "components/Recruitments/RecruitmentStepsDiagram",
  component: RecruitmentStepsDiagram,
  args: { onAction: fn(), onNavigate: fn() },
};

const Template = (args) => <RecruitmentStepsDiagram {...args} />;

/** The static diagram for the help page: a TA recruitment. */
export const StaticTA = Template.bind({});
StaticTA.args = { type: "TA" };

/** The static diagram for a ULA recruitment. */
export const StaticULA = Template.bind({});
StaticULA.args = { type: "ULA" };

export const LiveFresh = Template.bind({});
LiveFresh.args = { type: "TA", steps: recruitmentStepsFixtures.fresh };

export const LiveApplicationsOpen = Template.bind({});
LiveApplicationsOpen.args = {
  type: "TA",
  steps: recruitmentStepsFixtures.applicationsOpen,
};

export const LiveApplicationsClosed = Template.bind({});
LiveApplicationsClosed.args = {
  type: "TA",
  steps: recruitmentStepsFixtures.applicationsClosed,
};

export const LiveAllocated = Template.bind({});
LiveAllocated.args = { type: "TA", steps: recruitmentStepsFixtures.allocated };

export const LiveReleased = Template.bind({});
LiveReleased.args = { type: "TA", steps: recruitmentStepsFixtures.released };

/** Reviews are open with a deadline, shown on step 7 until reviews close. */
export const LiveRankingsOpen = Template.bind({});
LiveRankingsOpen.args = {
  type: "TA",
  steps: recruitmentStepsFixtures.rankingsOpen,
};

export const LiveRankingsClosed = Template.bind({});
LiveRankingsClosed.args = {
  type: "TA",
  steps: recruitmentStepsFixtures.rankingsClosed,
};

export const LiveAssigning = Template.bind({});
LiveAssigning.args = { type: "TA", steps: recruitmentStepsFixtures.assigning };

/** Every step done; step 9 links to the published Assignments page. */
export const LivePublished = Template.bind({});
LivePublished.args = { type: "TA", steps: recruitmentStepsFixtures.published };

export const LiveULAFresh = Template.bind({});
LiveULAFresh.args = { type: "ULA", steps: recruitmentStepsFixtures.ulaFresh };
