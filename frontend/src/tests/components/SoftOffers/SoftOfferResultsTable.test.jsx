import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SoftOfferResultsTable from "main/components/SoftOffers/SoftOfferResultsTable";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
import {
  RESULTS_COLUMN_IDS,
  UNASSIGNED_COLUMN_IDS,
  columnChoices,
  layoutColumns,
} from "main/utils/softOfferResultsColumns";

const T = "Results";
const { three } = softOfferResultsFixtures;
/** The page's choices: the main table's columns but First name and Last name. */
const choices = columnChoices(RESULTS_COLUMN_IDS, three.headers);

/** The hiring columns' data (issue #509), with a spy for the saves. */
const hiringProps = (overrides = {}) => ({
  applicationIds: three.applicationIds,
  records: three.hiring,
  fundingSources: fundingSourcesFixtures.threeSources,
  onChange: vi.fn(),
  pending: null,
  ...overrides,
});

const renderTable = (props = {}) => {
  const onHide = vi.fn();
  const hiring = "hiring" in props ? props.hiring : hiringProps();
  const result = render(
    <SoftOfferResultsTable
      headers={three.headers}
      rows={three.rows}
      columnIds={RESULTS_COLUMN_IDS}
      hiddenColumns={[]}
      choices={choices}
      onHide={onHide}
      testIdPrefix={T}
      {...props}
      hiring={hiring}
    />,
  );
  return { onHide, hiring, ...result };
};

const cell = (row, column) =>
  screen.getByTestId(`${T}-cell-row-${row}-col-${column}`);
/** A hiring control's test id: see HiringCell. */
const controlId = (row, column, suffix = "") =>
  `${T}-hiring-row-${row}-${column}${suffix}`;
const control = (row, column, suffix = "") =>
  screen.getByTestId(controlId(row, column, suffix));
