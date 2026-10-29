import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AuditTrailTable from "main/components/AuditTrail/AuditTrailTable";
import auditTrailFixtures from "fixtures/auditTrailFixtures";

const [majorRow, courseRow, commentsRow] = auditTrailFixtures.threeRows;

function renderTable(props = {}) {
  render(<AuditTrailTable rows={auditTrailFixtures.threeRows} {...props} />);
}

describe("AuditTrailTable tests", () => {
  test("has the table's columns in order, with sorting left to the page", () => {
    renderTable();

    const headers = [...screen.getAllByRole("columnheader")].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      "id",
      "Edited",
      "ULA Application",
      "TA Application",
      "Field",
      "Old Value",
      "New Value",
    ]);
    // Headers are not clickable: the page sorts on the server.
    expect(
      screen.getByTestId("AuditTrailTable-header-id-sort-header"),
    ).not.toHaveStyle({ cursor: "pointer" });
  });

  test("shows each row's ids, time and field, with a null id as blank", () => {
    renderTable();

    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-id"),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-editedAt"),
    ).toHaveTextContent(new Date(majorRow.editedAt).toLocaleString());
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-ulaApplicationId")
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-taApplicationId"),
    ).toHaveTextContent("7");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-1-col-ulaApplicationId"),
    ).toHaveTextContent("9");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-1-col-taApplicationId")
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-fieldName"),
    ).toHaveTextContent("major");
  });

  test("a short value is shown whole, and a null value as blank, with no link", () => {
    renderTable();

    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-oldValue"),
    ).toHaveTextContent("Computer Science");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-newValue"),
    ).toHaveTextContent("Computer Engineering");
    expect(
      screen.queryByTestId("AuditTrailTable-cell-row-0-col-oldValue-see"),
    ).toBeNull();
    // The course row was added: no old value; the comments row was blanked: no new value.
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-1-col-oldValue").textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-2-col-newValue").textContent,
    ).toBe("");
  });

  test("a value over 30 characters is cut to 15 with an ellipsis and a [See value] link", () => {
    renderTable();

    const cell = screen.getByTestId("AuditTrailTable-cell-row-1-col-newValue");
    expect(cell).toHaveTextContent('{"id":21,"ucsbC... [See value]');
    expect(cell.textContent).not.toContain("courseNumber");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-1-col-newValue-see"),
    ).toHaveTextContent("[See value]");
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-2-col-oldValue"),
    ).toHaveTextContent("Happy to help w... [See value]");
  });

  test("a value of exactly 30 characters is shown whole", () => {
    renderTable({
      rows: [
        { ...majorRow, oldValue: "x".repeat(30), newValue: "y".repeat(31) },
      ],
    });

    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-oldValue"),
    ).toHaveTextContent("x".repeat(30));
    expect(
      screen.queryByTestId("AuditTrailTable-cell-row-0-col-oldValue-see"),
    ).toBeNull();
    expect(
      screen.getByTestId("AuditTrailTable-cell-row-0-col-newValue-see"),
    ).toBeInTheDocument();
  });

  test("[See value] opens the whole value in a modal, which closes again", async () => {
    renderTable();

    expect(screen.queryByTestId("AuditTrailTable-value-modal-body")).toBeNull();
    await userEvent.click(
      screen.getByTestId("AuditTrailTable-cell-row-1-col-newValue-see"),
    );

    const body = await screen.findByTestId("AuditTrailTable-value-modal-body");
    expect(body.textContent).toBe(courseRow.newValue);
    expect(
      screen.getByText("New Value of priorCoursework (audit trail row 2)"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByTestId("AuditTrailTable-value-modal-close"),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("AuditTrailTable-value-modal-body"),
      ).toBeNull(),
    );

    // A second link shows its own value and title.
    await userEvent.click(
      screen.getByTestId("AuditTrailTable-cell-row-2-col-oldValue-see"),
    );
    expect(
      (await screen.findByTestId("AuditTrailTable-value-modal-body"))
        .textContent,
    ).toBe(commentsRow.oldValue);
    expect(
      screen.getByText("Old Value of comments (audit trail row 1)"),
    ).toBeInTheDocument();
  });

  test("renders an empty table, tolerates a non-array, and takes a test id prefix", () => {
    renderTable({ rows: null, testIdPrefix: "AuditTrailPage-table" });

    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(
      screen.queryByTestId("AuditTrailPage-table-cell-row-0-col-id"),
    ).toBeNull();
  });
});
