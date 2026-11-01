import React from "react";
import { fn } from "storybook/test";
import RecruitmentStepsPanel from "main/components/Recruitments/RecruitmentStepsPanel";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

export default {
  title: "components/Recruitments/RecruitmentStepsPanel",
  component: RecruitmentStepsPanel,
  args: { onAction: fn(), onNavigate: fn() },
};

const Template = (args) => <RecruitmentStepsPanel {...args} />;

/** Collapsed to its one-line summary. */
export const Collapsed = Template.bind({});
Collapsed.args = { steps: recruitmentStepsFixtures.rankingsOpen };

export const Expanded = Template.bind({});
Expanded.args = {
  steps: recruitmentStepsFixtures.rankingsOpen,
  defaultExpanded: true,
};

export const AllDone = Template.bind({});
AllDone.args = {
  steps: recruitmentStepsFixtures.published,
  defaultExpanded: true,
};
