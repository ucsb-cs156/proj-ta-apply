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

/** A TA recruitment with two lectures and a ULA one with one. */
export const TwoRecruitments = Template.bind({});
TwoRecruitments.args = {
  recruitments: instructorRecruitmentsFixtures.twoRecruitments,
};

/** The admin has shown allocations to faculty: each course says how many it has (issue #178). */
export const WithAllocationsShown = Template.bind({});
WithAllocationsShown.args = {
  recruitments: instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations,
};
