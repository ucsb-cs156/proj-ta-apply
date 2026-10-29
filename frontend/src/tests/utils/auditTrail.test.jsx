import {
  LONG_VALUE,
  SHOWN_PREFIX,
  SORT_OPTIONS,
  abbreviate,
  isLong,
} from "main/utils/auditTrail";

describe("auditTrail utils", () => {
  test("a value is long once it passes 30 characters", () => {
    expect(LONG_VALUE).toBe(30);
    expect(isLong("")).toBe(false);
    expect(isLong("x".repeat(30))).toBe(false);
    expect(isLong("x".repeat(31))).toBe(true);
  });

  test("abbreviate keeps the first 15 characters and adds an ellipsis", () => {
    expect(SHOWN_PREFIX).toBe(15);
    expect(abbreviate("abcdefghijklmnopqrstuvwxyz0123456789")).toBe(
      "abcdefghijklmno...",
    );
  });

  test("every column of the table can be sorted by, id first", () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
      "id",
      "editedAt",
      "ulaApplicationId",
      "taApplicationId",
      "fieldName",
      "oldValue",
      "newValue",
    ]);
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual([
      "id",
      "Edited",
      "ULA Application",
      "TA Application",
      "Field",
      "Old Value",
      "New Value",
    ]);
  });
});
