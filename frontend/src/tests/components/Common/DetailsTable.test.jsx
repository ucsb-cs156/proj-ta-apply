import { render, screen } from "@testing-library/react";

import DetailsTable from "main/components/Common/DetailsTable";

const columns = [
  { label: "Quarter", value: "F26", text: "F26", testId: "D-quarter" },
  {
    label: "Faculty Ranking Deadline",
    value: "2026-11-04",
    text: "2026-11-04",
    testId: "D-deadline",
  },
  {
    label: "Title",
    value: <em>INTRO DATA SCI 2</em>,
    text: "INTRO DATA SCI 2",
  },
];

describe("DetailsTable tests", () => {
  test("renders a heading row and one row of values, sized to content", () => {
    render(<DetailsTable columns={columns} testIdPrefix="D" />);

    const table = screen.getByTestId("D");
    expect(table).toHaveClass(
      "table",
      "table-sm",
      "table-bordered",
      "w-auto",
      "align-middle",
    );
    expect(table.querySelectorAll("thead tr")).toHaveLength(1);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(screen.getByTestId("D-quarter")).toHaveTextContent("F26");
    expect(screen.getByTestId("D-deadline")).toHaveTextContent("2026-11-04");
    expect(screen.getByTestId("D-deadline").style.whiteSpace).toBe("nowrap");
    expect(table.querySelector("tbody em")).toHaveTextContent(
      "INTRO DATA SCI 2",
    );
    expect(table.querySelectorAll("tbody td")[2]).not.toHaveAttribute(
      "data-testid",
    );
  });

  test("stacks multi-word headings one word per line and centres them", () => {
    render(<DetailsTable columns={columns} testIdPrefix="D" />);

    const deadline = screen.getByTestId("D-heading-Faculty Ranking Deadline");
    expect(deadline.querySelectorAll("br")).toHaveLength(2);
    expect(deadline.textContent).toBe("FacultyRankingDeadline");
    expect(deadline).toHaveClass("text-center");
    expect(
      screen.getByTestId("D-heading-Quarter").querySelectorAll("br"),
    ).toHaveLength(0);
    expect(screen.getByTestId("D-heading-Quarter").textContent).toBe("Quarter");
  });

  test("a heading longer than its value is 80% size; a shorter one is not", () => {
    render(<DetailsTable columns={columns} testIdPrefix="D" />);

    expect(
      screen.getByTestId("D-heading-Faculty Ranking Deadline").style.fontSize,
    ).toBe("80%");
    expect(screen.getByTestId("D-heading-Quarter").style.fontSize).toBe("80%");
    expect(screen.getByTestId("D-heading-Title").style.fontSize).toBe("");
  });

  test("a heading exactly as long as its value keeps the normal size", () => {
    render(
      <DetailsTable
        columns={[{ label: "Section", value: "0100100", text: "0100100" }]}
        testIdPrefix="D"
      />,
    );
    expect(screen.getByTestId("D-heading-Section").style.fontSize).toBe("");
  });

  test("has a default test id prefix", () => {
    render(<DetailsTable columns={columns} />);
    expect(screen.getByTestId("DetailsTable")).toBeInTheDocument();
    expect(
      screen.getByTestId("DetailsTable-heading-Title"),
    ).toBeInTheDocument();
  });
});
