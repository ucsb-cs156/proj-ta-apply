import { render, screen } from "@testing-library/react";
import RecruitmentAuditTrailTable from "main/components/Recruitments/RecruitmentAuditTrailTable";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";

describe("RecruitmentAuditTrailTable tests", () => {
  const headers = [
    "id",
    "Changed",
    "Changed By",
    "What Changed",
    "Old Value",
    "New Value",
  ];

  test("renders the headers and one row per change, in the order given", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.threeRows}
      />,
    );

    expect(
      [...screen.getAllByRole("columnheader")].map((th) => th.textContent),
    ).toEqual(headers);
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
    expect(cell(0, "changedAt").textContent).toBe("1/6/2026, 9:30:00 AM");
    expect(
      screen.queryByTestId("RecruitmentAuditTrailTable-cell-row-3-col-id"),
    ).toBeNull();
    // Not sortable by clicking: the page orders the rows.
    expect(screen.queryByText("🔼")).toBeNull();
    expect(
      screen.getByTestId("RecruitmentAuditTrailTable-header-id-sort-header"),
    ).not.toHaveStyle({ cursor: "pointer" });
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

  /** Issue #337: who made the change; a row from before that was recorded has a blank cell. */
  test("the Changed By column shows the editor's email, blank when there is none", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.threeRows}
      />,
    );
    const cell = (row) =>
      screen.getByTestId(
        `RecruitmentAuditTrailTable-cell-row-${row}-col-editorEmail`,
      );
    expect(cell(0)).toHaveTextContent("admin@ucsb.edu");
    expect(cell(1)).toHaveTextContent("admin@ucsb.edu");
    expect(cell(2).textContent).toBe("");
    expect(screen.queryByText("null")).toBeNull();
  });

  test("a row with no editor field at all (older than the column) is blank too", () => {
    const { editorEmail: _ignored, ...older } =
      recruitmentAuditTrailFixtures.threeRows[0];
    render(<RecruitmentAuditTrailTable rows={[older]} />);
    expect(
      screen.getByTestId(
        "RecruitmentAuditTrailTable-cell-row-0-col-editorEmail",
      ).textContent,
    ).toBe("");
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

  /** Issue #391: the Budget page's card lists two recruitments' changes, so it says which is which. */
  test("with showType, a Type column sits between Changed By and What Changed", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.hiringTargetRows}
        showType
      />,
    );

    expect(
      [...screen.getAllByRole("columnheader")].map((th) => th.textContent),
    ).toEqual([
      "id",
      "Changed",
      "Changed By",
      "Type",
      "What Changed",
      "Old Value",
      "New Value",
    ]);
    const cell = (row) =>
      screen.getByTestId(`RecruitmentAuditTrailTable-cell-row-${row}-col-type`);
    expect(cell(0)).toHaveTextContent("ULA");
    expect(cell(1)).toHaveTextContent("TA");
    expect(cell(2)).toHaveTextContent("TA");
    expect(
      screen.getByTestId(
        "RecruitmentAuditTrailTable-cell-row-0-col-whatChanged",
      ),
    ).toHaveTextContent("totalHiringTarget");
    // Shrunk to its content like the other leading columns.
    expect(
      screen.getByTestId("RecruitmentAuditTrailTable-header-type").style.width,
    ).toBe("1%");
  });

  test("with showType, a row with no type is blank, not null; without it there is no Type column", () => {
    const { type: _ignored, ...untyped } =
      recruitmentAuditTrailFixtures.hiringTargetRows[0];
    const { rerender } = render(
      <RecruitmentAuditTrailTable rows={[untyped]} showType />,
    );
    expect(
      screen.getByTestId("RecruitmentAuditTrailTable-cell-row-0-col-type")
        .textContent,
    ).toBe("");
    expect(screen.queryByText("null")).toBeNull();

    rerender(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.hiringTargetRows}
      />,
    );
    expect(screen.queryByText("Type")).toBeNull();
    expect(
      screen.queryByTestId("RecruitmentAuditTrailTable-cell-row-0-col-type"),
    ).toBeNull();
    expect(
      [...screen.getAllByRole("columnheader")].map((th) => th.textContent),
    ).toEqual(headers);
  });

  test("the table takes its natural width, so Old Value and New Value are no wider than their values (issue #201)", () => {
    render(
      <RecruitmentAuditTrailTable
        rows={recruitmentAuditTrailFixtures.threeRows}
      />,
    );

    const table = screen.getByTestId("RecruitmentAuditTrailTable");
    expect(table).toHaveClass("w-auto");
    expect(table).toHaveClass("table", "table-striped", "table-bordered");
    // The leading columns shrink to their content; the value columns are left to their contents.
    ["id", "changedAt", "editorEmail", "whatChanged"].forEach((id) => {
      expect(
        screen.getByTestId(`RecruitmentAuditTrailTable-header-${id}`).style
          .width,
      ).toBe("1%");
    });
    ["oldValue", "newValue"].forEach((id) => {
      expect(
        screen.getByTestId(`RecruitmentAuditTrailTable-header-${id}`).style
          .width,
      ).toBe("");
    });
  });
});
