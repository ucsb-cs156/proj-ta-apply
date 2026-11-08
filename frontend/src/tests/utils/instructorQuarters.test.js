import {
  ALLOCATION_NA,
  ALLOCATION_TBD,
  allocationCell,
  enrollmentColumns,
  estimateCell,
  FEEDBACK_PLACEHOLDER,
  groupByQuarter,
  isReleased,
  NOT_OPEN_NOTE,
} from "main/utils/instructorQuarters";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";

const { nothingReleased, taReleased, ulaReleased, bothReleased } =
  instructorRecruitmentsFixtures.quarters;
const [s26Ta, w26Ta, w26Ula] = nothingReleased;

describe("instructorQuarters tests", () => {
  test("the texts are as the issue words them", () => {
    expect(FEEDBACK_PLACEHOLDER).toBe(
      "Coming soon: the ability for faculty to provide feedback on allocations of TA/ULAs to their courses",
    );
    expect(NOT_OPEN_NOTE).toBe(
      "Candidate rankings will be available when faculty reviews open.",
    );
    expect(ALLOCATION_TBD).toBe("TBD");
    expect(ALLOCATION_NA).toBe("N/A");
  });

  describe("estimateCell (issue #410)", () => {
    test("TBD until the allocations of either recruitment the course is in are released", () => {
      const [, w26] = groupByQuarter(nothingReleased);
      expect(w26.courses.map(estimateCell)).toEqual(["TBD", "TBD", "TBD"]);
      // Even if a withheld row carried an estimate.
      expect(estimateCell({ ...w26.courses[2], enrollmentEstimate: 99 })).toBe(
        "TBD",
      );
      // A course in no recruitment at all (not something groupByQuarter makes) is TBD too.
      expect(
        estimateCell({ ...w26.courses[2], ta: undefined, ula: undefined }),
      ).toBe("TBD");
    });

    test("the number once either side is released; blank, not null, when there is none", () => {
      expect(groupByQuarter(taReleased)[1].courses.map(estimateCell)).toEqual([
        "TBD",
        "70",
        "130",
      ]);
      expect(groupByQuarter(ulaReleased)[1].courses.map(estimateCell)).toEqual([
        "220",
        "TBD",
        "130",
      ]);
      expect(groupByQuarter(bothReleased)[1].courses.map(estimateCell)).toEqual(
        ["220", "70", "130"],
      );
      const [, w26] = groupByQuarter(bothReleased);
      expect(estimateCell({ ...w26.courses[2], enrollmentEstimate: 0 })).toBe(
        "0",
      );
      expect(
        estimateCell({ ...w26.courses[2], enrollmentEstimate: null }),
      ).toBe("");
      expect(
        estimateCell({ ...w26.courses[2], enrollmentEstimate: undefined }),
      ).toBe("");
      // Released on the ULA side only, with the TA side unreleased: still the number.
      const [, taOnly] = groupByQuarter(ulaReleased);
      expect(estimateCell({ ...taOnly.courses[2], ula: undefined })).toBe(
        "TBD",
      );
      expect(estimateCell({ ...taOnly.courses[2], ta: undefined })).toBe("130");
    });
  });

  describe("allocationCell (issue #410)", () => {
    test("N/A when the course is in no recruitment of that type", () => {
      expect(allocationCell(undefined)).toBe("N/A");
    });

    test("TBD while the recruitment's allocations are withheld, whatever the row says", () => {
      const [, w26Ta] = nothingReleased;
      expect(
        allocationCell({ recruitment: w26Ta, course: w26Ta.courses[0] }),
      ).toBe("TBD");
      expect(
        allocationCell({
          recruitment: { ...w26Ta, allocationsReleased: false },
          course: { ...w26Ta.courses[0], allocation: 2 },
        }),
      ).toBe("TBD");
      const absent = { ...w26Ta };
      delete absent.allocationsReleased;
      expect(
        allocationCell({ recruitment: absent, course: w26Ta.courses[0] }),
      ).toBe("TBD");
    });

    test("the number once released; blank, not null, when there is none", () => {
      const [, ta, ula] = bothReleased;
      expect(allocationCell({ recruitment: ta, course: ta.courses[0] })).toBe(
        "2",
      );
      expect(allocationCell({ recruitment: ta, course: ta.courses[1] })).toBe(
        "3",
      );
      expect(allocationCell({ recruitment: ula, course: ula.courses[0] })).toBe(
        "1",
      );
      expect(
        allocationCell({
          recruitment: ta,
          course: { ...ta.courses[0], allocation: 0 },
        }),
      ).toBe("0");
      expect(
        allocationCell({
          recruitment: ta,
          course: { ...ta.courses[0], allocation: null },
        }),
      ).toBe("");
      expect(
        allocationCell({
          recruitment: ta,
          course: { ...ta.courses[0], allocation: undefined },
        }),
      ).toBe("");
    });
  });

  test("isReleased is the backend's flag, and false when it is absent", () => {
    expect(isReleased({ allocationsReleased: true })).toBe(true);
    expect(isReleased({ allocationsReleased: false })).toBe(false);
    expect(isReleased({})).toBe(false);
  });

  describe("groupByQuarter", () => {
    test("groups by quarter, newest first, with the recruitments in their slots", () => {
      const quarters = groupByQuarter(nothingReleased);

      expect(quarters.map((q) => q.quarter)).toEqual(["20262", "20261"]);
      expect(quarters[0].ta).toBe(s26Ta);
      expect(quarters[0].ula).toBeUndefined();
      expect(quarters[1].ta).toBe(w26Ta);
      expect(quarters[1].ula).toBe(w26Ula);
    });

    test("a sectionless lecture sorts before its sectioned one, whichever came first", () => {
      const [w26] = groupByQuarter([
        { ...w26Ta, courses: [w26Ta.courses[1], w26Ta.courses[0]] },
      ]);
      expect(w26.courses.map((c) => [c.id, c.section])).toEqual([
        [3, null],
        [2, "0100"],
      ]);
    });

    test("the order the recruitments come in does not matter", () => {
      const quarters = groupByQuarter([w26Ula, s26Ta, w26Ta]);

      expect(quarters.map((q) => q.quarter)).toEqual(["20262", "20261"]);
      expect(quarters[1].ta).toBe(w26Ta);
      expect(quarters[1].ula).toBe(w26Ula);
      // The shared section is still named by its TA row, and keeps both rows.
      const shared = quarters[1].courses.find(
        (c) => c.section === "0100" && c.courseId === "CMPSC   156",
      );
      expect(shared.id).toBe(2);
      expect(shared.ta.course.id).toBe(2);
      expect(shared.ula.course.id).toBe(5);
    });

    test("courses are merged across the quarter's recruitments and sorted by course then section", () => {
      const [, w26] = groupByQuarter(nothingReleased);

      expect(
        w26.courses.map((c) => [c.id, c.courseId, c.section, c.title]),
      ).toEqual([
        [1, "CMPSC     1A", "0100", "Introduction to Computer Programming"],
        [3, "CMPSC   156", null, null],
        [2, "CMPSC   156", "0100", "Advanced Applications Programming"],
      ]);
      const [oneA, sectionless, shared] = w26.courses;
      expect(oneA.ta).toBeUndefined();
      expect(oneA.ula).toEqual({
        recruitment: w26Ula,
        course: w26Ula.courses[1],
      });
      expect(sectionless.ta).toEqual({
        recruitment: w26Ta,
        course: w26Ta.courses[1],
      });
      expect(sectionless.ula).toBeUndefined();
      expect(shared.ta).toEqual({
        recruitment: w26Ta,
        course: w26Ta.courses[0],
      });
      expect(shared.ula).toEqual({
        recruitment: w26Ula,
        course: w26Ula.courses[0],
      });
      // The enrollment figures are the row's.
      expect(shared.enrollment).toBe(120);
      expect(shared.maxEnroll).toBe(150);
      expect(oneA.enrollment).toBe(200);
      expect(oneA.maxEnroll).toBe(250);
    });

    test("the estimate comes from whichever row carries it; null when neither does", () => {
      expect(
        groupByQuarter(nothingReleased)[1].courses[2].enrollmentEstimate,
      ).toBeNull();
      expect(groupByQuarter(taReleased)[1].courses[2].enrollmentEstimate).toBe(
        130,
      );
      expect(groupByQuarter(ulaReleased)[1].courses[2].enrollmentEstimate).toBe(
        130,
      );
      expect(
        groupByQuarter(bothReleased)[1].courses[2].enrollmentEstimate,
      ).toBe(130);
      expect(groupByQuarter(ulaReleased)[1].courses[0].enrollmentEstimate).toBe(
        220,
      );
      expect(
        groupByQuarter(ulaReleased)[1].courses[1].enrollmentEstimate,
      ).toBeNull();
      // The first row to carry it wins, and a row without the field counts as null.
      const [, ta, ula] = bothReleased;
      const taFirst = groupByQuarter([
        { ...ta, courses: [{ ...ta.courses[0], enrollmentEstimate: 111 }] },
        { ...ula, courses: [{ ...ula.courses[0], enrollmentEstimate: 222 }] },
      ]);
      expect(taFirst[0].courses[0].enrollmentEstimate).toBe(111);
      const absent = { ...ta.courses[0] };
      delete absent.enrollmentEstimate;
      expect(
        groupByQuarter([{ ...ta, courses: [absent] }])[0].courses[0]
          .enrollmentEstimate,
      ).toBeNull();
    });

    test("a quarter with no course does not appear; odd input is empty", () => {
      expect(groupByQuarter(undefined)).toEqual([]);
      expect(groupByQuarter(null)).toEqual([]);
      expect(groupByQuarter("nonsense")).toEqual([]);
      expect(groupByQuarter([])).toEqual([]);
      expect(groupByQuarter([{ ...s26Ta, courses: [] }])).toEqual([]);
      expect(groupByQuarter([{ ...s26Ta, courses: undefined }])).toEqual([]);
      const quarters = groupByQuarter([
        { ...w26Ta, courses: undefined },
        w26Ula,
      ]);
      expect(quarters).toHaveLength(1);
      expect(quarters[0].ta).toEqual({ ...w26Ta, courses: undefined });
      expect(quarters[0].courses.map((c) => c.id)).toEqual([1, 5]);
    });
  });

  describe("enrollmentColumns", () => {
    const columns = (fixture, index = 2) =>
      enrollmentColumns(groupByQuarter(fixture)[1].courses[index], "P");

    const SIX = [
      "Section",
      "Enrolled",
      "Max",
      "Enrollment Estimate",
      "TA Allocation",
      "ULA Allocation",
    ];

    test("all six columns while nothing is released: the estimate and both allocations TBD (issue #410)", () => {
      expect(columns(nothingReleased)).toEqual([
        { label: "Section", value: "0100", text: "0100", testId: "P-section" },
        { label: "Enrolled", value: "120", text: "120", testId: "P-enrolled" },
        { label: "Max", value: "150", text: "150", testId: "P-max" },
        {
          label: "Enrollment Estimate",
          value: "TBD",
          text: "TBD",
          testId: "P-enrollment-estimate",
        },
        {
          label: "TA Allocation",
          value: "TBD",
          text: "TBD",
          testId: "P-ta-allocation",
        },
        {
          label: "ULA Allocation",
          value: "TBD",
          text: "TBD",
          testId: "P-ula-allocation",
        },
      ]);
      // A sectionless lecture with no figures: blanks, not nulls; it is in the TA recruitment
      // alone, so N/A on the ULA side.
      const [w26] = groupByQuarter([
        {
          ...w26Ta,
          courses: [{ ...w26Ta.courses[1], enrollment: null, maxEnroll: null }],
        },
      ]);
      expect(
        enrollmentColumns(w26.courses[0], "P").map((c) => c.value),
      ).toEqual(["", "", "", "TBD", "TBD", "N/A"]);
      // CMPSC 1A is in the ULA recruitment alone: N/A on the TA side.
      expect(columns(nothingReleased, 0).map((c) => c.value)).toEqual([
        "0100",
        "200",
        "250",
        "TBD",
        "N/A",
        "TBD",
      ]);
      // A row that carries an estimate while withheld (not what the backend does) still reads TBD.
      const [withEstimate] = groupByQuarter([
        {
          ...w26Ta,
          courses: [{ ...w26Ta.courses[0], enrollmentEstimate: 130 }],
        },
      ]);
      expect(enrollmentColumns(withEstimate.courses[0], "P")[3].value).toBe(
        "TBD",
      );
    });

    test("the estimate becomes a number once either side is released; the released side shows its number", () => {
      expect(columns(taReleased).map((c) => c.label)).toEqual(SIX);
      expect(columns(taReleased).slice(3)).toEqual([
        {
          label: "Enrollment Estimate",
          value: "130",
          text: "130",
          testId: "P-enrollment-estimate",
        },
        {
          label: "TA Allocation",
          value: "2",
          text: "2",
          testId: "P-ta-allocation",
        },
        {
          label: "ULA Allocation",
          value: "TBD",
          text: "TBD",
          testId: "P-ula-allocation",
        },
      ]);
      expect(columns(ulaReleased).map((c) => c.label)).toEqual(SIX);
      expect(columns(ulaReleased).slice(4)).toEqual([
        {
          label: "TA Allocation",
          value: "TBD",
          text: "TBD",
          testId: "P-ta-allocation",
        },
        {
          label: "ULA Allocation",
          value: "1",
          text: "1",
          testId: "P-ula-allocation",
        },
      ]);
      expect(columns(bothReleased).map((c) => c.label)).toEqual(SIX);
      expect(columns(bothReleased).map((c) => c.value)).toEqual([
        "0100",
        "120",
        "150",
        "130",
        "2",
        "1",
      ]);
    });

    test("a release counts only for the recruitments the course is in; the other side is N/A", () => {
      // CMPSC 1A is only in the ULA recruitment; the sectionless lecture only in the TA one.
      expect(columns(taReleased, 0).map((c) => c.label)).toEqual(SIX);
      expect(
        columns(taReleased, 0)
          .map((c) => c.value)
          .slice(3),
      ).toEqual(["TBD", "N/A", "TBD"]);
      expect(columns(taReleased, 1).map((c) => c.label)).toEqual(SIX);
      expect(
        columns(taReleased, 1)
          .map((c) => c.value)
          .slice(3),
      ).toEqual(["70", "3", "N/A"]);
      expect(columns(ulaReleased, 0).map((c) => c.label)).toEqual(SIX);
      expect(
        columns(ulaReleased, 0)
          .map((c) => c.value)
          .slice(3),
      ).toEqual(["220", "N/A", "4"]);
      expect(columns(ulaReleased, 1).map((c) => c.label)).toEqual(SIX);
      expect(
        columns(ulaReleased, 1)
          .map((c) => c.value)
          .slice(3),
      ).toEqual(["TBD", "TBD", "N/A"]);
      expect(columns(bothReleased, 0).map((c) => c.label)).toEqual(SIX);
      expect(
        columns(bothReleased, 0)
          .map((c) => c.value)
          .slice(3),
      ).toEqual(["220", "N/A", "4"]);
      expect(columns(bothReleased, 1).map((c) => c.label)).toEqual(SIX);
      expect(
        columns(bothReleased, 1)
          .map((c) => c.value)
          .slice(3),
      ).toEqual(["70", "3", "N/A"]);
    });

    test("a released allocation that is missing is blank", () => {
      const [, ta] = taReleased;
      const [w26] = groupByQuarter([
        {
          ...ta,
          courses: [
            {
              ...ta.courses[0],
              // Absent, not null: a row from before the field existed.
              allocation: undefined,
              enrollmentEstimate: undefined,
            },
          ],
        },
      ]);
      expect(
        enrollmentColumns(w26.courses[0], "P").map((c) => c.value),
      ).toEqual(["0100", "120", "150", "", "", "N/A"]);
    });
  });
});
