import { describe, expect, test } from "vitest";
import {
  COURSE_NUMBER_CHARACTERS,
  COURSE_NUMBER_WIDTH,
  WIDE_COLUMN_DEFAULT_WIDTH,
  WIDE_COLUMN_IDS,
  WIDE_COLUMN_MAX_WIDTH,
  WIDE_COLUMN_MIN_WIDTH,
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

describe("the course number column's width (issue #358)", () => {
  test("is 13 characters, the width of the widest course number, XXXXXXX 999XX", () => {
    expect("XXXXXXX 999XX").toHaveLength(13);
    expect(COURSE_NUMBER_CHARACTERS).toBe(13);
    expect(COURSE_NUMBER_WIDTH).toBe("13ch");
  });
});
