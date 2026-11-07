import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

// S26 TA reviews NotStarted (id 3); W26 ULA faculty reviews OPEN (id 2); W26 TA reviews CLOSED (id 1).
const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;
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
      allocationsReleased: true,
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
      allocationsReleased: true,
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

// ---- issue #364: the home page groups the recruitments by quarter ----

/** The planning figures as they come while a recruitment's allocations are withheld. */
const withheld = {
  allocation: null,
  enrollmentEstimate: null,
  unroundedAllocation: null,
};

// W26: CMPSC 156 (0100) is in both recruitments, the second 156 lecture only in the TA one, and
// CMPSC 1A only in the ULA one. The same section carries the same enrollment in both rows (one
// Enrollment Estimate per course per quarter, issue #363).
const ta156a = { ...lecture156a, recruitmentId: 1, ...withheld };
const ta156b = {
  ...lecture156b,
  recruitmentId: 1,
  section: null,
  title: null,
  ...withheld,
};
const ula156a = { ...lecture156a, id: 5, recruitmentId: 2, ...withheld };
const ula1A = { ...oneA, recruitmentId: 2, ...withheld };
// S26: one course, in the quarter's only recruitment, whose reviews have not started.
const ta8 = {
  id: 6,
  recruitmentId: 3,
  courseId: "CMPSC     8",
  enrollCode: "07110",
  section: "0100",
  title: "Introduction to Computer Science",
  instructor: "CONRAD P",
  days: "T R",
  time: "11:00 - 12:15",
  room: "PHELP 1160",
  enrollment: 150,
  maxEnroll: 180,
  status: "open",
  summerSession: null,
  removed: false,
  ...withheld,
};

const target = (
  recruitmentCourseId,
  allocation,
  candidateCount,
  rankingTarget,
  rankedCount,
  stillNeeded,
) => ({
  recruitmentCourseId,
  allocation,
  candidateCount,
  rankingTarget,
  rankedCount,
  stillNeeded,
});

/** The W26 TA recruitment with its allocations released to faculty (issues #224 and #364). */
const taReleased = {
  ...closedTa,
  allocationVisibility: "OWN_COURSES",
  allocationsReleased: true,
  courses: [
    { ...ta156a, allocation: 2, enrollmentEstimate: 130 },
    { ...ta156b, allocation: 3, enrollmentEstimate: 70 },
  ],
  targets: { 2: target(2, 2, 7, 4, 1, 3), 3: target(3, 3, 5, 5, 6, 0) },
};

/** The W26 ULA recruitment with its allocations released to faculty. */
const ulaReleased = {
  ...openUla,
  allocationVisibility: "OWN_COURSES",
  allocationsReleased: true,
  courses: [
    { ...ula156a, allocation: 1, enrollmentEstimate: 130 },
    { ...ula1A, allocation: 4, enrollmentEstimate: 220 },
  ],
  targets: { 5: target(5, 1, 4, 2, 0, 2), 1: target(1, 4, 9, 8, 8, 0) },
};

/**
 * What /api/instructor/recruitments returns for an instructor teaching in two quarters, in each
 * release state (issue #364): S26 has one recruitment (TA); W26 has both, with one course in both
 * of them and one course in each alone.
 */
instructorRecruitmentsFixtures.quarters = {
  nothingReleased: [
    { ...upcomingTa, courses: [ta8] },
    { ...closedTa, courses: [ta156a, ta156b] },
    { ...openUla, courses: [ula156a, ula1A] },
  ],
  taReleased: [
    { ...upcomingTa, courses: [ta8] },
    taReleased,
    { ...openUla, courses: [ula156a, ula1A] },
  ],
  ulaReleased: [
    { ...upcomingTa, courses: [ta8] },
    { ...closedTa, courses: [ta156a, ta156b] },
    ulaReleased,
  ],
  bothReleased: [{ ...upcomingTa, courses: [ta8] }, taReleased, ulaReleased],
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

const courseRows = [
  {
    id: 4,
    recruitmentId: 1,
    courseId: "CMPSC     8",
    enrollCode: "07110",
    section: "0100",
    title: "Introduction to Computer Science",
    instructor: "MIRZA D",
    days: "T R",
    time: "11:00 - 12:15",
    room: "PHELP 1160",
    enrollment: 150,
    maxEnroll: 180,
    status: "open",
    summerSession: null,
    removed: false,
    allocation: 1,
    enrollmentEstimate: 160,
    unroundedAllocation: 1.4,
  },
  {
    id: 2,
    recruitmentId: 1,
    courseId: "CMPSC   156",
    enrollCode: "07492",
    section: "0100",
    title: "Advanced Applications Programming",
    instructor: "CONRAD P",
    days: "M W",
    time: "14:00 - 15:15",
    room: "PHELP 3526",
    enrollment: 120,
    maxEnroll: 150,
    status: "open",
    summerSession: null,
    removed: false,
    allocation: 2,
    enrollmentEstimate: 130,
    unroundedAllocation: 2.2,
  },
  {
    id: 3,
    recruitmentId: 1,
    courseId: "CMPSC   156",
    enrollCode: "07500",
    section: "0200",
    title: "Advanced Applications Programming",
    instructor: "CONRAD P",
    days: "T R",
    time: "09:30 - 10:45",
    room: "PHELP 3526",
    enrollment: 80,
    maxEnroll: 100,
    status: "open",
    summerSession: null,
    removed: false,
    allocation: 3,
    enrollmentEstimate: 90,
    unroundedAllocation: 2.9,
  },
];

/**
 * What /api/instructor/recruitments/1/courses returns once the admin shows all courses'
 * allocations to all faculty (issues #300 and #301): the allocation figures are in every row.
 */
instructorRecruitmentsFixtures.coursesWithAllocations = {
  recruitmentId: 1,
  quarter: "20261",
  type: "TA",
  allocationsShown: true,
  courses: courseRows,
};

/**
 * The same recruitment while the admin shows allocations to admins only (or to faculty for their
 * own courses): the server leaves the three allocation fields out of the rows altogether.
 */
instructorRecruitmentsFixtures.coursesWithoutAllocations = {
  recruitmentId: 1,
  quarter: "20261",
  type: "TA",
  allocationsShown: false,
  courses: courseRows.map(
    ({ allocation, enrollmentEstimate, unroundedAllocation, ...rest }) => rest,
  ),
};

export default instructorRecruitmentsFixtures;
