import { describe, expect, test } from "vitest";
import {
  CHOICE_CELL_STYLE,
  CHOICE_COLUMN_WIDTH,
  LABEL_CELL_STYLE,
  SELECTION_TABLE_CLASS,
} from "main/utils/formTableLayout";

describe("formTableLayout", () => {
  test("the table shrinks to its content", () => {
    expect(SELECTION_TABLE_CLASS).toBe("align-middle w-auto");
  });

  test("the label column is as wide as its widest label, on one line", () => {
    expect(LABEL_CELL_STYLE).toEqual({ width: "1%", whiteSpace: "nowrap" });
  });

  test("every choice column is the same width and lets its heading wrap", () => {
    expect(CHOICE_COLUMN_WIDTH).toBe("8em");
    expect(CHOICE_CELL_STYLE).toEqual({ width: "8em", whiteSpace: "normal" });
  });
});
