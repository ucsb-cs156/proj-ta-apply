import { describe, expect, test } from "vitest";
import {
  COURSE_NUMBER_CHARACTERS,
  COURSE_NUMBER_WIDTH,
  WIDE_COLUMN_DEFAULT_WIDTH,
  WIDE_COLUMN_IDS,
  WIDE_COLUMN_MAX_WIDTH,
  WIDE_COLUMN_MIN_WIDTH,
  compactCourseNumber,
  isWideColumnId,
  wideColumnProps,
} from "main/utils/columnWidths";

describe("columnWidths (issue #342)", () => {
  test("the widths are 400px by default, 200px at least, and no maximum", () => {
    expect(WIDE_COLUMN_DEFAULT_WIDTH).toBe(400);
    expect(WIDE_COLUMN_MIN_WIDTH).toBe(200);
    expect(WIDE_COLUMN_MAX_WIDTH).toBe(Number.MAX_SAFE_INTEGER);
  });

  test("the wide columns are the long text answers", () => {
    expect([...WIDE_COLUMN_IDS]).toEqual([
      "courseInterests",
      "topicProficiencies",
      "interests",
      "prevExperience",
      "comments",
      "postApplicationComments",
      "adminComments",
    ]);
  });

  test.each(WIDE_COLUMN_IDS)("%s is wide and resizable", (id) => {
    expect(isWideColumnId(id)).toBe(true);
    expect(wideColumnProps(id)).toEqual({
      size: 400,
      minSize: 200,
      maxSize: Number.MAX_SAFE_INTEGER,
      enableResizing: true,
    });
  });

  test("any other column gets no options", () => {
    expect(isWideColumnId("email")).toBe(false);
    expect(wideColumnProps("email")).toEqual({});
  });
});

describe("the course number column's width (issues #358, #383)", () => {
  test("is 11 characters, the width of the widest compact course number, CMPSC 190DD", () => {
    expect(compactCourseNumber("CMPSC   190DD")).toHaveLength(11);
    expect(COURSE_NUMBER_CHARACTERS).toBe(11);
    expect(COURSE_NUMBER_WIDTH).toBe("11ch");
  });
});

describe("compactCourseNumber (issue #383)", () => {
  test.each([
    ["CMPSC     8", "CMPSC   8"],
    ["CMPSC    24", "CMPSC  24"],
    ["CMPSC   156", "CMPSC 156"],
    ["CMPSC   130A", "CMPSC 130A"],
    ["CMPSC   190DD", "CMPSC 190DD"],
    ["CMPTGCS   1A", "CMPTGCS   1A"],
  ])("drops the API's subject area padding: %j becomes %j", (padded, shown) => {
    expect(compactCourseNumber(padded)).toBe(shown);
  });

  test("lines up the digits of an unpadded catalog number the same way", () => {
    expect(compactCourseNumber("CMPSC 8")).toBe("CMPSC   8");
    expect(compactCourseNumber("CMPSC 24")).toBe("CMPSC  24");
    expect(compactCourseNumber(" CMPSC  156 ")).toBe("CMPSC 156");
  });

  test("a number of three or more digits, or none, is left as it is", () => {
    expect(compactCourseNumber("CMPSC 1234")).toBe("CMPSC 1234");
    expect(compactCourseNumber("CMPSC   X")).toBe("CMPSC X");
    expect(compactCourseNumber("CMPSC")).toBe("CMPSC");
    expect(compactCourseNumber("")).toBe("");
  });

  test("only digits at the start of the number are padded, and any further words stay a space apart", () => {
    expect(compactCourseNumber("CMPSC   X1")).toBe("CMPSC X1");
    expect(compactCourseNumber("CMPSC   8  B")).toBe("CMPSC   8 B");
  });
});
