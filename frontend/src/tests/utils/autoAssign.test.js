import assignmentsFixtures from "fixtures/assignmentsFixtures";
import autoAssignFixtures from "fixtures/autoAssignFixtures";
import {
  PREVIEW_LABEL,
  PROPOSE_LABEL,
  applicantNames,
  deadlinePending,
  lectureNames,
  madeCountText,
  needingWithoutRankings,
  notMadeReason,
  notMadeSentence,
  notProposedRows,
  proposeConditions,
  proposeTooltip,
  proposedRows,
  skippedReason,
} from "main/utils/autoAssign";

describe("autoAssign utilities (issues #481 and #515)", () => {
  const page = assignmentsFixtures.taPage;
  const lecture = lectureNames(page.courses);
  const applicant = applicantNames(page.rows);

  test("the row's label and the button's", () => {
    expect(PROPOSE_LABEL).toBe("Propose assignments:");
    expect(PREVIEW_LABEL).toBe("Preview");
  });

  test("proposeConditions: two for a ULA recruitment, and the PhD rule for a TA one (issue #488)", () => {
    expect(proposeConditions("ULA")).toEqual([
      "is enthusiastic about the course",
      "is wanted by no other lecture that still has places",
    ]);
    expect(proposeConditions("TA")).toEqual([
      "is enthusiastic about the course",
      "is wanted by no other lecture that still has places",
      "is a PhD student in Computer Science (MS students and other majors are always assigned by hand)",
    ]);
  });

  test("proposeTooltip: the conditions in one sentence, built from the list so the two cannot drift", () => {
    expect(proposeTooltip("ULA")).toBe(
      "Propose assignments to courses where there is one clear choice: the top-ranked unassigned candidate is enthusiastic about the course and is wanted by no other lecture that still has places. All proposed assignments are shown first and you can control which ones are made.",
    );
    expect(proposeTooltip("TA")).toBe(
      "Propose assignments to courses where there is one clear choice: the top-ranked unassigned candidate is enthusiastic about the course and is wanted by no other lecture that still has places, and is a PhD student in Computer Science (MS students and other majors are always assigned by hand). All proposed assignments are shown first and you can control which ones are made.",
    );
  });

  test("needingWithoutRankings: lectures with places left that nobody has ranked anyone for", () => {
    // CMPSC 8 (left 1) has rankings; CMPSC 16 is over-assigned; CMPSC 24 is historical.
    expect(needingWithoutRankings(page)).toEqual([]);
    const unranked = {
      courses: [
        { ...page.courses[0], id: 50, left: 2 },
        { ...page.courses[0], id: 60, left: 1 },
        { ...page.courses[0], id: 70, left: 0 },
        { ...page.courses[0], id: 80, left: 1, historical: true },
      ],
      rows: [
        { ...page.rows[0], rankings: { 60: null } },
        { ...page.rows[1], rankings: {} },
      ],
    };
    // A cleared rank (null) is no ranking; 70 needs nobody and 80 is no longer offered.
    expect(needingWithoutRankings(unranked).map((c) => c.id)).toEqual([50, 60]);
    expect(
      needingWithoutRankings({
        ...unranked,
        rows: [{ ...page.rows[0], rankings: { 60: 3 } }],
      }).map((c) => c.id),
    ).toEqual([50]);
  });

  test("deadlinePending: unset, today or later is pending; earlier is not", () => {
    expect(deadlinePending(null, "2026-11-24")).toBe(true);
    expect(deadlinePending(undefined, "2026-11-24")).toBe(true);
    expect(deadlinePending("2026-11-24", "2026-11-24")).toBe(true);
    expect(deadlinePending("2026-11-25", "2026-11-24")).toBe(true);
    expect(deadlinePending("2026-11-23", "2026-11-24")).toBe(false);
  });

  test("lectureNames: the table's labels with the aligning spaces collapsed, or the id", () => {
    expect(lecture(10)).toBe("8");
    expect(lecture(20)).toBe("16");
    expect(lecture(99)).toBe("lecture 99");
    const twoSections = lectureNames([
      { ...page.courses[0], id: 1, section: "0100" },
      { ...page.courses[0], id: 2, section: "0200" },
    ]);
    expect(twoSections(1)).toBe("8 (0100)");
    expect(twoSections(2)).toBe("8 (0200)");
  });

  test("applicantNames: first and last name, else the email, else the id", () => {
    expect(applicant(1)).toBe("Ada Lovelace");
    expect(applicant(4)).toBe("blank@ucsb.edu");
    expect(applicant(99)).toBe("applicant 99");
    const partial = applicantNames([
      { applicationId: 5, identity: { firstName: "Cher", lastName: "" } },
      { applicationId: 6, identity: { lastName: "Prince" } },
      {
        applicationId: 7,
        identity: { firstName: "", lastName: "", email: "" },
      },
    ]);
    expect(partial(5)).toBe("Cher");
    expect(partial(6)).toBe("Prince");
    expect(partial(7)).toBe("applicant 7");
  });

  test("proposedRows: the page's words for each proposal, reading preference, class level and major off its rows", () => {
    expect(proposedRows(autoAssignFixtures.preview.made, page)).toEqual([
      {
        applicationId: 1,
        recruitmentCourseId: 10,
        applicant: "Ada Lovelace",
        lecture: "8",
        rank: 1,
        preference: "1st Choice",
        pass: 1,
        classLevel: "PHD",
        major: "Computer Science",
      },
      {
        applicationId: 4,
        recruitmentCourseId: 30,
        applicant: "blank@ucsb.edu",
        lecture: "24",
        rank: 2,
        // The nameless applicant marked no interest and gave no class level or major.
        preference: "",
        pass: 2,
        classLevel: "",
        major: "",
      },
    ]);
    // An applicant no longer on the page, to a lecture no longer on it: nothing to read.
    expect(
      proposedRows(
        [{ applicationId: 99, recruitmentCourseId: 98, rank: 3, pass: 1 }],
        page,
      ),
    ).toEqual([
      {
        applicationId: 99,
        recruitmentCourseId: 98,
        applicant: "applicant 99",
        lecture: "lecture 98",
        rank: 3,
        preference: "",
        pass: 1,
        classLevel: "",
        major: "",
      },
    ]);
  });

  test("skippedReason: one sentence per reason, without the lecture's name", () => {
    const reason = (fields) =>
      skippedReason({
        recruitmentCourseId: 10,
        applicationId: null,
        rank: null,
        blockedBy: [],
        ...fields,
      });
    expect(reason({ reason: "NO_RANKINGS" })).toBe("No rankings yet.");
    expect(reason({ reason: "ALL_RANKED_ASSIGNED" })).toBe(
      "Every candidate it ranked is already assigned.",
    );
    expect(reason({ reason: "TIE", rank: 2 })).toBe(
      "Two or more remaining candidates share its top rank (2).",
    );
    expect(
      reason({ reason: "NOT_ENTHUSIASTIC", applicationId: 2, rank: 3 }),
    ).toBe("Its top remaining candidate is not enthusiastic about it.");
    expect(
      reason({
        reason: "RANKED_ELSEWHERE",
        applicationId: 3,
        rank: 1,
        blockedBy: [20],
      }),
    ).toBe(
      "Its top remaining candidate is also ranked by another lecture that still has places.",
    );
    // Issue #488: the two manual-only reasons.
    expect(reason({ reason: "NOT_PHD", applicationId: 2, rank: 1 })).toBe(
      "Its top remaining candidate is an MS student, so is assigned by hand only.",
    );
    expect(reason({ reason: "NOT_CS_MAJOR", applicationId: 3, rank: 1 })).toBe(
      "Its top remaining candidate is not a Computer Science major, so is assigned by hand only.",
    );
  });

  test("notProposedRows: lecture, places left, reason, the candidate with their rank, and who else ranks them", () => {
    expect(notProposedRows(autoAssignFixtures.preview.skipped, page)).toEqual([
      {
        recruitmentCourseId: 20,
        lecture: "16",
        left: -1,
        reason:
          "Its top remaining candidate is also ranked by another lecture that still has places.",
        candidate: "Alan Turing (ranked 1)",
        alsoRankedBy: "8, 24",
      },
    ]);
    expect(
      notProposedRows(autoAssignFixtures.previewNothing.skipped, page),
    ).toEqual([
      {
        recruitmentCourseId: 10,
        lecture: "8",
        left: 1,
        reason: "Its top remaining candidate is not enthusiastic about it.",
        candidate: "Grace Hopper (ranked 2)",
        alsoRankedBy: "",
      },
      {
        recruitmentCourseId: 20,
        lecture: "16",
        left: -1,
        reason: "Two or more remaining candidates share its top rank (1).",
        candidate: "",
        alsoRankedBy: "",
      },
      {
        recruitmentCourseId: 30,
        lecture: "24",
        left: 0,
        reason: "No rankings yet.",
        candidate: "",
        alsoRankedBy: "",
      },
      {
        // A lecture no longer on the page: named by its id, with no places count.
        recruitmentCourseId: 99,
        lecture: "lecture 99",
        left: null,
        reason: "Every candidate it ranked is already assigned.",
        candidate: "",
        alsoRankedBy: "",
      },
    ]);
  });

  test("madeCountText: singular, plural, and none", () => {
    expect(madeCountText(0)).toBe("No assignments were made.");
    expect(madeCountText(1)).toBe("1 assignment made.");
    expect(madeCountText(2)).toBe("2 assignments made.");
  });

  test("notMadeReason and notMadeSentence: why a checked proposal was not made", () => {
    expect(notMadeReason("ALREADY_ASSIGNED")).toBe(
      "already assigned meanwhile",
    );
    expect(notMadeReason("LECTURE_GONE")).toBe(
      "the lecture is no longer on offer",
    );
    expect(notMadeReason("APPLICANT_GONE")).toBe(
      "the application is no longer in this recruitment",
    );
    const sentence = (notMade) => notMadeSentence(notMade, lecture, applicant);
    expect(
      autoAssignFixtures.appliedPartly.notMade.map((n) => sentence(n)),
    ).toEqual([
      "blank@ucsb.edu to 24: already assigned meanwhile.",
      "Grace Hopper to 16: the lecture is no longer on offer.",
      "applicant 99 to 8: the application is no longer in this recruitment.",
    ]);
  });
});
