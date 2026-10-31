import React from "react";
import InstructorRecruitmentCards from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";

export default {
  title: "components/Instructor/InstructorRecruitmentCards",
  component: InstructorRecruitmentCards,
};

const Template = (args) => <InstructorRecruitmentCards {...args} />;

export const Empty = Template.bind({});
Empty.args = { recruitments: [] };

/** The TA recruitment's assignments are published (issue #180). */
export const WithPublishedAssignments = Template.bind({});
WithPublishedAssignments.args = {
  recruitments: instructorRecruitmentsFixtures.twoRecruitments.map((r) =>
    r.id === 1 ? { ...r, assignmentsPublished: true } : r,
  ),
};

/** A TA recruitment with two lectures and a ULA one with one. */
export const TwoRecruitments = Template.bind({});
TwoRecruitments.args = {
  recruitments: instructorRecruitmentsFixtures.twoRecruitments,
};
