import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

// W26 ULA faculty reviews OPEN (id 2); W26 TA reviews CLOSED (id 1).
const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;
// Both lectures of 156, taught by CONRAD P and SOMEONE ELSE, and the 1A lecture.
const [oneA, lecture156a, lecture156b] = recruitmentCoursesFixtures.fourCourses;

/** What /api/instructor/recruitments returns for an instructor (issue #127). */
const instructorRecruitmentsFixtures = {
  /**
   * Two recruitments: the TA one with two lectures, the ULA one with one. Allocations are hidden
   * from faculty (the default), so the rows come without allocation or estimate (issue #178).
   */
  twoRecruitments: [
    {
      ...closedTa,
      courses: [
        {
          ...lecture156a,
          recruitmentId: 1,
          allocation: null,
          enrollmentEstimate: null,
        },
        {
          ...lecture156b,
          recruitmentId: 1,
          section: null,
          title: null,
          allocation: null,
          enrollmentEstimate: null,
        },
      ],
    },
    {
      ...openUla,
      courses: [
        {
          ...oneA,
          recruitmentId: 2,
          allocation: null,
          enrollmentEstimate: null,
        },
      ],
    },
  ],
  /** The same two recruitments once the admin shows allocations to faculty (issue #178). */
  twoRecruitmentsWithAllocations: [
    {
      ...closedTa,
      allocationsVisibleToFaculty: true,
      courses: [
        { ...lecture156a, recruitmentId: 1, allocation: 2 },
        {
          ...lecture156b,
          recruitmentId: 1,
          section: null,
          title: null,
          allocation: 3,
        },
      ],
    },
    {
      ...openUla,
      allocationsVisibleToFaculty: true,
      courses: [{ ...oneA, recruitmentId: 2, allocation: 1 }],
    },
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
    allocation: null,
  },
};

/** The ranking page once the admin shows allocations: this lecture has two TAs (issue #178). */
instructorRecruitmentsFixtures.candidateRankingPageWithAllocation = {
  ...instructorRecruitmentsFixtures.candidateRankingPage,
  allocation: 2,
};

export default instructorRecruitmentsFixtures;
