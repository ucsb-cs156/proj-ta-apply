import React from "react";
import { fn } from "storybook/test";
import RecruitmentCardLayout from "main/components/Recruitments/RecruitmentCardLayout";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

export default {
  title: "components/Recruitments/RecruitmentCardLayout",
  component: RecruitmentCardLayout,
  args: {
    onChangeDeadline: fn(),
    onDeleteRequested: fn(),
    onAction: fn(),
    onNavigate: fn(),
  },
};

const taRecruitment = recruitmentsFixtures.threeRecruitments[2];
const ulaRecruitment = recruitmentsFixtures.threeRecruitments[1];

const Template = (args) => <RecruitmentCardLayout {...args} />;

/** The most recent TA recruitment: its steps panel opens expanded. */
export const ExpandedTA = Template.bind({});
ExpandedTA.args = {
  recruitment: taRecruitment,
  applicationCount: 15,
  steps: recruitmentStepsFixtures.rankingsOpen,
  defaultExpanded: true,
};

/** An older recruitment: collapsed to the one-line summary. */
export const CollapsedULA = Template.bind({});
CollapsedULA.args = {
  recruitment: ulaRecruitment,
  applicationCount: 1,
  steps: recruitmentStepsFixtures.ulaFresh,
};

/** Two cards as the home page will show them: the current one expanded, the other collapsed. */
export const TwoRecruitments = (args) => (
  <>
    <RecruitmentCardLayout
      {...args}
      recruitment={taRecruitment}
      applicationCount={15}
      steps={recruitmentStepsFixtures.assigning}
      defaultExpanded
      testIdPrefix="Card-1"
    />
    <RecruitmentCardLayout
      {...args}
      recruitment={ulaRecruitment}
      applicationCount={1}
      steps={recruitmentStepsFixtures.ulaFresh}
      testIdPrefix="Card-2"
    />
  </>
);

/** Published: every step done, the badge in the header. */
export const Published = Template.bind({});
Published.args = {
  recruitment: { ...taRecruitment, assignmentsPublished: true },
  applicationCount: 15,
  steps: recruitmentStepsFixtures.published,
  defaultExpanded: true,
};
