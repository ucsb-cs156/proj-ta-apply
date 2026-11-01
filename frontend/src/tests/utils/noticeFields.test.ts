import { describe, expect, test } from "vitest";
import {
  fillNoticeFields,
  longDate,
  longDateTime,
  NOTICE_FIELD_EXAMPLES,
  NOTICE_FIELDS,
  NOTICE_FIELDS_HINT,
  KNOWN_NOTICE_FIELDS,
  defaultPreviewQuarter,
  findUnknownFields,
  markUnknownFields,
  UNKNOWN_FIELD_TITLE,
  QUARTER_NAME_FIELDS,
  QUARTER_NOTICE_FIELDS,
  quarterName,
  SAMPLE_CALENDAR,
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

  // ---- issue #153: the quarter calendar's fields ----

  test("longDateTime writes the date out, with the time only for a pass", () => {
    expect(longDateTime("2021-05-10T09:00:00", true)).toBe(
      "May 10, 2021 at 9:00 AM",
    );
    expect(longDateTime("2021-05-10T13:05:00", true)).toBe(
      "May 10, 2021 at 1:05 PM",
    );
    expect(longDateTime("2021-05-10T00:00:00", true)).toBe(
      "May 10, 2021 at 12:00 AM",
    );
    expect(longDateTime("2021-05-10T12:30:00", true)).toBe(
      "May 10, 2021 at 12:30 PM",
    );
    expect(longDateTime("2021-05-10T09:00:00", false)).toBe("May 10, 2021");
    expect(longDateTime("2021-05-10", true)).toBe("May 10, 2021");
  });

  test("the calendar fields: four names then the thirteen dates, every one filled from a row", () => {
    expect(QUARTER_NAME_FIELDS.map((f) => f.key)).toEqual([
      "qyy",
      "name",
      "category",
      "academicYear",
    ]);
    expect(QUARTER_NOTICE_FIELDS).toHaveLength(17);
    expect(QUARTER_NOTICE_FIELDS.slice(0, 4)).toEqual(QUARTER_NAME_FIELDS);
    expect(QUARTER_NOTICE_FIELDS[4].key).toBe("firstDayOfQuarter");
    expect(QUARTER_NOTICE_FIELDS[16]).toEqual({
      key: "pass3Begin",
      label: "Pass 3 begins",
    });
    const fillIn = { calendar: SAMPLE_CALENDAR };
    expect(
      fillNoticeFields("${qyy} ${name} ${category} ${academicYear}", fillIn),
    ).toBe("F21 FALL 2021 FALL 2021-2022");
    expect(
      fillNoticeFields(
        "Classes begin ${firstDayOfClasses}; pass 1 at ${pass1Begin}.",
        fillIn,
      ),
    ).toBe("Classes begin October 1, 2021; pass 1 at May 10, 2021 at 9:00 AM.");
    for (const { key } of QUARTER_NOTICE_FIELDS) {
      expect(fillNoticeFields("${" + key + "}", fillIn)).not.toContain("${");
    }
  });

  test("a calendar field with no value, or no calendar, stays as written; the recruitment's own fields still fill", () => {
    const text =
      "${quarter} ${firstDayOfClasses} ${lastDayThirdWeek} ${quarterX}";
    expect(
      fillNoticeFields(text, {
        quarter: "20214",
        calendar: {
          ...SAMPLE_CALENDAR,
          lastDayThirdWeek: null,
          firstDayOfClasses: "",
        },
      }),
    ).toBe("Fall 2021 ${firstDayOfClasses} ${lastDayThirdWeek} ${quarterX}");
    expect(fillNoticeFields(text, { quarter: "20214", calendar: null })).toBe(
      "Fall 2021 ${firstDayOfClasses} ${lastDayThirdWeek} ${quarterX}",
    );
    expect(fillNoticeFields(text, { quarter: "20214" })).toBe(
      "Fall 2021 ${firstDayOfClasses} ${lastDayThirdWeek} ${quarterX}",
    );
    // A name field with no value stays as written too, never "null".
    expect(
      fillNoticeFields("${category} ${qyy}", {
        calendar: { ...SAMPLE_CALENDAR, category: null, qyy: "" },
      }),
    ).toBe("${category} ${qyy}");
  });

  test("the field names, the hint and the issue's two examples", () => {
    expect(NOTICE_FIELDS).toEqual(["quarter", "primaryConsiderationDate"]);
    expect(NOTICE_FIELDS_HINT).toBe(
      "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place; the various dates of that quarter, such as ${firstDayOfClasses}, can be inserted the same way. The preview fills them in for the quarter chosen above it.",
    );
    expect(NOTICE_FIELD_EXAMPLES).toEqual([
      "If you are a BS/MS student, and you will be in graduate status during ${quarter}, please apply to be a TA instead of applying to be a ULA.",
      "Applications received by ${primaryConsiderationDate} will be given full consideration.  Applications received after that date are not guaranteed to be considered, but may be reviewed if time permits and/or positions remain unfilled.",
    ]);
  });

  // ---- Issue #192: unknown fields ----

  test("the known fields are the recruitment's two and every calendar field", () => {
    expect(KNOWN_NOTICE_FIELDS.slice(0, 6)).toEqual([
      "quarter",
      "primaryConsiderationDate",
      "qyy",
      "name",
      "category",
      "academicYear",
    ]);
    expect(KNOWN_NOTICE_FIELDS).toContain("firstDayOfClasses");
    expect(KNOWN_NOTICE_FIELDS).toContain("lastDayThirdWeek");
    expect(KNOWN_NOTICE_FIELDS).toHaveLength(2 + 4 + 13);
  });

  test("defaultPreviewQuarter is the quarter after the one the date falls in", () => {
    expect(defaultPreviewQuarter(new Date(2026, 1, 10))).toBe("20262");
    expect(defaultPreviewQuarter(new Date(2026, 4, 1))).toBe("20263");
    expect(defaultPreviewQuarter(new Date(2026, 6, 4))).toBe("20264");
    expect(defaultPreviewQuarter(new Date(2026, 10, 30))).toBe("20271");
    // Today, whatever it is, gives a five-digit quarter code one quarter on.
    expect(defaultPreviewQuarter()).toMatch(/^\d{4}[1-4]$/);
  });

  test("findUnknownFields lists each unknown name once, in order, and ignores known ones", () => {
    expect(
      findUnknownFields(
        "Due ${deadline} in ${quarter}; see ${Deadline} and ${deadline} and ${firstDayOfClasses} and ${}.",
      ),
    ).toEqual(["deadline", "Deadline", ""]);
    expect(
      findUnknownFields("Nothing here, not even $quarter or {quarter}."),
    ).toEqual([]);
    expect(findUnknownFields("")).toEqual([]);
    // A brace left open, or a break inside, is not a field.
    expect(findUnknownFields("${unclosed and ${a\nb}")).toEqual([]);
  });

  test("markUnknownFields wraps unknown fields in a titled link and leaves known ones alone", () => {
    expect(UNKNOWN_FIELD_TITLE).toBe("unknown-notice-field");
    expect(markUnknownFields("Due ${deadline} in ${quarter}.")).toBe(
      'Due [${deadline}](# "unknown-notice-field") in ${quarter}.',
    );
    expect(markUnknownFields("${a} ${a}")).toBe(
      '[${a}](# "unknown-notice-field") [${a}](# "unknown-notice-field")',
    );
    expect(markUnknownFields("${}")).toBe('[${}](# "unknown-notice-field")');
    // Brackets and backslashes inside the name are escaped so the link text survives Markdown.
    expect(markUnknownFields("${a[b]c\\d}")).toBe(
      '[${a\\[b\\]c\\\\d}](# "unknown-notice-field")',
    );
    expect(markUnknownFields("plain")).toBe("plain");
  });
});