const checkbox = (row, column) => control(row, column, "-checkbox");
/** The first name in each body row, top to bottom. */
const firstNames = () =>
  [...screen.getAllByRole("row")]
    .slice(1)
    .map((row) => row.cells[0].textContent);

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

    layoutColumns(RESULTS_COLUMN_IDS, three.headers).forEach(
      ({ id, heading }) => {
        expect(
          screen.getByTestId(`${T}-header-${id}-sort-header`),
        ).toHaveTextContent(heading);
      },
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(24);
    expect(
      screen.getByTestId(`${T}-row-0`).querySelectorAll("td"),
    ).toHaveLength(24);
    // Issue #500: the five applicant columns, between Email and Course assignment.
    expect(cell(1, "permNumber")).toHaveTextContent("B234567");
    expect(cell(1, "previousServiceAsUla")).toHaveTextContent("0");
    expect(cell(1, "graduationDate")).toHaveTextContent("Winter 2027");
    expect(cell(0, "otherCampusJob")).toHaveTextContent("Not sure yet");
    expect(cell(1, "employeeId")).toHaveTextContent("12345678");
    expect(cell(0, "firstName")).toHaveTextContent("Grace");
    expect(cell(1, "comments")).toHaveTextContent("Yes!");
    expect(cell(2, "instructorEmail")).toHaveTextContent("Not mapped");
    // The text columns after Funding (issue #512) still read their own cells.
    expect(cell(0, "course")).toHaveTextContent("CMPSC 156");
    expect(cell(0, "instructor")).toHaveTextContent("CONRAD P");
    expect(cell(1, "firstTimeUla")).toHaveTextContent("yes");
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
        .map((row) => row.cells[13].textContent),
    ).toEqual(["", "Proceed", "Proceed (for CMPSC 8)"]);
  });

  test("hidden columns are left out of every row; only the choices have a hide link", async () => {
    const { onHide } = renderTable({ hiddenColumns: ["email", "comments"] });

    expect(screen.queryByTestId(`${T}-header-email`)).toBeNull();
    expect(screen.queryByTestId(`${T}-cell-row-0-col-comments`)).toBeNull();
    expect(
      screen.getByTestId(`${T}-row-0`).querySelectorAll("td"),
    ).toHaveLength(22);
    expect(screen.queryByTestId(`${T}-header-firstName-hide`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-lastName-hide`)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Hide / })).toHaveLength(20);
    await userEvent.click(screen.getByTestId(`${T}-header-status-hide`));
    expect(onHide).toHaveBeenCalledWith("status");
    expect(onHide).toHaveBeenCalledTimes(1);
    // A hiring column hides like the others.
    await userEvent.click(screen.getByTestId(`${T}-header-inUcpath-hide`));
    expect(onHide).toHaveBeenCalledWith("inUcpath");
  });

  test("the second table's columns: its own column is outside the choices, so has no hide link", () => {
    renderTable({
      headers: three.unassignedHeaders,
      rows: three.unassigned,
      columnIds: UNASSIGNED_COLUMN_IDS,
      hiddenColumns: ["course", "status"],
      hiring: undefined,
    });

    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(cell(0, "courseAnswered")).toHaveTextContent("CMPSC 156");
    expect(screen.queryByTestId(`${T}-header-status`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-courseAnswered-hide`)).toBeNull();
    expect(screen.getByTestId(`${T}-header-email-hide`)).toBeInTheDocument();
    expect(cell(0, "respondedAt")).toHaveTextContent("10/23/2025, 10:30:00 AM");
    expect(screen.queryByRole("checkbox")).toBeNull();
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

  // ---- Issue #510 ----

  const EDGE =
    "inset -2px 0 0 var(--bs-table-border-color), inset 0 0 0 9999px var(--bs-table-bg-state, var(--bs-table-bg-type, var(--bs-table-accent-bg)))";

  /** First name sits at the left edge and Last name after it, with the frozen part's edge. */
  const expectNamesFrozen = () => {
    for (const el of [
      screen.getByTestId(`${T}-header-firstName`),
      cell(0, "firstName"),
    ]) {
      expect(el.style.position).toBe("sticky");
      expect(el.style.left).toBe("0px");
      expect(el.style.width).toBe("150px");
      expect(el.style.backgroundColor).toBe("var(--bs-table-bg)");
      expect(el.style.boxShadow).toBe("");
    }
    for (const el of [
      screen.getByTestId(`${T}-header-lastName`),
      cell(0, "lastName"),
    ]) {
      expect(el.style.position).toBe("sticky");
      expect(el.style.left).toBe("150px");
      expect(el.style.width).toBe("150px");
      expect(el.style.boxShadow).toBe(EDGE);
    }
    expect(screen.getByTestId(`${T}-header-firstName`).style.zIndex).toBe("2");
    expect(cell(0, "lastName").style.zIndex).toBe("1");
    // The column after them scrolls under them (its heading is relative, for its hide link).
    expect(screen.getByTestId(`${T}-header-email`).style.position).toBe(
      "relative",
    );
    expect(screen.getByTestId(`${T}-header-email`).style.left).toBe("");
    expect(cell(0, "email").style.position).toBe("");
  };

  test("First name and Last name are frozen at the left of the main table, with the rest scrolling under them", () => {
    renderTable({ hiddenColumns: ["instructor", "comments"] });
    expectNamesFrozen();
    expect(cell(0, "status").style.position).toBe("");
    expect(cell(0, "funding").style.position).toBe("");
    // The headings still sort, and the names still sit first.
    expect(
      [...screen.getByTestId(`${T}-header-group-0`).querySelectorAll("th")]
        .slice(0, 3)
        .map((th) => th.getAttribute("data-testid")),
    ).toEqual([
      `${T}-header-firstName`,
      `${T}-header-lastName`,
      `${T}-header-email`,
    ]);
  });

  test("the second table freezes the same two columns", () => {
    renderTable({
      headers: three.unassignedHeaders,
      rows: three.unassigned,
      columnIds: UNASSIGNED_COLUMN_IDS,
      hiring: undefined,
    });
    expectNamesFrozen();
    expect(cell(0, "courseAnswered").style.position).toBe("");
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

  // ---- Issues #509 and #512: the hiring columns ----

  test("the hiring columns sit where the CSV puts them: Funding after Course assignment, the staff columns after Comments", () => {
    renderTable();

    const ids = [
      ...screen.getByTestId(`${T}-header-group-0`).querySelectorAll("th"),
    ].map((th) => th.getAttribute("data-testid").replace(`${T}-header-`, ""));
    expect(ids.slice(8, 11)).toEqual(["course", "funding", "instructor"]);
    expect(ids.slice(15)).toEqual([
      "comments",
      "formalOfferSent",
      "formalOfferAccepted",
      "newHireForm",
      "flsaConflictFound",
      "flsaConflictResolved",
      "inUcpath",
      "i9Complete",
      "staffComments",
    ]);
    expect(
      screen.getByTestId(`${T}-header-newHireForm-sort-header`),
    ).toHaveTextContent("New Hire form done (or not needed)");
    expect(
      screen.getByTestId(`${T}-header-flsaConflictResolved-sort-header`),
    ).toHaveTextContent("Other Campus Job FLSA conflict resolved");
  });

  test("each control shows its row's record: a box is ticked with its stamp's date and time under it, or unticked and bare", () => {
    renderTable();

    // Grace (application 11) has no record yet: everything blank.
    for (const id of [
      "formalOfferSent",
      "formalOfferAccepted",
      "flsaConflictFound",
      "flsaConflictResolved",
      "inUcpath",
      "i9Complete",
    ]) {
      expect(checkbox(0, id)).not.toBeChecked();
      expect(checkbox(0, id)).toBeEnabled();
      expect(
        screen.queryByTestId(controlId(0, id, "-stamp")),
      ).not.toBeInTheDocument();
    }
    expect(control(0, "newHireForm", "-select")).toHaveValue("");
    expect(control(0, "staffComments")).toHaveValue("");
    expect(control(0, "funding")).toHaveValue("");

    // Ada (12): sent 10/27 2:05 PM, accepted 10/28 9:30 AM, form Done 10/29 10:00 AM, in UCPath
    // 11/03 4:45 PM, no FLSA conflict, I-9 not yet, sub0, a comment.
    expect(checkbox(1, "formalOfferSent")).toBeChecked();
    expect(control(1, "formalOfferSent", "-stamp-date")).toHaveTextContent(
      "10/27/25",
    );
    expect(control(1, "formalOfferSent", "-stamp-time")).toHaveTextContent(
      "2:05 PM",
    );
    expect(checkbox(1, "formalOfferAccepted")).toBeChecked();
    expect(control(1, "formalOfferAccepted", "-stamp-date")).toHaveTextContent(
      "10/28/25",
    );
    expect(control(1, "formalOfferAccepted", "-stamp-time")).toHaveTextContent(
      "9:30 AM",
    );
    expect(control(1, "newHireForm", "-select")).toHaveValue("DONE");
    expect(control(1, "newHireForm", "-stamp-date")).toHaveTextContent(
      "10/29/25",
    );
    expect(control(1, "newHireForm", "-stamp-time")).toHaveTextContent(
      "10:00 AM",
    );
    expect(checkbox(1, "flsaConflictFound")).not.toBeChecked();
    expect(checkbox(1, "flsaConflictResolved")).not.toBeChecked();
    expect(checkbox(1, "inUcpath")).toBeChecked();
    expect(control(1, "inUcpath", "-stamp-date")).toHaveTextContent("11/03/25");
    expect(control(1, "inUcpath", "-stamp-time")).toHaveTextContent("4:45 PM");
    expect(checkbox(1, "i9Complete")).not.toBeChecked();
    expect(control(1, "funding")).toHaveValue("sub0");
    expect(control(1, "staffComments")).toHaveValue("Paperwork started.");

    // Alan (13): sent 10/21 8:15 AM, form Not needed 10/30 11:20 AM, FLSA conflict found 11:15 AM.
    expect(checkbox(2, "formalOfferSent")).toBeChecked();
    expect(control(2, "formalOfferSent", "-stamp-date")).toHaveTextContent(
      "10/21/25",
    );
    expect(control(2, "formalOfferSent", "-stamp-time")).toHaveTextContent(
      "8:15 AM",
    );
    expect(checkbox(2, "formalOfferAccepted")).not.toBeChecked();
    expect(control(2, "newHireForm", "-select")).toHaveValue("NOT_NEEDED");
    expect(control(2, "newHireForm", "-stamp-time")).toHaveTextContent(
      "11:20 AM",
    );
    expect(checkbox(2, "flsaConflictFound")).toBeChecked();
    expect(control(2, "flsaConflictFound", "-stamp-time")).toHaveTextContent(
      "11:15 AM",
    );
    expect(control(2, "funding")).toHaveValue("");
    expect(control(2, "staffComments")).toHaveValue("");

    // The controls are named by their headings, the labels out of the layout, with ids unique per
    // row and field; the Staff Comments box is a small two-line textarea.
    expect(checkbox(1, "formalOfferSent")).toHaveAccessibleName(
      "Formal Offer Sent",
    );
    expect(checkbox(1, "formalOfferSent")).toHaveAttribute(
      "id",
      `${T}-12-formalOfferSent`,
    );
    expect(checkbox(2, "formalOfferSent")).toHaveAttribute(
      "id",
      `${T}-13-formalOfferSent`,
    );
    expect(cell(1, "formalOfferSent").querySelector("label")).toBeNull();
    expect(control(1, "newHireForm", "-select")).toHaveAccessibleName(
      "New Hire form done (or not needed)",
    );
    expect(control(1, "funding")).toHaveAccessibleName("Funding");
    expect(control(1, "funding")).toHaveClass("form-select-sm");
    expect(control(1, "staffComments")).toHaveAccessibleName("Staff Comments");
    expect(control(1, "staffComments").tagName).toBe("TEXTAREA");
    expect(control(1, "staffComments")).toHaveAttribute("rows", "2");
    expect(control(1, "staffComments")).toHaveClass("form-control-sm");
    expect(control(1, "staffComments")).toHaveStyle({ minWidth: "220px" });
    expect(control(1, "staffComments")).toHaveAttribute(
      "id",
      `${T}-12-staffComments`,
    );
  });

  test("Funding lists a blank choice and every source by abbreviation, the explanation as the tooltip", () => {
    renderTable();

    const options = [...control(0, "funding").querySelectorAll("option")];
    expect(options.map((o) => o.value)).toEqual([
      "",
      "ds-gift",
      "sub0",
      "ula-gift",
    ]);
    expect(options.map((o) => o.textContent)).toEqual([
      "",
      "ds-gift",
      "sub0",
      "ula-gift",
    ]);
    expect(options.map((o) => o.title)).toEqual([
      "",
      "Data Science Gift",
      "Temporary Sub Zero",
      "Gift funding for ULAs",
    ]);
  });

  test("ticking a box saves true, unticking saves false, each with the row's application id and field", async () => {
    const { hiring } = renderTable();

    await userEvent.click(checkbox(0, "formalOfferSent"));
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 11,
      field: "FORMAL_OFFER_SENT",
      value: "true",
    });
    await userEvent.click(checkbox(1, "formalOfferAccepted"));
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 12,
      field: "FORMAL_OFFER_ACCEPTED",
      value: "false",
    });
    await userEvent.click(checkbox(2, "flsaConflictFound"));
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 13,
      field: "FLSA_CONFLICT_FOUND",
      value: "false",
    });
    await userEvent.click(checkbox(0, "flsaConflictResolved"));
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 11,
      field: "FLSA_CONFLICT_RESOLVED",
      value: "true",
    });
    await userEvent.click(checkbox(1, "inUcpath"));
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 12,
      field: "IN_UCPATH",
      value: "false",
    });
    await userEvent.click(checkbox(1, "i9Complete"));
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 12,
      field: "I9_COMPLETE",
      value: "true",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(6);
    // The box shows the record, not the click: it stays as it was until a new record arrives.
    expect(checkbox(0, "formalOfferSent")).not.toBeChecked();
  });

  test("New Hire form saves the choice, the blank one as an empty value", async () => {
    const { hiring } = renderTable();

    await userEvent.selectOptions(control(0, "newHireForm", "-select"), "DONE");
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 11,
      field: "NEW_HIRE_FORM",
      value: "DONE",
    });
    await userEvent.selectOptions(control(1, "newHireForm", "-select"), "");
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 12,
      field: "NEW_HIRE_FORM",
      value: "",
    });
    await userEvent.selectOptions(
      control(2, "newHireForm", "-select"),
      "Not needed",
    );
    // The same value again is still a save; the backend keeps the stamp.
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 13,
      field: "NEW_HIRE_FORM",
      value: "NOT_NEEDED",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(3);
  });

  test("Funding saves the abbreviation, the blank choice as an empty value", async () => {
    const { hiring } = renderTable();

    await userEvent.selectOptions(control(0, "funding"), "ds-gift");
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 11,
      field: "FUNDING_SOURCE",
      value: "ds-gift",
    });
    await userEvent.selectOptions(control(1, "funding"), "");
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 12,
      field: "FUNDING_SOURCE",
      value: "",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(2);
  });

  test("Staff Comments saves when the box loses focus with a changed text, on Ctrl+Enter and on Cmd+Enter, and not otherwise", async () => {
    const { hiring } = renderTable();

    // Leaving an unchanged box, or pressing Ctrl+Enter in it, saves nothing.
    await userEvent.click(control(1, "staffComments"));
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await userEvent.tab();
    expect(hiring.onChange).not.toHaveBeenCalled();

    await userEvent.type(control(0, "staffComments"), "Call first.");
    expect(control(0, "staffComments")).toHaveValue("Call first.");
    expect(hiring.onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 11,
      field: "STAFF_COMMENTS",
      value: "Call first.",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(1);
    // The draft stays until a new stored value arrives.
    expect(control(0, "staffComments")).toHaveValue("Call first.");

    // Clearing a stored comment saves the empty text.
    await userEvent.clear(control(1, "staffComments"));
    await userEvent.tab();
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 12,
      field: "STAFF_COMMENTS",
      value: "",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(2);

    // Ctrl+Enter and Cmd+Enter save without leaving; a plain Enter is a new line.
    await userEvent.type(control(2, "staffComments"), "Two{Enter}lines");
    expect(control(2, "staffComments")).toHaveValue("Two\nlines");
    expect(hiring.onChange).toHaveBeenCalledTimes(2);
    // Pressing Control itself is not Ctrl+Enter (one user, so Control stays held across calls).
    const user = userEvent.setup();
    await user.keyboard("{Control>}");
    expect(hiring.onChange).toHaveBeenCalledTimes(2);
    await user.keyboard("{Enter}{/Control}");
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 13,
      field: "STAFF_COMMENTS",
      value: "Two\nlines",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(3);
    expect(control(2, "staffComments")).toHaveFocus();
    expect(control(2, "staffComments")).toHaveValue("Two\nlines");
    await userEvent.type(control(2, "staffComments"), "!");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(hiring.onChange).toHaveBeenLastCalledWith({
      applicationId: 13,
      field: "STAFF_COMMENTS",
      value: "Two\nlines!",
    });
    expect(hiring.onChange).toHaveBeenCalledTimes(4);
    // Until the stored text changes the box still differs from it, so leaving it saves again.
    await userEvent.tab();
    expect(hiring.onChange).toHaveBeenCalledTimes(5);
  });

  test("a new stored comment replaces what was typed; the same stored comment leaves the draft alone", async () => {
    const { rerender, hiring } = renderTable();
    const rerenderWith = (records) =>
      rerender(
        <SoftOfferResultsTable
          headers={three.headers}
          rows={three.rows}
          columnIds={RESULTS_COLUMN_IDS}
          hiddenColumns={[]}
          choices={choices}
          onHide={vi.fn()}
          testIdPrefix={T}
          hiring={{ ...hiring, records }}
        />,
      );

    await userEvent.type(control(0, "staffComments"), "Draft");
    // A re-read that brings the same (blank) comment for Grace keeps her draft.
    rerenderWith({ ...three.hiring });
    expect(control(0, "staffComments")).toHaveValue("Draft");
    // The save's answer for Ada shows in her box.
    rerenderWith({
      ...three.hiring,
      12: { ...three.hiring[12], staffComments: "Done." },
    });
    expect(control(1, "staffComments")).toHaveValue("Done.");
    expect(control(0, "staffComments")).toHaveValue("Draft");
  });

  test("the control whose save is in flight is disabled; every other control is not", () => {
    const { rerender, hiring } = renderTable({
      hiring: hiringProps({
        pending: {
          applicationId: 11,
          field: "FORMAL_OFFER_SENT",
          value: "true",
        },
      }),
    });

    expect(checkbox(0, "formalOfferSent")).toBeDisabled();
    expect(checkbox(0, "formalOfferAccepted")).toBeEnabled();
    expect(checkbox(1, "formalOfferSent")).toBeEnabled();
    expect(control(0, "newHireForm", "-select")).toBeEnabled();
    expect(control(0, "funding")).toBeEnabled();
    expect(control(0, "staffComments")).toBeEnabled();

    const rerenderPending = (pending) =>
      rerender(
        <SoftOfferResultsTable
          headers={three.headers}
          rows={three.rows}
          columnIds={RESULTS_COLUMN_IDS}
          hiddenColumns={[]}
          choices={choices}
          onHide={vi.fn()}
          testIdPrefix={T}
          hiring={{ ...hiring, pending }}
        />,
      );
    rerenderPending({ applicationId: 12, field: "NEW_HIRE_FORM", value: "" });
    expect(control(1, "newHireForm", "-select")).toBeDisabled();
    expect(control(0, "newHireForm", "-select")).toBeEnabled();
    expect(checkbox(0, "formalOfferSent")).toBeEnabled();
    rerenderPending({ applicationId: 13, field: "STAFF_COMMENTS", value: "x" });
    expect(control(2, "staffComments")).toBeDisabled();
    expect(control(1, "staffComments")).toBeEnabled();
    rerenderPending({
      applicationId: 11,
      field: "FUNDING_SOURCE",
      value: "sub0",
    });
    expect(control(0, "funding")).toBeDisabled();
    expect(control(1, "funding")).toBeEnabled();
    rerenderPending(null);
    expect(control(0, "funding")).toBeEnabled();
  });

  test("sorting a stamped column puts the unticked rows together and the ticked ones in stamp order; the toggle reverses the whole", async () => {
    renderTable();
    expect(firstNames()).toEqual(["Grace", "Ada", "Alan"]);

    // Grace has no stamp; Alan was sent his offer on 10/21, Ada on 10/27.
    await userEvent.click(
      screen.getByTestId(`${T}-header-formalOfferSent-sort-header`),
    );
    expect(firstNames()).toEqual(["Grace", "Alan", "Ada"]);
    await userEvent.click(
      screen.getByTestId(`${T}-header-formalOfferSent-sort-header`),
    );
    expect(firstNames()).toEqual(["Ada", "Alan", "Grace"]);

    // New Hire form: blank (Grace), Done (Ada), Not needed (Alan).
    await userEvent.click(
      screen.getByTestId(`${T}-header-newHireForm-sort-header`),
    );
    expect(firstNames()).toEqual(["Grace", "Ada", "Alan"]);
    await userEvent.click(
      screen.getByTestId(`${T}-header-newHireForm-sort-header`),
    );
    expect(firstNames()).toEqual(["Alan", "Ada", "Grace"]);

    // Staff Comments as text: the two blanks keep their order, Ada's comment last.
    await userEvent.click(
      screen.getByTestId(`${T}-header-staffComments-sort-header`),
    );
    expect(firstNames()).toEqual(["Grace", "Alan", "Ada"]);
    // Funding: Ada's sub0 after the two blanks; descending puts her first.
    await userEvent.click(
      screen.getByTestId(`${T}-header-funding-sort-header`),
    );
    expect(firstNames()).toEqual(["Grace", "Alan", "Ada"]);
    await userEvent.click(
      screen.getByTestId(`${T}-header-funding-sort-header`),
    );
    expect(firstNames()).toEqual(["Ada", "Grace", "Alan"]);
    // The controls follow their rows.
    expect(checkbox(1, "formalOfferSent")).toBeChecked();
    expect(
      screen.getAllByRole("row")[1].cells[9].querySelector("select"),
    ).toHaveValue("sub0");
  });

  test("without the hiring data a hiring column's cells are empty, and sorting it does nothing", async () => {
    renderTable({ hiring: undefined });

    expect(cell(0, "formalOfferSent")).toBeEmptyDOMElement();
    expect(cell(1, "funding")).toBeEmptyDOMElement();
    expect(cell(2, "staffComments")).toBeEmptyDOMElement();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    await userEvent.click(
      screen.getByTestId(`${T}-header-formalOfferSent-sort-header`),
    );
    expect(firstNames()).toEqual(["Grace", "Ada", "Alan"]);
  });
});
