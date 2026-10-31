import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import AssignmentsTable from "main/components/Assignments/AssignmentsTable";
import assignmentsFixtures from "fixtures/assignmentsFixtures";

const page = assignmentsFixtures.taPage;

/** The rows as displayed, top to bottom (the test ids keep each row's original index). */
const bodyRows = (prefix) => [
  ...screen.getByTestId(prefix).querySelectorAll("tbody tr"),
];

const emailsInOrder = (prefix) =>
  bodyRows(prefix).map(
    (tr) => tr.querySelector("[data-testid$='-col-email']").textContent,
  );

const selectValuesInOrder = (prefix) =>
  bodyRows(prefix).map((tr) => tr.querySelector("select").value);

describe("AssignmentsTable tests (issue #179)", () => {
  test("headers: identity labels, the dropdown column, then a stacked heading per lecture", () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );

    const headers = [
      ...screen.getByTestId("T-header-group-0").querySelectorAll("th"),
    ].map((th) => th.getAttribute("data-testid"));
    expect(headers).toEqual([
      "T-header-firstName",
      "T-header-lastName",
      "T-header-email",
      "T-header-major",
      "T-header-classLevel",
      "T-header-yearInProgram",
      "T-header-graduationDate",
      "T-header-tentativeAssignment",
      "T-header-course-10",
      "T-header-course-20",
      "T-header-course-30",
    ]);
    expect(screen.getByTestId("T-header-firstName")).toHaveTextContent(
      "First Name",
    );
    expect(screen.getByTestId("T-header-classLevel")).toHaveTextContent(
      "Class Level",
    );
    expect(
      screen.getByTestId("T-header-tentativeAssignment"),
    ).toHaveTextContent("Tentative Assignment");

    expect(screen.getByTestId("T-course-10-header").style.minWidth).toBe("9em");
    expect(screen.getByTestId("T-course-10-header")).toContainElement(
      screen.getByTestId("T-course-10-left"),
    );
    expect(screen.getByTestId("T-course-10-label")).toHaveTextContent(
      "CMPSC 8 (0100)",
    );
    expect(screen.getByTestId("T-course-10-allocation")).toHaveTextContent(
      "Allocation 2",
    );
    expect(screen.getByTestId("T-course-10-assigned")).toHaveTextContent(
      "Assigned 1",
    );
    expect(screen.getByTestId("T-course-10-left")).toHaveTextContent("Left 1");
    expect(screen.getByTestId("T-course-10-left")).not.toHaveClass(
      "text-danger",
    );
    expect(screen.getByTestId("T-course-10-left")).toHaveClass(
      "small",
      "fw-normal",
    );
    expect(screen.getByTestId("T-course-20-left")).toHaveTextContent("Left -1");
    expect(screen.getByTestId("T-course-20-left")).toHaveClass(
      "small",
      "fw-normal",
      "text-danger",
    );
    expect(screen.getByTestId("T-course-30-left")).toHaveTextContent("Left 0");
    expect(screen.getByTestId("T-course-30-left")).not.toHaveClass(
      "text-danger",
    );
    // Only a lecture no longer offered carries the badge.
    expect(screen.getByTestId("T-course-30-historical")).toHaveTextContent(
      "not offered",
    );
    expect(screen.getByTestId("T-course-30-historical")).toHaveClass(
      "bg-secondary",
    );
    expect(screen.queryByTestId("T-course-10-historical")).toBeNull();
    expect(screen.queryByTestId("T-course-20-historical")).toBeNull();
    expect(screen.getByTestId("T-course-30-label")).toHaveTextContent(
      "CMPSC 24 (0100)not offered",
    );
  });

  test("cells: identity text, each lecture's rank or blank, centred ranks", () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );

    expect(screen.getByTestId("T-cell-row-0-col-firstName")).toHaveTextContent(
      "Ada",
    );
    expect(screen.getByTestId("T-cell-row-0-col-lastName")).toHaveTextContent(
      "Lovelace",
    );
    expect(screen.getByTestId("T-cell-row-0-col-email")).toHaveTextContent(
      "ada@ucsb.edu",
    );
    expect(screen.getByTestId("T-cell-row-0-col-major")).toHaveTextContent(
      "Computer Science",
    );
    expect(screen.getByTestId("T-cell-row-0-col-classLevel")).toHaveTextContent(
      "PHD",
    );
    expect(
      screen.getByTestId("T-cell-row-0-col-yearInProgram"),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId("T-cell-row-0-col-graduationDate"),
    ).toHaveTextContent("Spring 2027");
    expect(screen.getByTestId("T-cell-row-0-col-course-10")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("T-cell-row-0-col-course-20")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("T-cell-row-0-col-course-30").textContent).toBe(
      "",
    );
    expect(screen.getByTestId("T-cell-row-0-col-course-10")).toHaveStyle({
      textAlign: "center",
    });
    expect(screen.getByTestId("T-cell-row-2-col-course-30")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("T-cell-row-3-col-firstName").textContent).toBe(
      "",
    );
    expect(screen.getByTestId("T-cell-row-3-col-course-10").textContent).toBe(
      "",
    );
    // A stored null rank reads as unranked.
    expect(
      screen.getByTestId("T-cell-row-0-col-firstName").closest("table"),
    ).toHaveAttribute("data-testid", "T");
  });

  test("the dropdown lists blank then every lecture, shows the row's choice and reports a change", async () => {
    const onAssign = vi.fn();
    render(
      <AssignmentsTable data={page} onAssign={onAssign} testIdPrefix="T" />,
    );

    const select = screen.getByTestId("T-cell-row-0-tentative-select");
    expect(
      screen.getByTestId("T-cell-row-0-col-tentativeAssignment"),
    ).toContainElement(select);
    expect(select).toHaveAttribute(
      "aria-label",
      "Tentative assignment for ada@ucsb.edu",
    );
    expect(select).toHaveClass("form-select", "form-select-sm");
    expect(
      [...select.querySelectorAll("option")].map((option) => [
        option.value,
        option.textContent,
      ]),
    ).toEqual([
      ["", ""],
      ["10", "CMPSC 8 (0100)"],
      ["20", "CMPSC 16 (0100)"],
      ["30", "CMPSC 24 (0100) - no longer offered"],
    ]);
    expect(select).toHaveValue("10");
    expect(screen.getByTestId("T-cell-row-1-tentative-select")).toHaveValue(
      "20",
    );
    expect(screen.getByTestId("T-cell-row-3-tentative-select")).toHaveValue("");

    await userEvent.selectOptions(select, "30");
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect(onAssign).toHaveBeenCalledWith(1, 30);

    await userEvent.selectOptions(
      screen.getByTestId("T-cell-row-1-tentative-select"),
      "",
    );
    expect(onAssign).toHaveBeenCalledTimes(2);
    expect(onAssign).toHaveBeenLastCalledWith(2, null);
  });

  test("sorting by a lecture puts the unranked last in both directions and leaves the heading counts alone", async () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );
    expect(emailsInOrder("T")).toEqual([
      "ada@ucsb.edu",
      "grace@ucsb.edu",
      "alan@ucsb.edu",
      "blank@ucsb.edu",
    ]);

    // CMPSC 8 ranked Ada 1 and Alan 2; Grace and the blank applicant are unranked.
    const header = screen.getByTestId("T-header-course-10-sort-header");
    await userEvent.click(header);
    expect(emailsInOrder("T")).toEqual([
      "ada@ucsb.edu",
      "alan@ucsb.edu",
      "grace@ucsb.edu",
      "blank@ucsb.edu",
    ]);
    expect(screen.getByTestId("T-header-course-10")).toHaveTextContent(
      "CMPSC 8 (0100)Allocation 2Assigned 1Left 1",
    );

    await userEvent.click(header);
    expect(emailsInOrder("T")).toEqual([
      "alan@ucsb.edu",
      "ada@ucsb.edu",
      "grace@ucsb.edu",
      "blank@ucsb.edu",
    ]);
    expect(screen.getByTestId("T-header-course-10")).toHaveTextContent(
      "CMPSC 8 (0100)Allocation 2Assigned 1Left 1",
    );

    // A third click clears the sort.
    await userEvent.click(header);
    expect(emailsInOrder("T")).toEqual([
      "ada@ucsb.edu",
      "grace@ucsb.edu",
      "alan@ucsb.edu",
      "blank@ucsb.edu",
    ]);
  });

  test("identity and Tentative Assignment columns sort by their text", async () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );

    await userEvent.click(screen.getByTestId("T-header-lastName-sort-header"));
    expect(emailsInOrder("T")).toEqual([
      "blank@ucsb.edu",
      "grace@ucsb.edu",
      "ada@ucsb.edu",
      "alan@ucsb.edu",
    ]);
    await userEvent.click(screen.getByTestId("T-header-lastName-sort-header"));
    expect(emailsInOrder("T")).toEqual([
      "alan@ucsb.edu",
      "ada@ucsb.edu",
      "grace@ucsb.edu",
      "blank@ucsb.edu",
    ]);
    await userEvent.click(screen.getByTestId("T-header-lastName-sort-header"));

    // Ada is in CMPSC 8, Grace and Alan in CMPSC 16, the blank applicant nowhere; text order.
    await userEvent.click(
      screen.getByTestId("T-header-tentativeAssignment-sort-header"),
    );
    expect(emailsInOrder("T")).toEqual([
      "blank@ucsb.edu",
      "grace@ucsb.edu",
      "alan@ucsb.edu",
      "ada@ucsb.edu",
    ]);
    // The dropdowns travel with their rows.
    expect(selectValuesInOrder("T")).toEqual(["", "20", "20", "10"]);
  });

  test("a row pencilled into a lecture no longer listed sorts as blank", async () => {
    const data = {
      ...page,
      rows: [{ ...page.rows[3], tentativeAssignment: 999 }, page.rows[0]],
    };
    render(
      <AssignmentsTable data={data} onAssign={vi.fn()} testIdPrefix="T" />,
    );
    await userEvent.click(
      screen.getByTestId("T-header-tentativeAssignment-sort-header"),
    );
    await userEvent.click(
      screen.getByTestId("T-header-tentativeAssignment-sort-header"),
    );
    // Descending: Ada's "CMPSC 8 (0100)" before the blank.
    expect(emailsInOrder("T")).toEqual(["ada@ucsb.edu", "blank@ucsb.edu"]);
    // A choice no longer among the options shows as blank in the dropdown.
    expect(selectValuesInOrder("T")).toEqual(["10", ""]);
  });

  test("ULA page: its own identity columns and a null rank shown as blank; default test id", () => {
    render(
      <AssignmentsTable
        data={assignmentsFixtures.ulaPage}
        onAssign={vi.fn()}
      />,
    );
    const table = screen.getByTestId("AssignmentsTable");
    const headers = [
      ...within(table)
        .getByTestId("AssignmentsTable-header-group-0")
        .querySelectorAll("th"),
    ].map((th) => th.textContent);
    expect(headers).toEqual([
      "First Name",
      "Last Name",
      "Email",
      "Major",
      "Year in Program",
      "Graduation Date",
      "GPA (Major)",
      "GPA (Overall)",
      "Previous ULA Quarters",
      "Tentative Assignment",
      "CMPSC 156 (0100)Allocation 3Assigned 0Left 3",
    ]);
    expect(
      screen.getByTestId("AssignmentsTable-cell-row-0-col-gpaMajor"),
    ).toHaveTextContent("3.9");
    expect(
      screen.getByTestId("AssignmentsTable-cell-row-0-col-course-40")
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AssignmentsTable-cell-row-0-tentative-select"),
    ).toHaveValue("");
  });

  test("an empty page has headers and no rows", () => {
    render(
      <AssignmentsTable
        data={assignmentsFixtures.empty}
        onAssign={vi.fn()}
        testIdPrefix="T"
      />,
    );
    expect(
      screen.getByTestId("T-header-tentativeAssignment"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("T-cell-row-0-col-email")).toBeNull();
    expect(screen.queryByTestId("T-header-course-10")).toBeNull();
  });
});
