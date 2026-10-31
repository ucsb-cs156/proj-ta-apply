import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

// W26 ULA faculty reviews OPEN (id 2); W26 TA reviews CLOSED (id 1).
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
  candidateRankingPage: {
    recruitmentId: 1,
    quarter: "20261",
    type: "TA",
    tentativeOpeningDate: "2025-12-01",
    primaryConsiderationDate: "2026-01-20",
    actualOpeningDate: "2026-01-06",
    actualClosingDate: "2026-02-01",
    reviewStatus: "Closed",
    facultyReviewOpeningDate: "2026-01-08",
    facultyRankingDeadline: "2026-02-15",
    course: {
      id: 2,
      courseId: "CMPSC   156",
      section: "0100",
      title: "Advanced Applications Programming",
      instructor: "CONRAD P",
    },
    otherCourses: [
      {
        id: 3,
        courseId: "CMPSC   156",
        section: "0200",
        title: "Advanced Applications Programming",
        instructor: "CONRAD P",
      },
    ],
  },
};

export default instructorRecruitmentsFixtures;
