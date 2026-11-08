// GET /api/admin/assignments?recruitmentId= (issue #179): the lectures of a recruitment with their
// allocation and assignment counts, and every real, uncancelled applicant with their identity
// fields, pencilled-in lecture and each lecture's rank for them.
const taIdentityHeaders = [
  "firstName",
  "lastName",
  "email",
  "major",
  "classLevel",
  "yearInProgram",
  "graduationDate",
];

const taCourses = [
  {
    id: 10,
    courseId: "CMPSC     8",
    section: "0100",
    enrollCode: "07450",
    allocation: 2,
    assigned: 1,
    left: 1,
    historical: false,
  },
  {
    id: 20,
    courseId: "CMPSC    16",
    section: "0100",
    enrollCode: "07500",
    allocation: 1,
    assigned: 2,
    left: -1,
    historical: false,
  },
  {
    id: 30,
    courseId: "CMPSC    24",
    section: "0100",
    enrollCode: "07600",
    allocation: 0,
    assigned: 0,
    left: 0,
    historical: true,
  },
];

const taRows = [
  {
    applicationId: 1,
    identity: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@ucsb.edu",
      major: "Computer Science",
      classLevel: "PHD",
      yearInProgram: "3",
      graduationDate: "Spring 2027",
    },
    tentativeAssignment: 10,
    rankings: { 10: 1, 20: 3 },
    preferences: { 10: "1st Choice", 20: "Would Consider" },
  },
  {
    applicationId: 2,
    identity: {
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@ucsb.edu",
      major: "Computer Engineering",
      classLevel: "MS",
      yearInProgram: "1",
      graduationDate: "Spring 2028",
    },
    tentativeAssignment: 20,
    rankings: { 20: 1 },
    preferences: { 20: "Enthusiastic", 30: "2nd Choice" },
  },
  {
    applicationId: 3,
    identity: {
      firstName: "Alan",
      lastName: "Turing",
      email: "alan@ucsb.edu",
      major: "Computer Science",
      classLevel: "PHD",
      yearInProgram: "5",
      graduationDate: "Winter 2027",
    },
    tentativeAssignment: 20,
    rankings: { 10: 2, 30: 1 },
    preferences: { 30: "1st Choice" },
  },
  {
    applicationId: 4,
    identity: {
      firstName: "",
      lastName: "",
      email: "blank@ucsb.edu",
      major: "",
      classLevel: "",
      yearInProgram: "",
      graduationDate: "",
    },
    tentativeAssignment: null,
    rankings: {},
    preferences: {},
  },
];

const assignmentsFixtures = {
  taPage: {
    recruitmentId: 7,
    type: "TA",
    identityHeaders: taIdentityHeaders,
    courses: taCourses,
    rows: taRows,
    version: 3,
  },
  /** The same page after Ada is moved from CMPSC 8 to CMPSC 24. */
  taPageAfterMove: {
    recruitmentId: 7,
    type: "TA",
    identityHeaders: taIdentityHeaders,
    courses: [
      { ...taCourses[0], assigned: 0, left: 2 },
      taCourses[1],
      { ...taCourses[2], assigned: 1, left: -1 },
    ],
    rows: [{ ...taRows[0], tentativeAssignment: 30 }, ...taRows.slice(1)],
    version: 4,
  },
  ulaPage: {
    recruitmentId: 2,
    type: "ULA",
    identityHeaders: [
      "firstName",
      "lastName",
      "email",
      "major",
      "yearInProgram",
      "graduationDate",
      "gpaMajor",
      "gpaOverall",
      "previousServiceAsUla",
    ],
    courses: [
      {
        id: 40,
        courseId: "CMPSC   156",
        section: "0100",
        enrollCode: "08000",
        allocation: 3,
        assigned: 0,
        left: 3,
        historical: false,
      },
    ],
    rows: [
      {
        applicationId: 5,
        identity: {
          firstName: "Edsger",
          lastName: "Dijkstra",
          email: "edsger@ucsb.edu",
          major: "Computer Science",
          yearInProgram: "3",
          graduationDate: "Spring 2027",
          gpaMajor: "3.9",
          gpaOverall: "3.8",
          previousServiceAsUla: "0",
        },
        tentativeAssignment: null,
        rankings: { 40: null },
        preferences: { 40: "Would Consider" },
      },
    ],
    version: 1,
  },
  empty: {
    recruitmentId: 7,
    type: "TA",
    identityHeaders: taIdentityHeaders,
    courses: [],
    rows: [],
    version: 1,
  },
  /**
   * Issue #355: the lectures of the issue's example, two sections each of CMPSC 8 and CMPSC 190DD,
   * so the labels show their alignment ("  5A", "  8   (0100)", " 16", "130A", "190DD (0200)").
   */
  taPageManyCourses: {
    recruitmentId: 7,
    type: "TA",
    identityHeaders: taIdentityHeaders,
    courses: [
      ["CMPSC    5A", "0100", 1, 1, 0],
      ["CMPSC    5B", "0100", 1, 0, 1],
      ["CMPSC     8", "0100", 2, 1, 1],
      ["CMPSC     8", "0200", 2, 0, 2],
      ["CMPSC    16", "0100", 1, 2, -1],
      ["CMPSC   130A", "0100", 1, 0, 1],
      ["CMPSC   130B", "0100", 1, 0, 1],
      ["CMPSC  190DD", "0100", 1, 0, 1],
      ["CMPSC  190DD", "0200", 1, 0, 1],
    ].map(([courseId, section, allocation, assigned, left], i) => ({
      id: 101 + i,
      courseId,
      section,
      enrollCode: String(7000 + i),
      allocation,
      assigned,
      left,
      historical: false,
    })),
    rows: [
      { ...taRows[0], tentativeAssignment: 101, rankings: { 101: 1, 103: 2 } },
      { ...taRows[1], tentativeAssignment: 105, rankings: { 105: 1 } },
      { ...taRows[2], tentativeAssignment: 105, rankings: { 103: 1, 109: 1 } },
      { ...taRows[3], tentativeAssignment: 103, rankings: {} },
    ],
    version: 5,
  },
};

export default assignmentsFixtures;
