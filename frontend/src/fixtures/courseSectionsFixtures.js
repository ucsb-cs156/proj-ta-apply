/** What /api/recruitments/sections answers: one course's meetings in one quarter. */
const courseSectionsFixtures = {
  cmpsc156: {
    courseId: "CMPSC   156",
    quarter: "20262",
    title: "ADV APP PROGRAM",
    meetings: [
      {
        section: "0100",
        lecture: true,
        enrollCode: "07492",
        days: "T R",
        beginTime: "14:00",
        endTime: "15:15",
        location: "PHELP 3526",
        instructors: "CONRAD P",
      },
      {
        section: "0101",
        lecture: false,
        enrollCode: "07500",
        days: "W",
        beginTime: "09:00",
        endTime: "09:50",
        location: "PHELP 1401",
        instructors: "GAUCHO C",
      },
      {
        section: "0102",
        lecture: false,
        enrollCode: "07501",
        days: "F",
        beginTime: "09:00",
        endTime: "09:50",
        location: "PHELP 1401",
        instructors: "GAUCHO C",
      },
    ],
  },

  /** An online section: listed, but with nothing to say about when or where. */
  online: {
    courseId: "CMPSC     8",
    quarter: "20262",
    title: "INTRO TO COMP SCI",
    meetings: [
      {
        section: "0100",
        lecture: true,
        enrollCode: "07100",
        days: null,
        beginTime: null,
        endTime: null,
        location: null,
        instructors: "",
      },
    ],
  },

  /** The recruitment lists no section of this course, so there is nothing to look up. */
  none: {
    courseId: "CMPSC   130A",
    quarter: "20262",
    title: null,
    meetings: [],
  },
};

export default courseSectionsFixtures;
