import { render, screen } from "@testing-library/react";
import RecruitmentAuditTrailTable from "main/components/Recruitments/RecruitmentAuditTrailTable";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";

describe("RecruitmentAuditTrailTable tests", () => {
  const headers = ["id", "Changed", "What Changed", "Old Value", "New Value"];

  test("renders the headers and one row per change, in the order given", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.threeRows}
      />,
    );

    headers.forEach((header) => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
    const cell = (row, col) =>
      screen.getByTestId(
        `RecruitmentAuditTrailTable-cell-row-${row}-col-${col}`,
      );
    expect(cell(0, "id")).toHaveTextContent("3");
    expect(cell(0, "whatChanged")).toHaveTextContent("actualOpeningDate");
    expect(cell(0, "newValue")).toHaveTextContent("2026-01-06");
    expect(cell(1, "whatChanged")).toHaveTextContent("applicationStatus");
    expect(cell(1, "oldValue")).toHaveTextContent("CLOSED");
    expect(cell(1, "newValue")).toHaveTextContent("OPEN");
    expect(cell(2, "whatChanged")).toHaveTextContent("created");
    // The date is shown in the viewer's locale, from the server's local date-time.
    expect(cell(0, "changedAt").textContent).toBe(
      new Date("2026-01-06T09:30:00").toLocaleString(),
    );
    expect(
      screen.queryByTestId("RecruitmentAuditTrailTable-cell-row-3-col-id"),
    ).toBeNull();
    // Not sortable by clicking: the page orders the rows.
    expect(screen.queryByText("🔼")).toBeNull();
  });

  test("a null value is shown blank, not as the word null", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.threeRows}
        testIdPrefix="Trail"
      />,
    );
    expect(
      screen.getByTestId("Trail-cell-row-0-col-oldValue").textContent,
    ).toBe("");
    expect(
      screen.getByTestId("Trail-cell-row-2-col-oldValue").textContent,
    ).toBe("");
    expect(
      screen.getByTestId("Trail-cell-row-2-col-newValue").textContent,
    ).toBe("");
    expect(screen.queryByText("null")).toBeNull();
  });

  test("a row without a timestamp gets a blank Changed cell", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={[
          { ...recruitmentAuditTrailFixtures.threeRows[2], changedAt: null },
        ]}
      />,
    );
    expect(
      screen.getByTestId("RecruitmentAuditTrailTable-cell-row-0-col-changedAt")
        .textContent,
    ).toBe("");
  });

  test("no rows, or something that is not a list, renders just the headers", () => {
    const { rerender } = render(<RecruitmentAuditTrailTable rows={[]} />);
    expect(screen.getByText("What Changed")).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentAuditTrailTable-cell-row-0-col-id"),
    ).toBeNull();

    rerender(<RecruitmentAuditTrailTable rows={undefined} />);
    expect(screen.getByText("What Changed")).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentAuditTrailTable-cell-row-0-col-id"),
    ).toBeNull();
  });
});
