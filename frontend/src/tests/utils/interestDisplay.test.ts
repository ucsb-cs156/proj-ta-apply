import { describe, expect, test } from "vitest";
import {
  ENTHUSIASTIC,
  FIRST_CHOICE,
  INCLUDE_NOT_INTERESTED_LABEL,
  INTEREST_LEGEND,
  interestDisplay,
  NOT_INTERESTED,
  NOT_INTERESTED_LABEL,
  NOT_INTERESTED_FORCED_TOOLTIP,
  NOT_INTERESTED_WARNING,
  SECOND_CHOICE,
  WOULD_CONSIDER,
} from "main/utils/interestDisplay";

describe("interestDisplay", () => {
  test("the preference strings match the backend's", () => {
    expect(FIRST_CHOICE).toBe("1st Choice");
    expect(SECOND_CHOICE).toBe("2nd Choice");
    expect(ENTHUSIASTIC).toBe("Enthusiastic");
    expect(WOULD_CONSIDER).toBe("Would Consider");
    expect(NOT_INTERESTED).toBe("Not Interested");
    expect(NOT_INTERESTED_LABEL).toBe("Not Interested/Not Applicable");
  });

  // Issue #415: the background is a class in index.css, not an inline colour.
  test("first and second choice are green with a large numbered mark", () => {
    expect(interestDisplay("1st Choice")).toEqual({
      className: "candidate-course-rank-enthusiastic",
      symbol: "➊",
      large: true,
      description: "Applicant's 1st choice",
    });
    expect(interestDisplay("2nd Choice")).toEqual({
      className: "candidate-course-rank-enthusiastic",
      symbol: "➋",
      large: true,
      description: "Applicant's 2nd choice",
    });
  });

  test("enthusiastic is green with a tick, would consider yellow with a bar", () => {
    expect(interestDisplay("Enthusiastic")).toEqual({
      className: "candidate-course-rank-enthusiastic",
      symbol: "✓",
      large: false,
      description: "Applicant is enthusiastic about this course",
    });
    expect(interestDisplay("Would Consider")).toEqual({
      className: "candidate-course-rank-would-consider",
      symbol: "▬",
      large: false,
      description: "Applicant would consider this course",
    });
  });

  test("anything else is the red not-interested display", () => {
    const notInterested = {
      className: "candidate-course-rank-not-applicable",
      symbol: "✖",
      large: false,
      description: "Applicant marked this course Not Interested/Not Applicable",
    };
    expect(interestDisplay("Not Interested")).toEqual(notInterested);
    expect(interestDisplay(null)).toEqual(notInterested);
    expect(interestDisplay(undefined)).toEqual(notInterested);
    expect(interestDisplay("")).toEqual(notInterested);
    expect(interestDisplay("something else")).toEqual(notInterested);
  });

  test("the legend lists the five levels in order with their labels", () => {
    expect(INTEREST_LEGEND).toEqual([
      { preference: "1st Choice", label: "1st choice" },
      { preference: "2nd Choice", label: "2nd choice" },
      { preference: "Enthusiastic", label: "Enthusiastic" },
      { preference: "Would Consider", label: "Would Consider" },
      { preference: "Not Interested", label: "Not Interested/Not Applicable" },
    ]);
  });

  test("the warning and the checkbox label are the design's words", () => {
    expect(NOT_INTERESTED_WARNING).toBe(
      "Consider whether you should rank candidates that did not express interest in your course",
    );
    expect(INCLUDE_NOT_INTERESTED_LABEL).toBe(
      'Include candidates that marked my course with "Not Interested/Not Applicable"',
    );
  });

  test("the tooltip on the forced checkbox", () => {
    expect(NOT_INTERESTED_FORCED_TOOLTIP).toBe(
      "This option cannot be deselected when there are ranked candidates in this section",
    );
  });
});
