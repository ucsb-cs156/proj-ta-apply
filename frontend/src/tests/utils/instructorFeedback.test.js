import {
  AT_LEAST_ONE_MESSAGE,
  COMMENTS_LIMIT_MESSAGE,
  COMMENTS_SAVE_DELAY_MS,
  FEEDBACK_COSTS_URL,
  FEEDBACK_URL,
  MAX_COMMENTS,
  NOT_YET_SET,
  WAITING_FOR_BOTH,
  WAITING_FOR_TA,
  WAITING_FOR_ULA,
  costDisplay,
  countFromInput,
  feedbackWaitingMessage,
  isValidCount,
  ratioDisplay,
} from "main/utils/instructorFeedback";

const ta = (released) => ({ type: "TA", allocationsReleased: released });
const ula = (released) => ({ type: "ULA", allocationsReleased: released });
const quarter = (recruitments) => ({
  quarter: "20261",
  courses: [],
  ...recruitments,
});

describe("instructorFeedback (issue #425)", () => {
  test("the texts are as the issue words them", () => {
    expect(WAITING_FOR_TA).toBe(
      "When initial TA allocations have been released to faculty, you will be given an opportunity here to provide feedback",
    );
    expect(WAITING_FOR_ULA).toBe(
      "When initial ULA allocations have been released to faculty, you will be given an opportunity here to provide feedback",
    );
    expect(WAITING_FOR_BOTH).toBe(
      "When both the initial TA and ULA allocations have been released to faculty, you will be given an opportunity here to provide feedback",
    );
    expect(COMMENTS_LIMIT_MESSAGE).toBe(
      "If you need more than 2048 characters for your comments, it may be better to send an email.",
    );
    expect(AT_LEAST_ONE_MESSAGE).toBe(
      "Please select at least one of the options above.",
    );
    expect(NOT_YET_SET).toBe("not yet set");
    expect(MAX_COMMENTS).toBe(2048);
    expect(COMMENTS_SAVE_DELAY_MS).toBe(750);
    expect(FEEDBACK_URL).toBe("/api/instructor/feedback");
    expect(FEEDBACK_COSTS_URL).toBe("/api/instructor/feedback/costs");
  });

  test("a TA-only quarter waits for the TA allocations", () => {
    expect(feedbackWaitingMessage(quarter({ ta: ta(false) }))).toBe(
      WAITING_FOR_TA,
    );
    expect(feedbackWaitingMessage(quarter({ ta: ta(true) }))).toBeNull();
  });

  test("a ULA-only quarter waits for the ULA allocations", () => {
    expect(feedbackWaitingMessage(quarter({ ula: ula(false) }))).toBe(
      WAITING_FOR_ULA,
    );
    expect(feedbackWaitingMessage(quarter({ ula: ula(true) }))).toBeNull();
  });

  test("a quarter with both waits until both are released", () => {
    expect(
      feedbackWaitingMessage(quarter({ ta: ta(false), ula: ula(false) })),
    ).toBe(WAITING_FOR_BOTH);
    expect(
      feedbackWaitingMessage(quarter({ ta: ta(true), ula: ula(false) })),
    ).toBe(WAITING_FOR_BOTH);
    expect(
      feedbackWaitingMessage(quarter({ ta: ta(false), ula: ula(true) })),
    ).toBe(WAITING_FOR_BOTH);
    expect(
      feedbackWaitingMessage(quarter({ ta: ta(true), ula: ula(true) })),
    ).toBeNull();
  });

  test("a cost reads in dollars, or not yet set while missing or zero", () => {
    expect(costDisplay(12000)).toBe("$12,000.00");
    expect(costDisplay(2000.5)).toBe("$2,000.50");
    expect(costDisplay(0)).toBe(NOT_YET_SET);
    expect(costDisplay(null)).toBe(NOT_YET_SET);
    expect(costDisplay(undefined)).toBe(NOT_YET_SET);
  });

  test("the ratio is 1: the cost per TA over the cost per ULA, to one decimal", () => {
    const costs = (perTA, perULA) => ({
      quarter: "20261",
      estimatedCostPerTA: perTA,
      estimatedCostPerULA: perULA,
    });
    expect(ratioDisplay(costs(12000, 2000))).toBe("1:6.0");
    expect(ratioDisplay(costs(12000, 3500))).toBe("1:3.4");
    expect(ratioDisplay(costs(10000, 3000))).toBe("1:3.3");
    expect(ratioDisplay(costs(1000, 3000))).toBe("1:0.3");
    // Never NaN or Infinity.
    expect(ratioDisplay(costs(12000, 0))).toBe(NOT_YET_SET);
    expect(ratioDisplay(costs(0, 2000))).toBe(NOT_YET_SET);
    expect(ratioDisplay(costs(null, 2000))).toBe(NOT_YET_SET);
    expect(ratioDisplay(costs(12000, null))).toBe(NOT_YET_SET);
    expect(ratioDisplay(null)).toBe(NOT_YET_SET);
    expect(ratioDisplay(undefined)).toBe(NOT_YET_SET);
  });

  test("a count is digits or nothing", () => {
    expect(isValidCount("")).toBe(true);
    expect(isValidCount("0")).toBe(true);
    expect(isValidCount("12")).toBe(true);
    expect(isValidCount("-1")).toBe(false);
    expect(isValidCount("1.5")).toBe(false);
    expect(isValidCount("a1")).toBe(false);
    expect(isValidCount("1a")).toBe(false);
    expect(countFromInput("")).toBeNull();
    expect(countFromInput("0")).toBe(0);
    expect(countFromInput("12")).toBe(12);
  });
});
