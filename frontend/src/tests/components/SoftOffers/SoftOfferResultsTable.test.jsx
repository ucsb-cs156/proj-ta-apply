import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SoftOfferResultsTable from "main/components/SoftOffers/SoftOfferResultsTable";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import {
  RESULTS_COLUMN_IDS,
  UNASSIGNED_COLUMN_IDS,
  columnChoices,
} from "main/utils/softOfferResultsColumns";

const T = "Results";
const { three } = softOfferResultsFixtures;
/** The page's choices: the main table's columns but First name and Last name. */
const choices = columnChoices(RESULTS_COLUMN_IDS, three.headers);

const renderTable = (props = {}) => {
  const onHide = vi.fn();
  render(
    <SoftOfferResultsTable
      headers={three.headers}
      rows={three.rows}
      columnIds={RESULTS_COLUMN_IDS}
      hiddenColumns={[]}
      choices={choices}
      onHide={onHide}
      testIdPrefix={T}
      {...props}
    />,
  );
  return onHide;
};

const cell = (row, column) =>
  screen.getByTestId(`${T}-cell-row-${row}-col-${column}`);

/** Renders with the window this wide, then puts the width back. */
const renderAtWidth = (width, props = {}) => {
  const before = window.innerWidth;
  window.innerWidth = width;
  try {
    return renderTable(props);
  } finally {
    window.innerWidth = before;
  }
};

