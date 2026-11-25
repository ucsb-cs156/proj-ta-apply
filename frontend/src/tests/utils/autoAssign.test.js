import assignmentsFixtures from "fixtures/assignmentsFixtures";
import {
  AUTO_ASSIGN_LABEL,
  applicantNames,
  deadlinePending,
  lectureNames,
  madeSentence,
  needingWithoutRankings,
  skippedSentence,
} from "main/utils/autoAssign";

describe("autoAssign utilities (issue #481)", () => {
  const page = assignmentsFixtures.taPage;
  const lecture = lectureNames(page.courses);
  const applicant = applicantNames(page.rows);

  test("the button's label", () => {
    expect(AUTO_ASSIGN_LABEL).toBe("Automatically Assign No-Conflict Slots");
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

  test("madeSentence names the applicant, the lecture, the rank and the pass", () => {
    expect(
      madeSentence(
        { applicationId: 1, recruitmentCourseId: 10, rank: 1, pass: 2 },
        lecture,
        applicant,
      ),
    ).toBe("Ada Lovelace to 8, ranked 1 (pass 2)");
  });

  test("skippedSentence: one sentence per reason", () => {
    const sentence = (skipped) => skippedSentence(skipped, lecture, applicant);
    expect(
      sentence({
        recruitmentCourseId: 10,
        reason: "NO_RANKINGS",
        applicationId: null,
        rank: null,
        blockedBy: [],
      }),
    ).toBe("8: no rankings yet.");
    expect(
      sentence({
        recruitmentCourseId: 20,
        reason: "ALL_RANKED_ASSIGNED",
        applicationId: null,
        rank: null,
        blockedBy: [],
      }),
    ).toBe("16: every candidate it ranked is already assigned.");
    expect(
      sentence({
        recruitmentCourseId: 20,
        reason: "TIE",
        applicationId: null,
        rank: 2,
        blockedBy: [],
      }),
    ).toBe("16: two or more remaining candidates share its top rank (2).");
    expect(
      sentence({
        recruitmentCourseId: 10,
        reason: "NOT_ENTHUSIASTIC",
        applicationId: 2,
        rank: 3,
        blockedBy: [],
      }),
    ).toBe(
      "8: its top remaining candidate, Grace Hopper (ranked 3), is not enthusiastic about it.",
    );
    expect(
      sentence({
        recruitmentCourseId: 10,
        reason: "RANKED_ELSEWHERE",
        applicationId: 3,
        rank: 1,
        blockedBy: [20],
      }),
    ).toBe(
      "8: its top remaining candidate, Alan Turing (ranked 1), is also ranked by 16.",
    );
    expect(
      sentence({
        recruitmentCourseId: 10,
        reason: "RANKED_ELSEWHERE",
        applicationId: 3,
        rank: 1,
        blockedBy: [20, 30],
      }),
    ).toBe(
      "8: its top remaining candidate, Alan Turing (ranked 1), is also ranked by 16 and 24.",
    );
  });
});
