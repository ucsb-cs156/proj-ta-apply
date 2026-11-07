/**
 * The courses of F26's TA recruitment (id 5) and ULA recruitment (id 6), for the Combined
 * Allocation page (issue #358): CMPSC 156 is in both (their estimates disagree, 100 and 80), CMPSC
 * 8 only in the TA one, CMPSC 24 only in the ULA one. The ids match budgetFixtures.bothTypes.
 */
const row = {
  days: null,
  time: null,
  room: null,
  enrollment: null,
  maxEnroll: null,
  status: "open",
  summerSession: null,
  removed: false,
};

const combinedAllocationsFixtures = {
  taCourses: [
    {
      ...row,
      id: 1,
      recruitmentId: 5,
      courseId: "CMPSC   156",
      enrollCode: "07492",
      section: "0100",
      title: "Advanced Applications",
      instructor: "CONRAD P",
      allocation: 3,
      allocationVersion: 4,
      enrollmentEstimate: 100,
      unroundedAllocation: 2.5,
    },
    {
      ...row,
      id: 2,
      recruitmentId: 5,
      courseId: "CMPSC     8",
      enrollCode: "07000",
      section: "0100",
      title: "Intro",
      instructor: "GAUCHO C",
      allocation: 0,
      allocationVersion: 0,
      enrollmentEstimate: 60,
      unroundedAllocation: null,
    },
  ],
  ulaCourses: [
    {
      ...row,
      id: 11,
      recruitmentId: 6,
      courseId: "CMPSC   156",
      enrollCode: "07492",
      section: "0100",
      title: "Advanced Applications",
      instructor: "CONRAD P",
      allocation: 6,
      allocationVersion: 9,
      enrollmentEstimate: 80,
      unroundedAllocation: 7.25,
    },
    {
      ...row,
      id: 12,
      recruitmentId: 6,
      courseId: "CMPSC    24",
      enrollCode: "07300",
      section: "0100",
      title: "Data Structures",
      instructor: "WIZARD W",
      allocation: 2,
      allocationVersion: 1,
      enrollmentEstimate: null,
      unroundedAllocation: 0.4,
    },
  ],
  /** /api/admin/recruitments/all, for the Auto Allocate counts. */
  recruitments: [
    { id: 5, quarter: "20264", type: "TA", allocationBulkVersion: 7 },
    { id: 6, quarter: "20264", type: "ULA", allocationBulkVersion: 8 },
    { id: 3, quarter: "20262", type: "ULA", allocationBulkVersion: 1 },
    { id: 1, quarter: "20261", type: "TA", allocationBulkVersion: 0 },
  ],
};

export default combinedAllocationsFixtures;