describe("SoftOfferResultsTable tests (issue #494)", () => {
  test("the headings are the backend's, in order, with the given ids; the cells are the rows", () => {
    renderTable();

    RESULTS_COLUMN_IDS.forEach((id, i) => {
      expect(
        screen.getByTestId(`${T}-header-${id}-sort-header`),
      ).toHaveTextContent(three.headers[i]);
    });
    expect(screen.getAllByRole("columnheader")).toHaveLength(15);
    expect(
      screen.getByTestId(`${T}-row-0`).querySelectorAll("td"),
    ).toHaveLength(15);
    // Issue #500: the five applicant columns, between Email and Course assignment.
    expect(cell(1, "permNumber")).toHaveTextContent("B234567");
    expect(cell(1, "previousServiceAsUla")).toHaveTextContent("0");
    expect(cell(1, "graduationDate")).toHaveTextContent("Winter 2027");
    expect(cell(0, "otherCampusJob")).toHaveTextContent("Not sure yet");
    expect(cell(1, "employeeId")).toHaveTextContent("12345678");
    expect(cell(0, "firstName")).toHaveTextContent("Grace");
    expect(cell(1, "comments")).toHaveTextContent("Yes!");
    expect(cell(2, "instructorEmail")).toHaveTextContent("Not mapped");
    // The table scrolls sideways rather than widening the page, and is only as wide as its content.
    expect(screen.getByTestId(T).parentElement).toHaveClass("table-responsive");
    expect(screen.getByTestId(T)).toHaveClass("w-auto");
  });

  test("a heading the backend did not send is the id", () => {
    renderTable({ headers: three.headers.slice(0, 14) });
    expect(
      screen.getByTestId(`${T}-header-comments-sort-header`),
    ).toHaveTextContent("comments");
  });

  test("an answer for another lecture is muted; the stamp is in Pacific with its late mark; other cells are plain", () => {
    renderTable();

    const stale = cell(0, "status");
    expect(stale).toHaveTextContent("Proceed (for CMPSC 8)");
    expect(stale.firstElementChild).toHaveClass("text-muted", "fst-italic");
    expect(cell(1, "status")).toHaveTextContent("Proceed");
    expect(cell(1, "status").querySelector("span")).toBeNull();
    expect(cell(2, "status")).toHaveTextContent("");
    expect(cell(0, "respondedAt")).toHaveTextContent("10/22/2025, 8:00:00 AM");
    expect(cell(1, "respondedAt")).toHaveTextContent(
      "10/26/2025, 9:00:00 AM (late)",
    );
    expect(cell(2, "respondedAt")).toHaveTextContent("");
    // The comments cell holds a stamp-like text, and is left as it is.
    expect(cell(0, "comments")).toHaveTextContent(
      "2025-10-22T08:00 call me (for details)",
    );
  });

  test("the columns sort: Offer Status by its text", async () => {
    renderTable();

    await userEvent.click(screen.getByTestId(`${T}-header-status-sort-header`));
    expect(
      [...screen.getAllByRole("row")]
        .slice(1)
        .map((row) => row.cells[12].textContent),
    ).toEqual(["", "Proceed", "Proceed (for CMPSC 8)"]);
  });

  test("hidden columns are left out of every row; only the choices have a hide link", async () => {
    const onHide = renderTable({ hiddenColumns: ["email", "comments"] });

    expect(screen.queryByTestId(`${T}-header-email`)).toBeNull();
    expect(screen.queryByTestId(`${T}-cell-row-0-col-comments`)).toBeNull();
    expect(
      screen.getByTestId(`${T}-row-0`).querySelectorAll("td"),
    ).toHaveLength(13);
    expect(screen.queryByTestId(`${T}-header-firstName-hide`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-lastName-hide`)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Hide / })).toHaveLength(11);
    await userEvent.click(screen.getByTestId(`${T}-header-status-hide`));
    expect(onHide).toHaveBeenCalledWith("status");
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  test("the second table's columns: its own column is outside the choices, so has no hide link", () => {
    renderTable({
      headers: three.unassignedHeaders,
      rows: three.unassigned,
      columnIds: UNASSIGNED_COLUMN_IDS,
      hiddenColumns: ["course", "status"],
    });

    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(cell(0, "courseAnswered")).toHaveTextContent("CMPSC 156");
    expect(screen.queryByTestId(`${T}-header-status`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-courseAnswered-hide`)).toBeNull();
    expect(screen.getByTestId(`${T}-header-email-hide`)).toBeInTheDocument();
    expect(cell(0, "respondedAt")).toHaveTextContent("10/23/2025, 10:30:00 AM");
  });

  test("Comments alone can be resized: it starts at 300px, wraps, and the handle says its bounds", () => {
    renderAtWidth(1000);

    expect(screen.getAllByRole("separator")).toHaveLength(1);
    const handle = screen.getByRole("separator", {
      name: "Resize Comments column",
    });
    expect(handle).toHaveAttribute("aria-valuenow", "300");
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "300px",
    );
    expect(cell(0, "comments")).toHaveStyle({
      width: "300px",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
    });
    expect(cell(0, "status")).not.toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  test("dragging Comments goes no narrower than 200px and no wider than 80% of the window", () => {
    renderAtWidth(1000);
    const handle = screen.getByTestId(`${T}-header-comments-resize`);
    const width = () => screen.getByTestId(`${T}-header-comments`).style.width;

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 600 });
    expect(width()).toBe("400px");
    expect(cell(1, "comments").style.width).toBe("400px");
    fireEvent.mouseMove(document, { clientX: 0 });
    expect(width()).toBe("200px");
    fireEvent.mouseMove(document, { clientX: 5000 });
    expect(width()).toBe("800px");
    fireEvent.mouseMove(document, { clientX: 1000 });
    expect(width()).toBe("800px");
    fireEvent.mouseMove(document, { clientX: 999 });
    expect(width()).toBe("799px");
    fireEvent.mouseUp(document, { clientX: 999 });
  });

  test("the maximum is 80% of the window at the time of rendering, and never under the minimum", async () => {
    renderAtWidth(500);
    const handle = screen.getByTestId(`${T}-header-comments-resize`);
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 5000 });
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "400px",
    );
    fireEvent.mouseUp(document, { clientX: 5000 });

    // From the keyboard too.
    handle.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "400px",
    );
    for (let i = 0; i < 12; i++) {
      await userEvent.keyboard("{ArrowLeft}");
    }
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "200px",
    );
  });

  test("on a window narrower than 250px Comments is pinned at 200px", () => {
    renderAtWidth(100);
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "200px",
    );
    const handle = screen.getByTestId(`${T}-header-comments-resize`);
    fireEvent.mouseDown(handle, { clientX: 0 });
    fireEvent.mouseMove(document, { clientX: 500 });
    expect(screen.getByTestId(`${T}-header-comments`).style.width).toBe(
      "200px",
    );
    fireEvent.mouseUp(document, { clientX: 500 });
  });
});
