import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

// W26 ULA OPEN (id 2); W26 TA CLOSED on 2026-02-01 (id 1).
const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;
// Both lectures of 156, taught by CONRAD P and SOMEONE ELSE, and the 1A lecture.
const [oneA, lecture156a, lecture156b] = recruitmentCoursesFixtures.fourCourses;

/** What /api/instructor/recruitments returns for an instructor (issue #127). */
const instructorRecruitmentsFixtures = {
  /** Two recruitments: the TA one with two lectures, the ULA one with one. */
  twoRecruitments: [
    {
      ...closedTa,
      courses: [
        { ...lecture156a, recruitmentId: 1 },
        { ...lecture156b, recruitmentId: 1, section: null, title: null },
      ],
    },
    { ...openUla, courses: [{ ...oneA, recruitmentId: 2 }] },
  ],
};

export default instructorRecruitmentsFixtures;
