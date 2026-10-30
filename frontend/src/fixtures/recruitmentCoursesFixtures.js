const recruitmentCoursesFixtures = {
  // Two lectures of one course, plus another course; deliberately includes a removed row so the
  // "show removed" toggle has something to reveal.
  fourCourses: [
    {
      id: 1,
      recruitmentId: 7,
      courseId: "CMPSC     1A",
      enrollCode: "07100",
      section: "0100",
      title: "Introduction to Computer Programming",
      instructor: "GAUCHO C",
      days: "M W",
      time: "09:30 - 10:45",
      room: "PHELP 1401",
      enrollment: 200,
      maxEnroll: 250,
      status: "open",
      summerSession: null,
      removed: false,
      stale: false,
      manuallyAdded: false,
    },
    {
      id: 2,
      recruitmentId: 7,
      courseId: "CMPSC   156",
      enrollCode: "07492",
      section: "0100",
      title: "Advanced Applications Programming",
      instructor: "CONRAD P",
      days: "T R",
      time: "14:00 - 15:15",
      room: "PHELP 3526",
      enrollment: 120,
      maxEnroll: 150,
      status: "open",
      summerSession: null,
      removed: false,
      stale: false,
      manuallyAdded: false,
    },
    {
      id: 3,
      recruitmentId: 7,
      courseId: "CMPSC   156",
      enrollCode: "07500",
      section: "0200",
      title: "Advanced Applications Programming",
      instructor: "SOMEONE ELSE",
      days: "T R",
      time: "15:30 - 16:45",
      room: "PHELP 3526",
      enrollment: 60,
      maxEnroll: 80,
      status: "closed",
      summerSession: null,
      removed: false,
      stale: false,
      manuallyAdded: false,
    },
    {
      id: 4,
      recruitmentId: 7,
      courseId: "CMPSC   165A",
      enrollCode: "07600",
      section: "0100",
      title: "Artificial Intelligence",
      instructor: "TURING A",
      days: "M W",
      time: "11:00 - 12:15",
      room: "GIRV 1004",
      enrollment: 90,
      maxEnroll: 100,
      status: "open",
      summerSession: null,
      removed: true,
      stale: false,
      manuallyAdded: false,
    },
  ],
};

/** The second lecture of 156 as the last Populate no longer found it (issue #122). */
recruitmentCoursesFixtures.oneStale = {
  ...recruitmentCoursesFixtures.fourCourses[2],
  stale: true,
};

/** A lecture an admin added by enroll code (issue #125). */
recruitmentCoursesFixtures.oneManual = {
  ...recruitmentCoursesFixtures.fourCourses[3],
  removed: false,
  manuallyAdded: true,
};

/** The first lecture of 1A as the schedule has cancelled it (issue #123). */
recruitmentCoursesFixtures.oneCancelled = {
  ...recruitmentCoursesFixtures.fourCourses[0],
  status: "cancelled",
};

export default recruitmentCoursesFixtures;
