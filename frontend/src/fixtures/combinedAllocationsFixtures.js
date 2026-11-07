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
      days: "M W",
      time: "9:30 AM - 10:45 AM",
      room: "PHELP 1448",
      enrollment: 90,
      maxEnroll: 120,
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
      days: "T R",
      time: "2:00 PM - 3:15 PM",
      room: "HFH 1104",
      enrollment: 40,
      maxEnroll: 50,
      status: "cancelled",
      allocation: 2,
      allocationVersion: 1,
      enrollmentEstimate: null,
      unroundedAllocation: 0.4,
    },
  ],
  /** /api/admin/recruitments/all, for the Auto Allocate counts. */
  recruitments: [
    {
      id: 5,
      quarter: "20264",
      type: "TA",
      allocationBulkVersion: 7,
      reviewStatus: "Open",
    },
    {
      id: 6,
      quarter: "20264",
      type: "ULA",
      allocationBulkVersion: 8,
      reviewStatus: "NotStarted",
    },
    {
      id: 3,
      quarter: "20262",
      type: "ULA",
      allocationBulkVersion: 1,
      reviewStatus: "Closed",
    },
    {
      id: 1,
      quarter: "20261",
      type: "TA",
      allocationBulkVersion: 0,
      reviewStatus: "NotStarted",
    },
  ],
  /** The TA recruitment's ranking counts and instructor emails, by course id. */
  taRankingSummaries: [
    {
      recruitmentCourseId: 1,
      rankingCount: 4,
      instructorEmail: "pconrad@ucsb.edu",
    },
    { recruitmentCourseId: 2, rankingCount: 6, instructorEmail: null },
  ],
  /** The ULA recruitment's: CMPSC 24 (only in the ULA recruitment) has an email of its own. */
  ulaRankingSummaries: [
    {
      recruitmentCourseId: 11,
      rankingCount: 9,
      instructorEmail: "other@ucsb.edu",
    },
    {
      recruitmentCourseId: 12,
      rankingCount: 7,
      instructorEmail: "wizard@ucsb.edu",
    },
  ],
};

export default combinedAllocationsFixtures;
