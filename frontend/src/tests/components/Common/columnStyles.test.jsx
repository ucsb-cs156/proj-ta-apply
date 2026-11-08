import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  STACKED_LEAD_REST_FONT_SIZE,
  numeric,
  shrinkToContent,
  stacked,
  stackedLead,
} from "main/components/Common/columnStyles";

describe("columnStyles", () => {
  test("stacked: two lines at 80% size, the text whole", () => {
    const { container } = render(stacked("Enrollment", "Estimate"));

    const span = container.querySelector("span");
    expect(span.style.fontSize).toBe("80%");
    expect(span.querySelector("br")).not.toBeNull();
    expect(span).toHaveTextContent("Enrollment Estimate");
  });

  test("shrinkToContent and numeric", () => {
    expect(shrinkToContent.style).toEqual({
      width: "1%",
      whiteSpace: "nowrap",
    });
    expect(numeric.style).toEqual({
      width: "1%",
      whiteSpace: "nowrap",
      textAlign: "right",
    });
  });

  // Issue #383: the lead word at full size, the rest under it, each on its own smaller line.
  describe("stackedLead", () => {
    test("one word under the lead: the lead is the first text, the word a smaller block", () => {
      render(<th>{stackedLead("TA", "Allocation")}</th>);

      const stack = screen.getByTitle("TA Allocation");
      expect(stack).toHaveTextContent("TA Allocation");
      expect(stack.textContent).toBe("TA Allocation");
      expect(stack.style.display).toBe("inline-block");
      expect(stack.style.lineHeight).toBe("1.2");
      expect(stack.style.fontSize).toBe("");
      expect(stack.firstChild.nodeType).toBe(Node.TEXT_NODE);
      expect(stack.firstChild.textContent).toBe("TA");
      const lines = [...stack.querySelectorAll("span")];
      expect(lines).toHaveLength(1);
      expect(lines[0]).toHaveTextContent("Allocation");
      expect(lines[0].style.display).toBe("block");
      expect(lines[0].style.fontSize).toBe(STACKED_LEAD_REST_FONT_SIZE);
      expect(STACKED_LEAD_REST_FONT_SIZE).toBe("70%");
      expect(stack.querySelector("br")).toBeNull();
    });

    test("two words under the lead: three lines, and the whole phrase as the accessible name", () => {
      render(
        <table>
          <thead>
            <tr>
              <th>{stackedLead("ULA", "Unrounded", "Allocation")}</th>
            </tr>
          </thead>
        </table>,
      );

      const heading = screen.getByRole("columnheader", {
        name: "ULA Unrounded Allocation",
      });
      const stack = screen.getByTitle("ULA Unrounded Allocation");
      expect(heading).toContainElement(stack);
      expect(stack.textContent).toBe("ULA Unrounded Allocation");
      const lines = [...stack.querySelectorAll("span")];
      expect(lines.map((line) => line.textContent)).toEqual([
        "Unrounded",
        "Allocation",
      ]);
      lines.forEach((line) => {
        expect(line.style.display).toBe("block");
        expect(line.style.fontSize).toBe("70%");
      });
    });

    test("nothing under the lead: just the word", () => {
      render(stackedLead("TA"));

      const stack = screen.getByTitle("TA");
      expect(stack.textContent).toBe("TA");
      expect(stack.querySelector("span")).toBeNull();
    });
  });
});
