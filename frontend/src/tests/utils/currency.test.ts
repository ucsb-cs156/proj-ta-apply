import { describe, expect, test } from "vitest";
import {
  bottomLineDisplay,
  dollarsForInput,
  formatDollars,
  isValidDollars,
  overallRatioDisplay,
} from "main/utils/currency";

describe("currency utilities", () => {
  test("formatDollars shows a dollar sign, separators and two decimals", () => {
    expect(formatDollars(0)).toBe("$0.00");
    expect(formatDollars(7)).toBe("$7.00");
    expect(formatDollars(1234.5)).toBe("$1,234.50");
    expect(formatDollars(125000.25)).toBe("$125,000.25");
    expect(formatDollars(-16000)).toBe("-$16,000.00");
    expect(formatDollars(2.005)).toBe("$2.01");
  });

  test("isValidDollars accepts digits with up to two decimals and nothing else", () => {
    expect(isValidDollars("0")).toBe(true);
    expect(isValidDollars("12000")).toBe(true);
    expect(isValidDollars("12000.5")).toBe(true);
    expect(isValidDollars("12000.50")).toBe(true);
    expect(isValidDollars("")).toBe(false);
    expect(isValidDollars(".5")).toBe(false);
    expect(isValidDollars("12.")).toBe(false);
    expect(isValidDollars("12.345")).toBe(false);
    expect(isValidDollars("-5")).toBe(false);
    expect(isValidDollars("$5")).toBe(false);
    expect(isValidDollars("1,000")).toBe(false);
    expect(isValidDollars("abc")).toBe(false);
  });

  test("dollarsForInput is two plain decimals, or empty when there is nothing stored", () => {
    expect(dollarsForInput(12000)).toBe("12000.00");
    expect(dollarsForInput(2500.5)).toBe("2500.50");
    expect(dollarsForInput(0)).toBe("0.00");
    expect(dollarsForInput(null)).toBe("");
    expect(dollarsForInput(undefined)).toBe("");
  });

  test("bottomLineDisplay is green with a plus, red with a minus, or plain zero", () => {
    expect(bottomLineDisplay(3995.25)).toEqual({
      text: "+$3,995.25",
      className: "text-success",
    });
    expect(bottomLineDisplay(0.01)).toEqual({
      text: "+$0.01",
      className: "text-success",
    });
    expect(bottomLineDisplay(-16000)).toEqual({
      text: "-$16,000.00",
      className: "text-danger",
    });
    expect(bottomLineDisplay(-0.01)).toEqual({
      text: "-$0.01",
      className: "text-danger",
    });
    expect(bottomLineDisplay(0)).toEqual({ text: "$0.00", className: "" });
    // Anything that rounds to zero cents is zero, never "-$0.00".
    expect(bottomLineDisplay(-0.004)).toEqual({ text: "$0.00", className: "" });
    expect(bottomLineDisplay(0.004)).toEqual({ text: "$0.00", className: "" });
  });

  test("overallRatioDisplay is 1:n rounded, or a dash without a ratio", () => {
    expect(overallRatioDisplay(50)).toBe("1:50");
    expect(overallRatioDisplay(37.5)).toBe("1:38");
    expect(overallRatioDisplay(0.25)).toBe("1:0");
    expect(overallRatioDisplay(null)).toBe("—");
    expect(overallRatioDisplay(undefined)).toBe("—");
  });
});
