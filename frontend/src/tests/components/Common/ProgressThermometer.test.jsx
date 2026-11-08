import { render, screen } from "@testing-library/react";
import ProgressThermometer from "main/components/Common/ProgressThermometer";
import {
  LABEL_INSIDE_FROM,
  THERMOMETER_WIDTH,
  thermometerFigures,
} from "main/components/Common/ProgressThermometerUtils";

/** Issue #315: the reusable progress thermometer. */
describe("ProgressThermometer tests (issue #315)", () => {
  const bar = () => screen.getByTestId("ProgressThermometer-bar");
  const fill = () => screen.getByTestId("ProgressThermometer-fill");
  const text = () => screen.getByTestId("ProgressThermometer-text");

  test("a partial fraction: the text above, the fill at the share, the percentage on the fill", () => {
    render(
      <ProgressThermometer
        numerator={7}
        denominator={12}
        label="Assignments made"
      />,
    );
    expect(text()).toHaveTextContent("Assignments made: 7 of 12 (58%)");
    expect(text().textContent).toBe("Assignments made: 7 of 12 (58%)");
    expect(fill()).toHaveStyle({ width: "58%" });
    expect(fill()).toHaveTextContent("58%");
    expect(fill()).toHaveClass("progress-bar");
    expect(fill()).not.toHaveClass("bg-success");
    expect(fill()).not.toHaveClass("bg-danger");
    expect(screen.queryByTestId("ProgressThermometer-beside")).toBeNull();
    expect(bar()).toHaveClass("progress");
    // 1.5rem, which jsdom computes as 24px.
    expect(bar()).toHaveStyle({ height: "24px" });
  });

  test("is accessible as a progressbar labelled with the whole sentence", () => {
    render(
      <ProgressThermometer
        numerator={7}
        denominator={12}
        label="Assignments made"
      />,
    );
    const progress = screen.getByRole("progressbar", {
      name: "Assignments made: 7 of 12 (58%)",
    });
    expect(progress).toBe(bar());
    expect(progress).toHaveAttribute("aria-valuenow", "58");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
  });

  test("is 80% wide up to 600px, so it fits a phone and a desktop", () => {
    render(<ProgressThermometer numerator={1} denominator={2} label="Done" />);
    const outer = screen.getByTestId("ProgressThermometer");
    expect(outer).toHaveStyle({ width: "80%", maxWidth: "600px" });
    expect(THERMOMETER_WIDTH).toEqual({ width: "80%", maxWidth: "600px" });
    expect(outer).toHaveClass("mb-3");
    expect(outer).toContainElement(text());
    expect(outer).toContainElement(bar());
    expect(bar()).toContainElement(fill());
    // The text line is above the bar.
    expect(
      text().compareDocumentPosition(bar()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(text()).toHaveClass("mb-1");
  });

  test("a small share: the fill is too narrow for the text, so it sits beside the fill", () => {
    render(<ProgressThermometer numerator={1} denominator={10} label="Done" />);
    expect(text()).toHaveTextContent("Done: 1 of 10 (10%)");
    expect(fill()).toHaveStyle({ width: "10%" });
    expect(fill().textContent).toBe("");
    const beside = screen.getByTestId("ProgressThermometer-beside");
    expect(beside).toHaveTextContent("10%");
    expect(beside).toHaveStyle({ left: "10%" });
    expect(beside).toHaveClass(
      "position-absolute",
      "top-50",
      "translate-middle-y",
      "text-body",
      "ps-2",
      "small",
    );
    expect(bar()).toContainElement(beside);
    expect(bar()).toHaveClass("position-relative");
  });

  test("the text moves onto the fill from a fifth on", () => {
    expect(LABEL_INSIDE_FROM).toBe(20);
    const { rerender } = render(
      <ProgressThermometer numerator={19} denominator={100} label="Done" />,
    );
    expect(fill().textContent).toBe("");
    expect(screen.getByTestId("ProgressThermometer-beside")).toHaveTextContent(
      "19%",
    );
    rerender(
      <ProgressThermometer numerator={20} denominator={100} label="Done" />,
    );
    expect(fill().textContent).toBe("20%");
    expect(screen.queryByTestId("ProgressThermometer-beside")).toBeNull();
  });

  test("0%: an empty bar with the percentage beside it", () => {
    render(<ProgressThermometer numerator={0} denominator={6} label="Done" />);
    expect(text()).toHaveTextContent("Done: 0 of 6 (0%)");
    expect(fill()).toHaveStyle({ width: "0%" });
    expect(fill().textContent).toBe("");
    expect(screen.getByTestId("ProgressThermometer-beside")).toHaveTextContent(
      "0%",
    );
    expect(screen.getByTestId("ProgressThermometer-beside")).toHaveStyle({
      left: "0%",
    });
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(fill()).not.toHaveClass("bg-success");
    expect(fill()).not.toHaveClass("bg-danger");
  });

  test("100%: a full green bar", () => {
    render(
      <ProgressThermometer numerator={12} denominator={12} label="Done" />,
    );
    expect(text()).toHaveTextContent("Done: 12 of 12 (100%)");
    expect(fill()).toHaveStyle({ width: "100%" });
    expect(fill()).toHaveTextContent("100%");
    expect(fill()).toHaveClass("bg-success");
    expect(fill()).not.toHaveClass("bg-danger");
    expect(bar()).toHaveAttribute("aria-valuenow", "100");
  });

  test("over 100%: the fill is capped at full and red, but the real numbers are shown", () => {
    render(<ProgressThermometer numerator={3} denominator={1} label="Done" />);
    expect(text()).toHaveTextContent("Done: 3 of 1 (300%)");
    expect(fill()).toHaveStyle({ width: "100%" });
    expect(fill()).toHaveTextContent("300%");
    expect(fill()).toHaveClass("bg-danger");
    expect(fill()).not.toHaveClass("bg-success");
    expect(bar()).toHaveAttribute("aria-valuenow", "100");
    expect(bar()).toHaveAttribute("aria-valuemax", "100");
    expect(
      screen.getByRole("progressbar", { name: "Done: 3 of 1 (300%)" }),
    ).toBeInTheDocument();
  });

  test("no target yet (denominator 0): an empty bar and an explanation, no NaN", () => {
    render(
      <ProgressThermometer
        numerator={3}
        denominator={0}
        label="Assignments made"
      />,
    );
    expect(text().textContent).toBe(
      "Assignments made: 3 so far, no target set yet",
    );
    expect(fill()).toHaveStyle({ width: "0%" });
    expect(fill().textContent).toBe("");
    expect(screen.queryByTestId("ProgressThermometer-beside")).toBeNull();
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(bar()).toHaveAttribute(
      "aria-label",
      "Assignments made: 3 so far, no target set yet",
    );
    expect(text()).not.toHaveTextContent("NaN");
    expect(text()).not.toHaveTextContent("%");
  });

  test("no target yet (denominator missing) with the page's own wording", () => {
    render(
      <ProgressThermometer
        numerator={0}
        denominator={undefined}
        label="Assignments made"
        noTargetText="no hiring target set yet"
      />,
    );
    expect(text().textContent).toBe(
      "Assignments made: 0 so far, no hiring target set yet",
    );
    expect(fill()).toHaveStyle({ width: "0%" });
  });

  test("the test ids follow the prefix", () => {
    render(
      <ProgressThermometer
        numerator={1}
        denominator={4}
        label="Done"
        testIdPrefix="Page-progress"
      />,
    );
    expect(screen.getByTestId("Page-progress")).toBeInTheDocument();
    expect(screen.getByTestId("Page-progress-text")).toHaveTextContent(
      "Done: 1 of 4 (25%)",
    );
    expect(screen.getByTestId("Page-progress-bar")).toHaveAttribute(
      "role",
      "progressbar",
    );
    expect(screen.getByTestId("Page-progress-fill")).toHaveTextContent("25%");
    expect(screen.queryByTestId("ProgressThermometer")).toBeNull();
  });

  test("rounds the percentage to a whole number", () => {
    render(<ProgressThermometer numerator={2} denominator={3} label="Done" />);
    expect(text()).toHaveTextContent("Done: 2 of 3 (67%)");
    expect(fill()).toHaveStyle({ width: "67%" });
    expect(bar()).toHaveAttribute("aria-valuenow", "67");
  });

  describe("thermometerFigures: the numbers, made safe", () => {
    test("a plain fraction", () => {
      expect(thermometerFigures(7, 12)).toEqual({
        done: 7,
        target: 12,
        percent: 58,
        fill: 58,
        hasTarget: true,
      });
    });

    test("over the target: the fill is capped, the percentage is not", () => {
      expect(thermometerFigures(3, 1)).toEqual({
        done: 3,
        target: 1,
        percent: 300,
        fill: 100,
        hasTarget: true,
      });
    });

    test("exactly at the target", () => {
      expect(thermometerFigures(5, 5)).toEqual({
        done: 5,
        target: 5,
        percent: 100,
        fill: 100,
        hasTarget: true,
      });
    });

    test("a target of 0, missing, negative, NaN or infinite is no target", () => {
      const none = {
        done: 2,
        target: 0,
        percent: 0,
        fill: 0,
        hasTarget: false,
      };
      expect(thermometerFigures(2, 0)).toEqual(none);
      expect(thermometerFigures(2, undefined)).toEqual(none);
      expect(thermometerFigures(2, -4)).toEqual(none);
      expect(thermometerFigures(2, NaN)).toEqual(none);
      expect(thermometerFigures(2, Infinity)).toEqual(none);
    });

    test("a negative, NaN or infinite count reads as 0", () => {
      const zero = {
        done: 0,
        target: 4,
        percent: 0,
        fill: 0,
        hasTarget: true,
      };
      expect(thermometerFigures(-1, 4)).toEqual(zero);
      expect(thermometerFigures(NaN, 4)).toEqual(zero);
      expect(thermometerFigures(Infinity, 4)).toEqual(zero);
    });

    test("a non-integer count is shown as it is and rounded into the percentage", () => {
      expect(thermometerFigures(2.5, 4)).toEqual({
        done: 2.5,
        target: 4,
        percent: 63,
        fill: 63,
        hasTarget: true,
      });
    });
  });

  test("NaN inputs render as a no-target bar, never as 'NaN'", () => {
    render(
      <ProgressThermometer numerator={NaN} denominator={NaN} label="Done" />,
    );
    expect(text().textContent).toBe("Done: 0 so far, no target set yet");
    expect(fill()).toHaveStyle({ width: "0%" });
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
  });
});
