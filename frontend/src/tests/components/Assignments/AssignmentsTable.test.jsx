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

describe("AssignmentsTable wide columns (issue #342)", () => {
  test("a long text column in the identity headers is wide and resizable; the others are not", () => {
    const withNotes = {
      ...page,
      identityHeaders: [...page.identityHeaders, "comments"],
      rows: page.rows.map((row) => ({
        ...row,
        identity: { ...row.identity, comments: "Anything else" },
      })),
    };
    render(
      <AssignmentsTable data={withNotes} onAssign={vi.fn()} testIdPrefix="W" />,
    );
    expect(screen.getByTestId("W-header-comments").style.width).toBe("400px");
    expect(screen.getByTestId("W-header-comments-resize")).toHaveAttribute(
      "aria-valuemin",
      "200",
    );
    expect(screen.getByTestId("W-header-email").style.width).toBe("");
    expect(screen.queryByTestId("W-header-email-resize")).toBeNull();
  });

  test("the usual columns have no handle", () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="N" />,
    );
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });
});

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
    // Issue #355: "Tentative" stacked over "Assignment".
    const tentative = screen.getByTestId("T-header-tentativeAssignment");
    expect(tentative).toHaveTextContent("Tentative Assignment");
    const stackedHeading = tentative.querySelector("br").parentElement;
    expect(stackedHeading.innerHTML).toBe("Tentative <br>Assignment");
    expect(stackedHeading.style.fontSize).toBe("80%");

    expect(screen.getByTestId("T-course-10-header")).toContainElement(
      screen.getByTestId("T-course-10-left"),
    );
    // Issue #355: no CMPSC, and no section when the course has only one.
    expect(screen.getByTestId("T-course-10-label").textContent).toBe("  8");
    expect(screen.getByTestId("T-course-20-label").textContent).toBe(" 16");
    expect(screen.getByTestId("T-course-10-allocation").textContent).toBe(
      "Allocation 2",
    );
    expect(screen.getByTestId("T-course-10-assigned").textContent).toBe(
      "  Assigned 1",
    );
    expect(screen.getByTestId("T-course-10-left").textContent).toBe(
      "      Left 1",
    );
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
    expect(screen.getByTestId("T-course-30-label").textContent).toBe(
      " 24not offered",
    );
  });

  // ---- issue #355: compact, aligned lecture names and narrower columns ----

  const manyCourses = assignmentsFixtures.taPageManyCourses;

  test("lecture headings carry the section only where a course has two, padded so the parentheses line up", () => {
    render(
      <AssignmentsTable
        data={manyCourses}
        onAssign={vi.fn()}
        testIdPrefix="M"
      />,
    );
    expect(
      manyCourses.courses.map(
        (course) =>
          screen.getByTestId(`M-course-${course.id}-label`).textContent,
      ),
    ).toEqual([
      "  5A",
      "  5B",
      "  8   (0100)",
      "  8   (0200)",
      " 16",
      "130A",
      "130B",
      "190DD (0100)",
      "190DD (0200)",
    ]);
    // The counts line up under the name, their labels right-aligned to "Allocation".
    expect(screen.getByTestId("M-course-105-allocation").textContent).toBe(
      "Allocation 1",
    );
    expect(screen.getByTestId("M-course-105-assigned").textContent).toBe(
      "  Assigned 2",
    );
    expect(screen.getByTestId("M-course-105-left").textContent).toBe(
      "      Left -1",
    );
  });

  test("a lecture heading is monospace with its spaces kept, and as wide as the longest possible name", () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );
    const header = screen.getByTestId("T-course-10-header");
    expect(header).toHaveClass("font-monospace");
    expect(header.style.whiteSpace).toBe("pre");
    expect(header.style.minWidth).toBe("12ch");
    // The column itself is no wider than its heading: the slack goes to the applicant's columns.
    const th = screen.getByTestId("T-header-course-10");
    expect(th.style.width).toBe("1%");
    expect(th.style.whiteSpace).toBe("nowrap");
    expect(th.style.textAlign).toBe("right");
    const td = screen.getByTestId("T-cell-row-0-col-course-10");
    expect(td.style.width).toBe("1%");
    expect(td.style.whiteSpace).toBe("nowrap");
    expect(td.style.textAlign).toBe("right");
  });

  test("the dropdown lists the same names, their spaces non-breaking, in a monospace select just wide enough for the longest", () => {
    render(
      <AssignmentsTable
        data={manyCourses}
        onAssign={vi.fn()}
        testIdPrefix="M"
      />,
    );
    const select = screen.getByTestId("M-cell-row-0-tentative-select");
    const nbsp = (text) => text.replaceAll(" ", "\u00a0");
    expect(
      [...select.querySelectorAll("option")].map(
        (option) => option.textContent,
      ),
    ).toEqual([
      "",
      nbsp("  5A"),
      nbsp("  5B"),
      nbsp("  8   (0100)"),
      nbsp("  8   (0200)"),
      nbsp(" 16"),
      nbsp("130A"),
      nbsp("130B"),
      nbsp("190DD (0100)"),
      nbsp("190DD (0200)"),
    ]);
    expect(select).toHaveClass("font-monospace", "form-select-sm");
    expect(select.style.whiteSpace).toBe("pre");
    expect(select.style.width).toBe("calc(12ch + 2px + 2.75rem)");
    expect(select).toHaveValue("101");
  });

  test("the Tentative Assignment column is no wider than its dropdown (issue #355 replaces the 20em of issue #314)", () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );
    const th = screen.getByTestId("T-header-tentativeAssignment");
    expect(th.style.width).toBe("1%");
    expect(th.style.whiteSpace).toBe("nowrap");
    expect(th.style.minWidth).toBe("");
    const td = screen.getByTestId("T-cell-row-0-col-tentativeAssignment");
    expect(td.style.width).toBe("1%");
    expect(td.style.whiteSpace).toBe("nowrap");
    expect(td.style.minWidth).toBe("");
  });

  test("sorting by Tentative Assignment with the aligned names: course order, two sections in section order, blanks last", async () => {
    render(
      <AssignmentsTable
        data={manyCourses}
        onAssign={vi.fn()}
        testIdPrefix="M"
      />,
    );
    // Ada is in 5A, Grace and Alan in 16, the blank applicant in 8 (0100).
    await userEvent.click(
      screen.getByTestId("M-header-tentativeAssignment-sort-header"),
    );
    expect(emailsInOrder("M")).toEqual([
      "ada@ucsb.edu",
      "blank@ucsb.edu",
      "grace@ucsb.edu",
      "alan@ucsb.edu",
    ]);
    await userEvent.click(
      screen.getByTestId("M-header-tentativeAssignment-sort-header"),
    );
    expect(emailsInOrder("M")).toEqual([
      "grace@ucsb.edu",
      "alan@ucsb.edu",
      "blank@ucsb.edu",
      "ada@ucsb.edu",
    ]);
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
    expect(screen.getByTestId("T-cell-row-0-course-30-rank").textContent).toBe(
      "",
    );
    expect(screen.getByTestId("T-cell-row-0-col-course-10")).toHaveStyle({
      textAlign: "right",
    });
    expect(screen.getByTestId("T-cell-row-2-col-course-30")).toHaveTextContent(
      "1",
    );
    expect(screen.getByTestId("T-cell-row-3-col-firstName").textContent).toBe(
      "",
    );
    expect(screen.getByTestId("T-cell-row-3-course-10-rank").textContent).toBe(
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
      ["10", "\u00a0\u00a08"],
      ["20", "\u00a016"],
      ["30", "\u00a024\u00a0-\u00a0no\u00a0longer\u00a0offered"],
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
      "8Allocation 2 Assigned 1 Left 1",
    );

    // The second click reverses the order; applicants who tie (Grace and the blank applicant,
    // both unranked and not interested) keep the order they applied in.
    await userEvent.click(header);
    expect(emailsInOrder("T")).toEqual([
      "grace@ucsb.edu",
      "blank@ucsb.edu",
      "alan@ucsb.edu",
      "ada@ucsb.edu",
    ]);
    expect(screen.getByTestId("T-header-course-10")).toHaveTextContent(
      "8Allocation 2 Assigned 1 Left 1",
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

  test("each lecture column sorts on its own rank and the student's preference for that lecture (issue #345)", async () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );

    // CMPSC 16: Grace 1 and Ada 3 are ranked; Alan and the blank applicant are unranked and
    // marked nothing, so they keep the order they applied in.
    await userEvent.click(screen.getByTestId("T-header-course-20-sort-header"));
    expect(emailsInOrder("T")).toEqual([
      "grace@ucsb.edu",
      "ada@ucsb.edu",
      "alan@ucsb.edu",
      "blank@ucsb.edu",
    ]);

    // CMPSC 24: Alan is ranked; Grace (2nd choice, unranked) comes before Ada and the blank
    // applicant, who marked nothing. Alan is first here though he is unranked on CMPSC 16.
    await userEvent.click(screen.getByTestId("T-header-course-30-sort-header"));
    expect(emailsInOrder("T")).toEqual([
      "alan@ucsb.edu",
      "grace@ucsb.edu",
      "ada@ucsb.edu",
      "blank@ucsb.edu",
    ]);
  });

  test("unranked applicants sort by 1st choice, 2nd choice, Enthusiastic, Would Consider, then Not Interested, after the ranked ones", async () => {
    const row = (applicationId, email, rankings, preferences) => ({
      ...page.rows[3],
      applicationId,
      identity: { ...page.rows[3].identity, email },
      rankings,
      preferences,
    });
    const data = {
      ...page,
      rows: [
        row(1, "none@ucsb.edu", {}, {}),
        row(2, "consider@ucsb.edu", {}, { 10: "Would Consider" }),
        row(3, "enthusiastic@ucsb.edu", {}, { 10: "Enthusiastic" }),
        row(4, "second@ucsb.edu", {}, { 10: "2nd Choice" }),
        row(5, "first@ucsb.edu", {}, { 10: "1st Choice" }),
        row(6, "rankedNone@ucsb.edu", { 10: 2 }, {}),
        row(7, "ranked@ucsb.edu", { 10: 2 }, { 10: "1st Choice" }),
        row(8, "top@ucsb.edu", { 10: 1 }, { 10: "Would Consider" }),
        row(9, "storedNull@ucsb.edu", { 10: null }, { 10: "Not Interested" }),
      ],
    };
    render(
      <AssignmentsTable data={data} onAssign={vi.fn()} testIdPrefix="T" />,
    );

    await userEvent.click(screen.getByTestId("T-header-course-10-sort-header"));
    // Rank 1, then the two rank 2s by preference, then the unranked by preference; the last two
    // (nothing marked, and Not Interested) tie and stay in application order.
    expect(emailsInOrder("T")).toEqual([
      "top@ucsb.edu",
      "ranked@ucsb.edu",
      "rankedNone@ucsb.edu",
      "first@ucsb.edu",
      "second@ucsb.edu",
      "enthusiastic@ucsb.edu",
      "consider@ucsb.edu",
      "none@ucsb.edu",
      "storedNull@ucsb.edu",
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

    // Ada is in CMPSC 8, Grace and Alan in CMPSC 16, the blank applicant nowhere; natural order, the blank last.
    await userEvent.click(
      screen.getByTestId("T-header-tentativeAssignment-sort-header"),
    );
    expect(emailsInOrder("T")).toEqual([
      "ada@ucsb.edu",
      "grace@ucsb.edu",
      "alan@ucsb.edu",
      "blank@ucsb.edu",
    ]);
    // The dropdowns travel with their rows.
    expect(selectValuesInOrder("T")).toEqual(["10", "20", "20", ""]);
  });

  test("Tentative Assignment sorts the blank rows last ascending and first descending (issue #348)", async () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );
    const header = screen.getByTestId(
      "T-header-tentativeAssignment-sort-header",
    );
    await userEvent.click(header);
    expect(selectValuesInOrder("T")).toEqual(["10", "20", "20", ""]);
    await userEvent.click(header);
    // The blank row at the top, then the lectures in reverse; Grace and Alan tie and keep their order.
    expect(emailsInOrder("T")).toEqual([
      "blank@ucsb.edu",
      "grace@ucsb.edu",
      "alan@ucsb.edu",
      "ada@ucsb.edu",
    ]);
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
    // Descending: the blank first, then Ada's "  8".
    expect(emailsInOrder("T")).toEqual(["blank@ucsb.edu", "ada@ucsb.edu"]);
    // A choice no longer among the options shows as blank in the dropdown.
    expect(selectValuesInOrder("T")).toEqual(["", "10"]);
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
      "156Allocation 3  Assigned 0      Left 3",
    ]);
    expect(
      screen.getByTestId("AssignmentsTable-cell-row-0-col-gpaMajor"),
    ).toHaveTextContent("3.9");
    expect(
      screen.getByTestId("AssignmentsTable-cell-row-0-course-40-rank")
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

  // ---- issue #199: interest colours and symbols in the lecture cells ----

  test("lecture cells are coloured and marked by the applicant's interest, rank at the right", () => {
    render(
      <AssignmentsTable data={page} onAssign={vi.fn()} testIdPrefix="T" />,
    );
    const cell = (row, course) =>
      screen.getByTestId(`T-cell-row-${row}-course-${course}`);
    const mark = (row, course) =>
      screen.getByTestId(`T-cell-row-${row}-course-${course}-mark`);
    const rank = (row, course) =>
      screen.getByTestId(`T-cell-row-${row}-course-${course}-rank`);

    // Ada: 1st choice for CMPSC 8 (rank 1), Would Consider CMPSC 16 (rank 3), nothing for 24.
    expect(cell(0, 10).style.backgroundColor).toBe("rgb(209, 231, 221)");
    expect(mark(0, 10)).toHaveTextContent("➊");
    expect(mark(0, 10).style.fontSize).toBe("120%");
    expect(rank(0, 10)).toHaveTextContent("1");
    expect(cell(0, 20).style.backgroundColor).toBe("rgb(255, 243, 205)");
    expect(mark(0, 20)).toHaveTextContent("▬");
    expect(rank(0, 20)).toHaveTextContent("3");
    expect(cell(0, 30).style.backgroundColor).toBe("rgb(248, 215, 218)");
    expect(mark(0, 30)).toHaveTextContent("✖");
    expect(rank(0, 30).textContent).toBe("");
    // Grace: Enthusiastic about 16, 2nd choice 24.
    expect(cell(1, 20).style.backgroundColor).toBe("rgb(209, 231, 221)");
    expect(mark(1, 20)).toHaveTextContent("✓");
    expect(mark(1, 30)).toHaveTextContent("➋");
    expect(cell(0, 10)).toHaveClass(
      "d-flex",
      "justify-content-between",
      "align-items-center",
      "px-1",
    );
    expect(screen.getByTestId("T-cell-row-0-col-course-20")).toHaveStyle({
      textAlign: "right",
    });
    expect(mark(0, 10)).toHaveAttribute("title", "Applicant's 1st choice");
  });

  test("hidden columns leave out heading and cells and nothing else (issue #314)", () => {
    render(
      <AssignmentsTable
        data={page}
        onAssign={vi.fn()}
        hiddenColumns={["major", "course-20"]}
        testIdPrefix="T"
      />,
    );
    expect(screen.queryByTestId("T-header-major")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("T-cell-row-0-col-major"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("T-header-course-20")).not.toBeInTheDocument();
    expect(screen.queryByTestId("T-course-20-label")).not.toBeInTheDocument();
    expect(screen.getByTestId("T-header-email")).toBeInTheDocument();
    expect(screen.getByTestId("T-header-course-10")).toBeInTheDocument();
    expect(
      screen.getByTestId("T-cell-row-0-tentative-select"),
    ).toBeInTheDocument();
  });
});
