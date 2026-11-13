import { describe, expect, test } from "vitest";
import {
  CHOICE_CELL_CLASS,
  COURSE_LABEL_CELL_CLASS,
  LABEL_CELL_CLASS,
  READ_ONLY_SELECTION_TABLE_CLASS,
  SELECTION_TABLE_CLASS,
} from "main/utils/formTableLayout";

describe("formTableLayout", () => {
  test("the table shrinks to its content", () => {
    expect(SELECTION_TABLE_CLASS).toBe("align-middle w-auto");
  });

  test("the cell classes are the ones index.css styles (issue #443)", () => {
    expect(READ_ONLY_SELECTION_TABLE_CLASS).toBe("selection-table-read-only");
    expect(LABEL_CELL_CLASS).toBe("selection-table-label");
    expect(COURSE_LABEL_CELL_CLASS).toBe("selection-table-course");
    expect(CHOICE_CELL_CLASS).toBe("selection-table-choice");
  });
});
