import assignmentsFixtures from "fixtures/assignmentsFixtures";

// Propose assignments (issue #515, the rule of #481): what GET /api/admin/assignments/auto/preview
// and POST /api/admin/assignments/auto/apply answer, built on the TA page of assignmentsFixtures
// (lectures 10 = CMPSC 8, 20 = CMPSC 16, 30 = CMPSC 24; applicants 1 Ada, 2 Grace, 3 Alan, 4
// nameless).

const adaToEight = {
  applicationId: 1,
  recruitmentCourseId: 10,
  rank: 1,
  pass: 1,
};
const namelessToTwentyFour = {
  applicationId: 4,
  recruitmentCourseId: 30,
  rank: 2,
  pass: 2,
};

/** Nothing qualified: each unfilled lecture with a different reason. */
const nothingSkipped = [
  {
    recruitmentCourseId: 10,
    reason: "NOT_ENTHUSIASTIC",
    applicationId: 2,
    rank: 2,
    blockedBy: [],
  },
  {
    recruitmentCourseId: 20,
    reason: "TIE",
    applicationId: null,
    rank: 1,
    blockedBy: [],
  },
  {
    recruitmentCourseId: 30,
    reason: "NO_RANKINGS",
    applicationId: null,
    rank: null,
    blockedBy: [],
  },
  {
    recruitmentCourseId: 99,
    reason: "ALL_RANKED_ASSIGNED",
    applicationId: null,
    rank: null,
    blockedBy: [],
  },
];

// ---- a richer page for the stories: every pass and every reason at once ----

const taIdentityHeaders = assignmentsFixtures.taPage.identityHeaders;

const storyCourse = (id, courseId, left) => ({
  id,
  courseId,
  section: "0100",
  enrollCode: String(7000 + id),
  allocation: left,
  assigned: 0,
  left,
  historical: false,
});

const storyRow = (
  applicationId,
  firstName,
  lastName,
  classLevel,
  major,
  rankings,
  preferences,
) => ({
  applicationId,
  identity: {
    firstName,
    lastName,
    email: `${firstName.toLowerCase() || "blank"}@ucsb.edu`,
    major,
    classLevel,
    yearInProgram: "2",
    graduationDate: "Spring 2028",
  },
  tentativeAssignment: null,
  rankings,
  preferences,
});

/** Twelve lectures with places to fill, nine applicants, none assigned yet. */
const storyPage = {
  recruitmentId: 7,
  type: "TA",
  identityHeaders: taIdentityHeaders,
  courses: [
    storyCourse(10, "CMPSC     8", 1),
    storyCourse(20, "CMPSC    16", 1),
    storyCourse(30, "CMPSC    24", 1),
    storyCourse(40, "CMPSC   130A", 1),
    storyCourse(50, "CMPSC   130B", 1),
    storyCourse(60, "CMPSC   156", 1),
    storyCourse(70, "CMPSC   160", 1),
    storyCourse(80, "CMPSC   170", 1),
    storyCourse(90, "CMPSC   180", 2),
    storyCourse(100, "CMPSC  190DD", 1),
    storyCourse(110, "CMPSC    64", 1),
    storyCourse(120, "CMPSC    32", 1),
  ],
  rows: [
    storyRow(
      1,
      "Ada",
      "Lovelace",
      "PHD",
      "Computer Science",
      { 10: 1 },
      {
        10: "1st Choice",
      },
    ),
    storyRow(
      2,
      "Grace",
      "Hopper",
      "MS",
      "Computer Engineering",
      { 60: 1, 110: 1 },
      { 60: "Would Consider", 110: "1st Choice" },
    ),
    storyRow(
      3,
      "Alan",
      "Turing",
      "PHD",
      "Computer Science",
      { 30: 1 },
      {
        30: "2nd Choice",
      },
    ),
    storyRow(
      4,
      "",
      "",
      "PHD",
      "Computer Science (CS)",
      { 20: 2, 10: 2 },
      {
        20: "Enthusiastic",
      },
    ),
    storyRow(
      5,
      "Edsger",
      "Dijkstra",
      "PHD",
      "Computer Science",
      { 40: 1, 20: 1 },
      { 40: "Enthusiastic", 20: "1st Choice" },
    ),
    storyRow(
      6,
      "Barbara",
      "Liskov",
      "PHD",
      "Electrical Engineering",
      { 120: 1 },
      { 120: "1st Choice" },
    ),
    storyRow(
      7,
      "Donald",
      "Knuth",
      "PHD",
      "Computer Science",
      { 50: 1 },
      {
        50: "1st Choice",
      },
    ),
    storyRow(
      8,
      "Tony",
      "Hoare",
      "PHD",
      "Computer Science",
      { 50: 1 },
      {
        50: "1st Choice",
      },
    ),
    storyRow(
      9,
      "Ken",
      "Thompson",
      "PHD",
      "Computer Science",
      { 70: 1, 80: 1 },
      { 70: "1st Choice", 80: "Enthusiastic" },
    ),
  ],
  version: 9,
};

