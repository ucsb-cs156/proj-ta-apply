import { describe, expect, test } from "vitest";
import {
  fillNoticeFields,
  longDate,
  NOTICE_FIELD_EXAMPLES,
  NOTICE_FIELDS,
  NOTICE_FIELDS_HINT,
  quarterName,
} from "main/utils/noticeFields";

describe("noticeFields (issue #150)", () => {
  test("quarterName writes the quarter out", () => {
    expect(quarterName("20261")).toBe("Winter 2026");
    expect(quarterName("20262")).toBe("Spring 2026");
    expect(quarterName("20253")).toBe("Summer 2025");
    expect(quarterName("20254")).toBe("Fall 2025");
  });

  test("longDate reads an ISO date as a calendar date", () => {
    expect(longDate("2026-01-20")).toBe("January 20, 2026");
    expect(longDate("2025-12-01")).toBe("December 1, 2025");
  });

  test("fillNoticeFields fills both fields, every occurrence, inside Markdown", () => {
    const text =
      "During **${quarter}** apply by ${primaryConsiderationDate}; again: ${quarter}.";
    expect(
      fillNoticeFields(text, {
        quarter: "20261",
        primaryConsiderationDate: "2026-01-20",
      }),
    ).toBe(
      "During **Winter 2026** apply by January 20, 2026; again: Winter 2026.",
    );
  });

  test("a field without a value, an unknown field, or no fill-in at all is left as written", () => {
    const text = "${quarter} ${primaryConsiderationDate} ${other} $quarter";
    expect(fillNoticeFields(text)).toBe(text);
    expect(fillNoticeFields(text, null)).toBe(text);
    expect(fillNoticeFields(text, {})).toBe(text);
    expect(fillNoticeFields(text, { quarter: "20261" })).toBe(
      "Winter 2026 ${primaryConsiderationDate} ${other} $quarter",
    );
    expect(
      fillNoticeFields(text, {
        quarter: null,
        primaryConsiderationDate: "2026-01-20",
      }),
    ).toBe("${quarter} January 20, 2026 ${other} $quarter");
    expect(fillNoticeFields("plain", { quarter: "20261" })).toBe("plain");
  });

  test("the field names, the hint and the issue's two examples", () => {
    expect(NOTICE_FIELDS).toEqual(["quarter", "primaryConsiderationDate"]);
    expect(NOTICE_FIELDS_HINT).toBe(
      "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place. The preview shows them as written.",
    );
    expect(NOTICE_FIELD_EXAMPLES).toEqual([
      "If you are a BS/MS student, and you will be in graduate status during ${quarter}, please apply to be a TA instead of applying to be a ULA.",
      "Applications received by ${primaryConsiderationDate} will be given full consideration.  Applications received after that date are not guaranteed to be considered, but may be reviewed if time permits and/or positions remain unfilled.",
    ]);
  });
});
