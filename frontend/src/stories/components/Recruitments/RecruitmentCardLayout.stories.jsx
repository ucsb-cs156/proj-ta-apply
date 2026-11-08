import React from "react";
import { fn } from "storybook/test";
import RecruitmentCardLayout, {
  RECRUITMENT_CARD_STORAGE_PREFIX,
} from "main/components/Recruitments/RecruitmentCardLayout";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

/**
 * The card remembers whether it is open in localStorage, so each story first forgets what an
 * earlier story left, and starts from its own default.
 */
const forgetRecruitmentCards = (Story) => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(RECRUITMENT_CARD_STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
  return <Story />;
};

export default {
  title: "components/Recruitments/RecruitmentCardLayout",
  component: RecruitmentCardLayout,
  decorators: [forgetRecruitmentCards],
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

/**
 * The most recent TA recruitment: its steps panel opens expanded. Since issue #379 the card sits
 * inside its quarter's card, so its top row is headed "TA" (no quarter) and is one toggle button
 * with the caret, badges and count; the trash icon is beside it. The footer has Courses, Draft
 * Applications, Applications, Make Assignments and View Assignments (issue #317), then Download
 * Rankings CSV since reviews are open, and Change History at the right edge (issue #390).
 */
export const ExpandedTA = Template.bind({});
ExpandedTA.args = {
  recruitment: taRecruitment,
  applicationCount: 15,
  steps: recruitmentStepsFixtures.rankingsOpen,
  defaultExpanded: true,
};

/** An older recruitment: open, but its diagram collapsed to the one-line summary. */
export const CollapsedULA = Template.bind({});
CollapsedULA.args = {
  recruitment: ulaRecruitment,
  applicationCount: 1,
  steps: recruitmentStepsFixtures.ulaFresh,
};

/**
 * Issue #379: the card closed by its top row. Only the row shows: caret, "ULA", the badges, the
 * count and the trash icon; clicking the row opens it again.
 */
export const ClosedCard = Template.bind({});
ClosedCard.args = {
  recruitment: ulaRecruitment,
  applicationCount: 1,
  steps: recruitmentStepsFixtures.ulaFresh,
  defaultOpen: false,
};

/**
 * Two cards as they nest inside a quarter's card on the home page: TA then ULA, both open, the
 * current one's diagram expanded, the other's collapsed. Each row toggles its own card.
 */
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

/**
 * Faculty reviews not started: there are no rankings yet, so no Download Rankings CSV; the footer
 * is the five workflow buttons, then the gap, then Change History flush right.
 */
export const NoRankingsYet = Template.bind({});
NoRankingsYet.args = {
  recruitment: { ...taRecruitment, reviewStatus: "NotStarted" },
  applicationCount: 15,
  steps: recruitmentStepsFixtures.ulaFresh,
};

/** Published: every step done, the badge in the header. */
export const Published = Template.bind({});
Published.args = {
  recruitment: { ...taRecruitment, assignmentsPublished: true },
  applicationCount: 15,
  steps: recruitmentStepsFixtures.published,
  defaultExpanded: true,
};