/** Four proposals over three passes, and a lecture left for every reason there is. */
const storyPreview = {
  version: 9,
  made: [
    { applicationId: 1, recruitmentCourseId: 10, rank: 1, pass: 1 },
    { applicationId: 3, recruitmentCourseId: 30, rank: 1, pass: 1 },
    { applicationId: 5, recruitmentCourseId: 20, rank: 1, pass: 2 },
    { applicationId: 4, recruitmentCourseId: 40, rank: 2, pass: 3 },
  ],
  skipped: [
    {
      recruitmentCourseId: 50,
      reason: "TIE",
      applicationId: null,
      rank: 1,
      blockedBy: [],
    },
    {
      recruitmentCourseId: 60,
      reason: "NOT_ENTHUSIASTIC",
      applicationId: 2,
      rank: 1,
      blockedBy: [],
    },
    {
      recruitmentCourseId: 70,
      reason: "RANKED_ELSEWHERE",
      applicationId: 9,
      rank: 1,
      blockedBy: [80],
    },
    {
      recruitmentCourseId: 80,
      reason: "RANKED_ELSEWHERE",
      applicationId: 9,
      rank: 1,
      blockedBy: [70],
    },
    {
      recruitmentCourseId: 90,
      reason: "NO_RANKINGS",
      applicationId: null,
      rank: null,
      blockedBy: [],
    },
    {
      recruitmentCourseId: 100,
      reason: "ALL_RANKED_ASSIGNED",
      applicationId: null,
      rank: null,
      blockedBy: [],
    },
    {
      recruitmentCourseId: 110,
      reason: "NOT_PHD",
      applicationId: 2,
      rank: 1,
      blockedBy: [],
    },
    {
      recruitmentCourseId: 120,
      reason: "NOT_CS_MAJOR",
      applicationId: 6,
      rank: 1,
      blockedBy: [],
    },
  ],
};

const autoAssignFixtures = {
  /** Ada to CMPSC 8 in pass 1 and the nameless applicant to CMPSC 24 in pass 2; CMPSC 16 blocked. */
  preview: {
    version: 3,
    made: [adaToEight, namelessToTwentyFour],
    skipped: [
      {
        recruitmentCourseId: 20,
        reason: "RANKED_ELSEWHERE",
        applicationId: 3,
        rank: 1,
        blockedBy: [10, 30],
      },
    ],
  },
  /** Nothing can be proposed: each unfilled lecture with a different reason. */
  previewNothing: { version: 3, made: [], skipped: nothingSkipped },
  /**
   * Issue #488: a TA preview where nothing qualified because the top candidates may only be
   * assigned by hand: Grace (MS) tops CMPSC 8 and Alan (PhD, not CS) tops CMPSC 16.
   */
  previewManualOnly: {
    version: 3,
    made: [],
    skipped: [
      {
        recruitmentCourseId: 10,
        reason: "NOT_PHD",
        applicationId: 2,
        rank: 1,
        blockedBy: [],
      },
      {
        recruitmentCourseId: 20,
        reason: "NOT_CS_MAJOR",
        applicationId: 3,
        rank: 1,
        blockedBy: [],
      },
    ],
  },
  /** One proposal and every lecture would then be filled. */
  previewAllFilled: { version: 3, made: [adaToEight], skipped: [] },
  /** Both proposals of `preview` made. */
  applied: {
    assignments: assignmentsFixtures.taPageAfterMove,
    made: [adaToEight, namelessToTwentyFour],
    notMade: [],
  },
  /** Only Ada's proposal was checked and made. */
  appliedOne: {
    assignments: assignmentsFixtures.taPageAfterMove,
    made: [adaToEight],
    notMade: [],
  },
  /** Ada's was made; the others had stopped holding by the time Proceed was clicked. */
  appliedPartly: {
    assignments: assignmentsFixtures.taPageAfterMove,
    made: [adaToEight],
    notMade: [
      { assignment: namelessToTwentyFour, reason: "ALREADY_ASSIGNED" },
      {
        assignment: {
          applicationId: 2,
          recruitmentCourseId: 20,
          rank: 1,
          pass: 1,
        },
        reason: "LECTURE_GONE",
      },
      {
        assignment: {
          applicationId: 99,
          recruitmentCourseId: 10,
          rank: 3,
          pass: 2,
        },
        reason: "APPLICANT_GONE",
      },
    ],
  },
  /** Nothing selected still held. */
  appliedNone: {
    assignments: assignmentsFixtures.taPage,
    made: [],
    notMade: [{ assignment: adaToEight, reason: "ALREADY_ASSIGNED" }],
  },
  /** The answer to undoing `applied`. */
  undone: {
    assignments: assignmentsFixtures.taPage,
    cleared: 2,
  },
  storyPage,
  storyPreview,
};

export default autoAssignFixtures;
