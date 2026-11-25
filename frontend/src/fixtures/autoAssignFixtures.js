import assignmentsFixtures from "fixtures/assignmentsFixtures";

// POST /api/admin/assignments/auto (issue #481): what a run of Automatically Assign No-Conflict
// Slots answers, built on the TA page of assignmentsFixtures (lectures 10 = CMPSC 8, 20 = CMPSC 16,
// 30 = CMPSC 24; applicants 1 Ada, 2 Grace, 3 Alan, 4 nameless).
const autoAssignFixtures = {
  /** Ada went to CMPSC 8 in pass 1 and the nameless applicant to CMPSC 24 in pass 2. */
  twoMade: {
    assignments: assignmentsFixtures.taPageAfterMove,
    made: [
      { applicationId: 1, recruitmentCourseId: 10, rank: 1, pass: 1 },
      { applicationId: 4, recruitmentCourseId: 30, rank: 2, pass: 2 },
    ],
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
  /** Nothing qualified: each unfilled lecture with a different reason. */
  nothingMade: {
    assignments: assignmentsFixtures.taPage,
    made: [],
    skipped: [
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
    ],
  },
  /** One assignment and every lecture now filled. */
  oneMadeAllFilled: {
    assignments: assignmentsFixtures.taPageAfterMove,
    made: [{ applicationId: 1, recruitmentCourseId: 10, rank: 1, pass: 1 }],
    skipped: [],
  },
  /** The answer to undoing twoMade. */
  undone: {
    assignments: assignmentsFixtures.taPage,
    cleared: 2,
  },
};

export default autoAssignFixtures;
