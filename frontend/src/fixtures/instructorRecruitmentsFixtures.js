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
   * from faculty (the default), so the rows come without allocation, estimate or share (issue #178).
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
          unroundedAllocation: null,
        },
        {
          ...lecture156b,
          recruitmentId: 1,
          section: null,
          title: null,
          allocation: null,
          enrollmentEstimate: null,
          unroundedAllocation: null,
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
          unroundedAllocation: null,
        },
      ],
    },
  ],
  /**
   * The same two recruitments once the admin releases hiring targets to faculty (issues #178 and
   * #224): each course carries its allocation, and `targets` holds its figures by course id.
   */
  twoRecruitmentsWithAllocations: [
    {
      ...closedTa,
      allocationVisibility: "ALL_COURSES",
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
      targets: {
        2: {
          recruitmentCourseId: 2,
          allocation: 2,
          candidateCount: 7,
          rankingTarget: 4,
          rankedCount: 1,
          stillNeeded: 3,
        },
        // Only 5 interested candidates, so the target is capped below 2 × 3; all ranked already.
        3: {
          recruitmentCourseId: 3,
          allocation: 3,
          candidateCount: 5,
          rankingTarget: 5,
          rankedCount: 6,
          stillNeeded: 0,
        },
      },
    },
    {
      ...openUla,
      allocationVisibility: "ALL_COURSES",
      courses: [{ ...oneA, recruitmentId: 2, allocation: 1 }],
      targets: {
        1: {
          recruitmentCourseId: 1,
          allocation: 1,
          candidateCount: 4,
          rankingTarget: 2,
          rankedCount: 0,
          stillNeeded: 2,
        },
      },
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
    canRank: false,
  },
};

/**
 * The ranking page once the admin releases hiring targets: this lecture has two TAs (issue #178)
 * and its figures (issue #224).
 */
instructorRecruitmentsFixtures.candidateRankingPageWithAllocation = {
  ...instructorRecruitmentsFixtures.candidateRankingPage,
  allocation: 2,
  targets: {
    recruitmentCourseId: 2,
    allocation: 2,
    candidateCount: 7,
    rankingTarget: 4,
    rankedCount: 1,
    stillNeeded: 3,
  },
};

/**
 * Every course's allocation, as /api/instructor/recruitments/1/allocations returns it once the admin
 * shows all allocations to all faculty (issue #224).
 */
instructorRecruitmentsFixtures.allAllocations = [
  {
    id: 4,
    courseId: "CMPSC     8",
    section: "0100",
    instructor: "MIRZA D",
    allocation: 1,
  },
  {
    id: 2,
    courseId: "CMPSC   156",
    section: "0100",
    instructor: "CONRAD P",
    allocation: 2,
  },
  {
    id: 3,
    courseId: "CMPSC   156",
    section: "0200",
    instructor: "CONRAD P",
    allocation: 3,
  },
];

export default instructorRecruitmentsFixtures;
