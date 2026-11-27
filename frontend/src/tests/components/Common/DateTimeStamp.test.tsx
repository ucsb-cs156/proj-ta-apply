import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import DateTimeStamp from "main/components/Common/DateTimeStamp";

describe("DateTimeStamp tests", () => {
  test.each([null, undefined, ""])("renders nothing for %j", (nothing) => {
    const { container } = render(<DateTimeStamp stamp={nothing} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("DateTimeStamp")).not.toBeInTheDocument();
  });

  test("shows the date over the time, small and muted, with the full stamp as the tooltip", () => {
    render(<DateTimeStamp stamp="2026-11-21T08:05:00" />);

    const stamp = screen.getByTestId("DateTimeStamp");
    expect(stamp.tagName).toBe("SMALL");
    expect(stamp).toHaveClass("text-muted", "d-block");
    expect(stamp).toHaveAttribute("title", "11/21/2026, 8:05:00 AM");

    const date = screen.getByTestId("DateTimeStamp-date");
    const time = screen.getByTestId("DateTimeStamp-time");
    expect(date).toHaveTextContent("11/21/26");
    expect(time).toHaveTextContent("8:05 AM");
    // each on its own line
    expect(date).toHaveClass("d-block");
    expect(time).toHaveClass("d-block");
    expect(stamp).toContainElement(date);
    expect(stamp).toContainElement(time);
    expect(date.compareDocumentPosition(time)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(stamp).toHaveTextContent(/^11\/21\/268:05 AM$/);
  });

  test.each([
    // the two kinds of stamp the API sends: zone-less Pacific, and an instant with a zone
    ["2026-07-04T15:30:00", "07/04/26", "3:30 PM"],
    ["2026-01-01T00:00", "01/01/26", "12:00 AM"],
    ["2026-11-02T03:30:00Z", "11/01/26", "7:30 PM"],
  ])("formats %s as %s and %s", (stamp, date, time) => {
    render(<DateTimeStamp stamp={stamp} />);
    expect(screen.getByTestId("DateTimeStamp-date")).toHaveTextContent(date);
    expect(screen.getByTestId("DateTimeStamp-time")).toHaveTextContent(time);
  });

  test("the test ids take the given prefix", () => {
    render(<DateTimeStamp stamp="2026-11-21T08:05:00" testIdPrefix="row-3" />);
    expect(screen.getByTestId("row-3")).toBeInTheDocument();
    expect(screen.getByTestId("row-3-date")).toHaveTextContent("11/21/26");
    expect(screen.getByTestId("row-3-time")).toHaveTextContent("8:05 AM");
    expect(screen.queryByTestId("DateTimeStamp")).not.toBeInTheDocument();
  });
});
