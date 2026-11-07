import React from "react";
import InstructorRecruitmentCards from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";

export default {
  title: "components/Instructor/InstructorRecruitmentCards",
  component: InstructorRecruitmentCards,
};

const Template = (args) => <InstructorRecruitmentCards {...args} />;

const { nothingReleased, taReleased, ulaReleased, bothReleased } =
  instructorRecruitmentsFixtures.quarters;
const [s26Ta, w26Ta, w26Ula] = nothingReleased;

export const Empty = Template.bind({});
Empty.args = { recruitments: [] };

/** One quarter with one recruitment: each course has a TA card and nothing else (issue #364). */
export const QuarterWithOneRecruitment = Template.bind({});
QuarterWithOneRecruitment.args = { recruitments: [w26Ta] };

/**
 * One quarter with both recruitments (issue #364): CMPSC 156 (0100) is in both, so its item has a
 * TA card and a ULA card; the sectionless 156 lecture is only in the TA recruitment and CMPSC 1A
 * only in the ULA one. This is the case the maintainer is asked to judge for heaviness: the dates
 * and badges of each recruitment repeat in every course that is in it.
 */
export const QuarterWithTwoRecruitments = Template.bind({});
QuarterWithTwoRecruitments.args = { recruitments: [w26Ta, w26Ula] };

/** A course that is in only one of the quarter's two recruitments: one card under the table. */
export const CourseInOneRecruitmentOnly = Template.bind({});
CourseInOneRecruitmentOnly.args = {
  recruitments: [
    { ...w26Ta, courses: [w26Ta.courses[1]] },
    { ...w26Ula, courses: [w26Ula.courses[1]] },
  ],
};

/** Two quarters, newest first; nothing released: Section, Enrolled and Max (3 columns). */
export const NothingReleased = Template.bind({});
NothingReleased.args = { recruitments: nothingReleased };

/** The TA allocations are released: Enrollment Estimate and TA Allocation join (5 columns). */
export const TaAllocationsReleased = Template.bind({});
TaAllocationsReleased.args = { recruitments: taReleased };

/** The ULA allocations are released: Enrollment Estimate and ULA Allocation (5 columns). */
export const UlaAllocationsReleased = Template.bind({});
UlaAllocationsReleased.args = { recruitments: ulaReleased };

/** Both released: all six columns for the course in both recruitments. */
export const BothAllocationsReleased = Template.bind({});
BothAllocationsReleased.args = { recruitments: bothReleased };

/** The W26 TA recruitment's assignments are published (issue #180). */
export const WithPublishedAssignments = Template.bind({});
WithPublishedAssignments.args = {
  recruitments: [s26Ta, { ...w26Ta, assignmentsPublished: true }, w26Ula],
};
