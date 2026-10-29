import {
  LONG_VALUE,
  SHOWN_PREFIX,
  SORT_OPTIONS,
  abbreviate,
  appId,
  appLabel,
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
      "taApplicationId",
      "ulaApplicationId",
      "fieldName",
      "oldValue",
      "newValue",
    ]);
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual([
      "id",
      "Edited",
      "App (TA id)",
      "App (ULA id)",
      "Field",
      "Old Value",
      "New Value",
    ]);
  });

  /** Issue #63: the two id columns shown as one. */
  test("appLabel and appId name whichever application a row belongs to", () => {
    expect(appLabel({ taApplicationId: 7, ulaApplicationId: null })).toBe(
      "TA 7",
    );
    expect(appId({ taApplicationId: 7, ulaApplicationId: null })).toBe(7);
    expect(appLabel({ taApplicationId: null, ulaApplicationId: 14 })).toBe(
      "ULA 14",
    );
    expect(appId({ taApplicationId: null, ulaApplicationId: 14 })).toBe(14);
    // Bad data: the check constraint forbids both or neither, but the page must not crash.
    expect(appLabel({ taApplicationId: null, ulaApplicationId: null })).toBe(
      "",
    );
    expect(appId({ taApplicationId: null, ulaApplicationId: null })).toBeNull();
    expect(appLabel({ taApplicationId: 3, ulaApplicationId: 4 })).toBe("TA 3");
    expect(appId({ taApplicationId: 3, ulaApplicationId: 4 })).toBe(3);
  });
});
