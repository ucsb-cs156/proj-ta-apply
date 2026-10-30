import { describe, expect, test } from "vitest";
import {
  QUARTER_DATE_FIELDS,
  refreshSummary,
  showQuarterDate,
} from "main/utils/quarterCalendar";
import { yyyyqToQyy } from "main/utils/quarterUtilities";

describe("quarterCalendar (issue #151)", () => {
  test("showQuarterDate keeps the date, adds the time only when asked, and blanks a missing value", () => {
    expect(showQuarterDate("2021-10-01T00:00:00")).toBe("2021-10-01");
    expect(showQuarterDate("2021-05-10T09:00:00", true)).toBe(
      "2021-05-10 09:00",
    );
    expect(showQuarterDate("2021-05-10T09:00:00", false)).toBe("2021-05-10");
    expect(showQuarterDate("2021-05-10", true)).toBe("2021-05-10");
    expect(showQuarterDate(null)).toBe("");
    expect(showQuarterDate(undefined, true)).toBe("");
    expect(showQuarterDate("")).toBe("");
  });

  test("the date fields, in card order, with the passes shown with their time", () => {
    expect(QUARTER_DATE_FIELDS.map((f) => f.key)).toEqual([
      "firstDayOfQuarter",
      "firstDayOfClasses",
      "lastDayToAddUnderGrad",
      "lastDayToAddGrad",
      "lastDayThirdWeek",
      "lastDayOfClasses",
      "firstDayOfFinals",
      "lastDayOfFinals",
      "lastDayOfSchedule",
      "feeDeadline",
      "pass1Begin",
      "pass2Begin",
      "pass3Begin",
    ]);
    expect(
      QUARTER_DATE_FIELDS.filter((f) => f.withTime).map((f) => f.key),
    ).toEqual(["pass1Begin", "pass2Begin", "pass3Begin"]);
    expect(QUARTER_DATE_FIELDS.map((f) => f.label)).toEqual([
      "First day of quarter",
      "First day of classes",
      "Last day to add (undergrad)",
      "Last day to add (grad)",
      "Last day of third week",
      "Last day of classes",
      "First day of finals",
      "Last day of finals",
      "Last day of schedule",
      "Fee deadline",
      "Pass 1 begins",
      "Pass 2 begins",
      "Pass 3 begins",
    ]);
  });

  test("refreshSummary says the range checked and how many were saved", () => {
    expect(
      refreshSummary(
        {
          start: "20212",
          end: "20214",
          quarters: [
            { quarter: "20212" },
            { quarter: "20213" },
            { quarter: "20214" },
          ] as never,
        },
        yyyyqToQyy,
      ),
    ).toBe("Checked UCSB for quarters S21 through F21; 3 saved.");
    expect(
      refreshSummary(
        { start: "20221", end: "20221", quarters: [] },
        yyyyqToQyy,
      ),
    ).toBe("Checked UCSB for quarters W22 through W22; 0 saved.");
  });
});
