import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import InstructorFeedbackTable from "main/components/InstructorFeedback/InstructorFeedbackTable";
import {
  COPY_MISSING_LABEL,
  MISSING_HEADING,
  NO_EMAIL_ON_FILE,
  emailsCopiedText,
  missingFeedbackEmails,
  CHECKED_MARK,
  UNCHECKED_MARK,
  checkboxMark,
  COMMENTS_MIN_WIDTH,
  FEEDBACK_COLUMN_CHOICES,
  FEEDBACK_COLUMN_CLASS,
  FEEDBACK_COLUMNS_STORAGE_KEY,
  FEEDBACK_OPT_IN_COLUMNS,
  NOT_APPLICABLE,
  TOTALS_LABEL,
  commentsDefaultWidth,
  courseName,
  feedbackTotals,
  instructorText,
  yesNo,
} from "main/utils/instructorFeedbackColumns";
import adminInstructorFeedbackFixtures from "fixtures/adminInstructorFeedbackFixtures";

const rows = adminInstructorFeedbackFixtures.severalRecords;
const T = "InstructorFeedbackTable";

const renderTable = (props = {}) =>
  render(
    <InstructorFeedbackTable
      rows={rows}
      hiddenColumns={[]}
      onHide={vi.fn()}
      onCopyEmail={vi.fn()}
      {...props}
    />,
  );

const cell = (row, column) =>
  screen.getByTestId(`${T}-cell-row-${row}-col-${column}`);

/** The headings, left to right; the totals row's cells are th elements too, so thead alone. */
const headerCells = () =>
  within(screen.getByTestId(T).querySelector("thead")).getAllByRole(
    "columnheader",
  );

/** The text of one column, top to bottom, as the rows are now sorted (the totals row aside). */
const columnText = (column) =>
  [...screen.getByTestId(T).querySelectorAll("tbody tr")].map(
    (tr) =>
      within(tr)
        .getAllByRole("cell")
        .find((td) => td.dataset.testid.endsWith(`-col-${column}`)).textContent,
  );

const sortBy = (column) =>
  userEvent.click(screen.getByTestId(`${T}-header-${column}-sort-header`));

describe("InstructorFeedbackTable helpers", () => {
  test("yesNo", () => {
    expect(yesNo(true)).toBe("Yes");
    expect(yesNo(false)).toBe("No");
  });

  test("the missing-feedback helpers", () => {
    expect(MISSING_HEADING).toBe("No Feedback Yet From These Instructors");
    expect(COPY_MISSING_LABEL).toBe(
      "Copy emails of instructors that have not provided feedback",
    );
    expect(NO_EMAIL_ON_FILE).toBe("no email on file");
    expect(emailsCopiedText(1)).toBe("1 email copied to clipboard.");
    expect(emailsCopiedText(3)).toBe("3 emails copied to clipboard.");
    expect(
      missingFeedbackEmails(adminInstructorFeedbackFixtures.missing),
    ).toEqual(["jsmith@ucsb.edu", "klee@ucsb.edu"]);
    expect(missingFeedbackEmails([])).toEqual([]);
  });

  test("checkboxMark is a checked or an unchecked box", () => {
    expect(CHECKED_MARK).toBe("\u2612");
    expect(UNCHECKED_MARK).toBe("\u2610");
    expect(checkboxMark(true)).toBe("☒");
    expect(checkboxMark(false)).toBe("☐");
  });

  test("courseName writes the course number compactly, then the section", () => {
    expect(courseName(rows[0])).toBe("CMPSC 156 (0100)");
    expect(courseName(rows[1])).toBe("CMPSC   8 (0100)");
    expect(courseName({ ...rows[0], section: null })).toBe("CMPSC 156");
    expect(courseName({ ...rows[0], section: "" })).toBe("CMPSC 156");
  });

  test("instructorText is the name and email, or the email alone", () => {
    expect(instructorText(rows[0])).toBe("CONRAD P pconrad@ucsb.edu");
    expect(instructorText(rows[2])).toBe("newprof@ucsb.edu");
  });

  test("commentsDefaultWidth is 80% of the window, never under 200px", () => {
    expect(COMMENTS_MIN_WIDTH).toBe(200);
    expect(commentsDefaultWidth(1000)).toBe(800);
    expect(commentsDefaultWidth(250)).toBe(200);
    expect(commentsDefaultWidth(100)).toBe(200);
  });

  // Issue #473: the totals row's numbers.
  test("feedbackTotals counts the rows, says k/n per box and sums the allocations", () => {
    expect(feedbackTotals(rows)).toEqual({
      count: 4,
      allocReasonable: "1/4",
      differentTACount: "2/4",
      differentULACount: "2/4",
      otherConcerns: "2/4",
      taAllocation: 7,
      ulaAllocation: 10,
      // A blank preferred count stands for the current allocation; blank on both sides adds 0.
      numTAsPreferred: 10,
      numULAsPreferred: 10,
    });
    expect(feedbackTotals([])).toEqual({
      count: 0,
      allocReasonable: "0/0",
      differentTACount: "0/0",
      differentULACount: "0/0",
      otherConcerns: "0/0",
      taAllocation: 0,
      ulaAllocation: 0,
      numTAsPreferred: 0,
      numULAsPreferred: 0,
    });
    // One row checked everywhere, preferring more than it has.
    expect(feedbackTotals([rows[0]])).toEqual({
      count: 1,
      allocReasonable: "0/1",
      differentTACount: "1/1",
      differentULACount: "1/1",
      otherConcerns: "0/1",
      taAllocation: 3,
      ulaAllocation: 4,
      numTAsPreferred: 5,
      numULAsPreferred: 2,
    });
    expect(TOTALS_LABEL).toBe("Totals/Counts");
    expect(FEEDBACK_COLUMN_CLASS).toBe("instructor-feedback-column");
  });

  test("the column choices are every column but Course Name, in table order", () => {
    expect(FEEDBACK_COLUMN_CHOICES.map((c) => c.id)).toEqual([
      "instructor",
      "enrollment",
      "maxEnroll",
      "allocReasonable",
      "differentTACount",
      "taAllocation",
      "numTAsPreferred",
      "differentULACount",
      "ulaAllocation",
      "numULAsPreferred",
      "otherConcerns",
      "comments",
      "lastUpdated",
    ]);
    expect(FEEDBACK_COLUMN_CHOICES.map((c) => c.label)).toEqual([
      "Instructor",
      "Enrolled",
      "Max Enroll",
      "Alloc Reasonable",
      "Diff TA Count",
      "TA Allocation",
      "Preferred TA Allocation",
      "Diff ULA Count",
      "ULA Allocation",
      "Preferred ULA Allocation",
      "Other Concerns",
      "Comments",
      "Last Updated",
    ]);
    expect(FEEDBACK_COLUMNS_STORAGE_KEY).toBe(
      "instructorFeedback.hiddenColumns",
    );
    // Issue #477: the two columns that start hidden are choices like the others.
    expect(FEEDBACK_OPT_IN_COLUMNS).toEqual(["enrollment", "maxEnroll"]);
    for (const id of FEEDBACK_OPT_IN_COLUMNS) {
      expect(FEEDBACK_COLUMN_CHOICES.map((c) => c.id)).toContain(id);
    }
  });
});

describe("InstructorFeedbackTable", () => {
  test("has the columns in the issue's order, then Last Updated", () => {
    renderTable();
    const headers = headerCells().map((th) =>
      th.dataset.testid.replace(`${T}-header-`, ""),
    );
    expect(headers).toEqual([
      "course",
      "instructor",
      "enrollment",
      "maxEnroll",
      "allocReasonable",
      "differentTACount",
      "taAllocation",
      "numTAsPreferred",
      "differentULACount",
      "ulaAllocation",
      "numULAsPreferred",
      "otherConcerns",
      "comments",
      "lastUpdated",
    ]);
    const headings = headerCells().map(
      (th) => within(th).getByTestId(/-sort-header$/).textContent,
    );
    expect(headings).toEqual([
      "Course Name",
      "Instructor",
      "Enrolled",
      "Max Enroll",
      "Alloc Reasonable",
      "Diff TA Count",
      "TA Allocation",
      "Preferred TA Allocation",
      "Diff ULA Count",
      "ULA Allocation",
      "Preferred ULA Allocation",
      "Other Concerns",
      "Comments",
      "Last Updated",
    ]);
    // Every heading but Course Name, Instructor and Comments is two lines in the smaller class.
    for (const th of headerCells()) {
      const id = th.dataset.testid.replace(`${T}-header-`, "");
      const sortHeader = within(th).getByTestId(/-sort-header$/);
      const small = sortHeader.querySelector(
        ".instructor-feedback-stacked-heading",
      );
      if (["course", "instructor", "comments"].includes(id)) {
        expect(small, id).toBeNull();
        expect(sortHeader.querySelector("br"), id).toBeNull();
      } else {
        expect(small, id).not.toBeNull();
        // One word per line: a break between each pair of words.
        expect(small.querySelectorAll("br").length, id).toBe(
          small.textContent.split(" ").length - 1,
        );
        expect(small.getAttribute("style"), id).toBeNull();
      }
    }
    // Each word on its own line.
    const diffTa = screen.getByTestId(
      `${T}-header-differentTACount-sort-header`,
    ).firstChild;
    expect(diffTa.querySelectorAll("br")).toHaveLength(2);
    expect(diffTa.innerHTML).toBe("Diff <br>TA <br>Count");
    expect(
      screen.getByTestId(`${T}-header-course-sort-header`),
    ).toHaveTextContent(/^Course Name$/);
    expect(
      screen.getByTestId(`${T}-header-numULAsPreferred-sort-header`),
    ).toHaveTextContent(/^Preferred ULA Allocation$/);
    expect(screen.getByTestId(T)).toHaveClass("w-auto");
  });

  // Issue #473: the Totals/Counts row.
  test("ends with a Totals/Counts row under a thick line, blank under Comments and Last Updated", () => {
    renderTable();
    const footer = (column) => screen.getByTestId(`${T}-footer-${column}`);
    expect(footer("course")).toHaveTextContent(/^Totals\/Counts$/);
    expect(footer("course").querySelector("strong")).toHaveTextContent(
      "Totals/Counts",
    );
    expect(footer("instructor")).toHaveTextContent(/^4$/);
    expect(footer("allocReasonable")).toHaveTextContent(/^1\/4$/);
    expect(footer("differentTACount")).toHaveTextContent(/^2\/4$/);
    expect(footer("taAllocation")).toHaveTextContent(/^7$/);
    expect(footer("numTAsPreferred")).toHaveTextContent(/^10$/);
    expect(footer("differentULACount")).toHaveTextContent(/^2\/4$/);
    expect(footer("ulaAllocation")).toHaveTextContent(/^10$/);
    expect(footer("numULAsPreferred")).toHaveTextContent(/^10$/);
    expect(footer("otherConcerns")).toHaveTextContent(/^2\/4$/);
    expect(footer("comments")).toBeEmptyDOMElement();
    expect(footer("lastUpdated")).toBeEmptyDOMElement();
    // Issue #477: the enrollment figures have no total either.
    expect(footer("enrollment")).toBeEmptyDOMElement();
    expect(footer("maxEnroll")).toBeEmptyDOMElement();
    // The row is the table's last, in a tfoot, and every cell carries the class index.css draws
    // the thick black line on; the headings and body cells carry it too (harmlessly).
    const tfoot = footer("course").closest("tfoot");
    expect(tfoot).not.toBeNull();
    expect(screen.getByTestId(T).lastElementChild).toBe(tfoot);
    for (const th of tfoot.querySelectorAll("th")) {
      expect(th).toHaveClass(FEEDBACK_COLUMN_CLASS);
    }
    expect(screen.getByTestId(`${T}-header-comments`)).toHaveClass(
      FEEDBACK_COLUMN_CLASS,
    );
    expect(cell(0, "course")).toHaveClass(FEEDBACK_COLUMN_CLASS);
    // The numbers are right-aligned like their columns; the label and count are not.
    expect(footer("taAllocation")).toHaveStyle({ textAlign: "right" });
    expect(footer("course")).not.toHaveStyle({ textAlign: "right" });
    // Sorting does not change the totals.
    expect(footer("taAllocation")).toHaveTextContent("7");
  });

  test("the totals row follows the rows it is given, and hides with its columns", () => {
    renderTable({ rows: [rows[1], rows[2]], hiddenColumns: ["taAllocation"] });
    const footer = (column) => screen.getByTestId(`${T}-footer-${column}`);
    expect(footer("instructor")).toHaveTextContent(/^2$/);
    expect(footer("allocReasonable")).toHaveTextContent(/^1\/2$/);
    expect(footer("differentULACount")).toHaveTextContent(/^1\/2$/);
    // Row 2 has no TA allocation and no preferred count: it adds nothing to either.
    expect(footer("numTAsPreferred")).toHaveTextContent(/^2$/);
    expect(footer("ulaAllocation")).toHaveTextContent(/^6$/);
    expect(footer("numULAsPreferred")).toHaveTextContent(/^8$/);
    expect(screen.queryByTestId(`${T}-footer-taAllocation`)).toBeNull();
  });

  test("shows each record's values", () => {
    renderTable();
    expect(cell(0, "course")).toHaveTextContent(/^CMPSC 156 \(0100\)$/);
    const number = cell(0, "course").firstChild;
    expect(number).toHaveClass("instructor-feedback-course");
    expect(number.getAttribute("style")).toBeNull();
    expect(cell(0, "instructor")).toHaveTextContent(
      /^CONRAD Ppconrad@ucsb\.edu$/,
    );
    expect(
      screen.getByTestId(`${T}-cell-row-0-copy-email`),
    ).toHaveAccessibleName("Copy pconrad@ucsb.edu");
    expect(cell(0, "allocReasonable")).toHaveTextContent(/^☐$/);
    expect(
      within(cell(0, "allocReasonable")).getByRole("img", { name: "No" }),
    ).toHaveClass("instructor-feedback-checkmark");
    expect(cell(0, "differentTACount")).toHaveTextContent(/^☒$/);
    expect(
      within(cell(0, "differentTACount")).getByRole("img", { name: "Yes" }),
    ).toBeInTheDocument();
    expect(cell(0, "taAllocation")).toHaveTextContent(/^3$/);
    expect(cell(0, "numTAsPreferred")).toHaveTextContent(/^5$/);
    expect(cell(0, "differentULACount")).toHaveTextContent(/^☒$/);
    expect(cell(0, "ulaAllocation")).toHaveTextContent(/^4$/);
    expect(cell(0, "otherConcerns")).toHaveTextContent(/^☐$/);
    expect(cell(0, "numULAsPreferred")).toHaveTextContent(/^2$/);
    expect(cell(0, "comments")).toHaveTextContent(
      /^One more TA would let us open a fourth lab\.$/,
    );
    expect(cell(0, "lastUpdated")).toHaveTextContent(
      /^1\/12\/2026, 2:05:30 PM$/,
    );

    // TA only: no ULA allocation, and no counts or comments.
    expect(cell(1, "allocReasonable")).toHaveTextContent(/^☒$/);
    expect(cell(1, "ulaAllocation")).toHaveTextContent(
      new RegExp(`^${NOT_APPLICABLE}$`),
    );
    expect(cell(1, "numTAsPreferred")).toHaveTextContent(/^$/);
    expect(cell(1, "numULAsPreferred")).toHaveTextContent(/^$/);
    expect(cell(1, "comments")).toHaveTextContent(/^$/);

    // ULA only, and an instructor not in the list.
    expect(cell(2, "taAllocation")).toHaveTextContent(/^N\/A$/);
    expect(cell(2, "otherConcerns")).toHaveTextContent(/^☒$/);
    expect(cell(2, "instructor")).toHaveTextContent(/^newprof@ucsb\.edu$/);
    // The name, when known, is on its own line above the email.
    expect(cell(0, "instructor").querySelectorAll("br")).toHaveLength(1);
    expect(cell(2, "instructor").querySelectorAll("br")).toHaveLength(0);

    // An allocation of 0 is shown as 0.
    expect(cell(3, "ulaAllocation")).toHaveTextContent(/^0$/);
  });

  test("a record with no time saved shows a blank Last Updated, and sorts first", async () => {
    renderTable({ rows: [rows[0], { ...rows[1], lastUpdated: null }] });
    expect(cell(1, "lastUpdated")).toHaveTextContent(/^$/);
    await sortBy("lastUpdated");
    expect(columnText("lastUpdated")).toEqual(["", "1/12/2026, 2:05:30 PM"]);
  });

  test("the short columns shrink to their content, the numbers right-aligned", () => {
    renderTable();
    for (const id of [
      "course",
      "instructor",
      "allocReasonable",
      "lastUpdated",
    ]) {
      expect(screen.getByTestId(`${T}-header-${id}`).style.width, id).toBe(
        "1%",
      );
      expect(screen.getByTestId(`${T}-header-${id}`).style.whiteSpace, id).toBe(
        "nowrap",
      );
    }
    expect(cell(0, "taAllocation")).toHaveStyle({
      textAlign: "right",
      whiteSpace: "nowrap",
      width: "1%",
    });
  });

  test("Comments starts at 80% of the window, wraps, and resizes no narrower than 200px", async () => {
    const before = window.innerWidth;
    window.innerWidth = 1000;
    try {
      renderTable();
    } finally {
      window.innerWidth = before;
    }
    const head = screen.getByTestId(`${T}-header-comments`);
    expect(head.style.width).toBe("800px");
    expect(cell(3, "comments")).toHaveStyle({
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      width: "800px",
    });
    const handle = screen.getByRole("separator", {
      name: "Resize Comments column",
    });
    expect(handle).toHaveAttribute("aria-valuemin", "200");
    handle.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(head.style.width).toBe("820px");
    // Only Comments can be resized.
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  test("on a narrow window Comments starts at 200px and cannot go below it", async () => {
    const before = window.innerWidth;
    window.innerWidth = 100;
    try {
      renderTable();
    } finally {
      window.innerWidth = before;
    }
    const head = screen.getByTestId(`${T}-header-comments`);
    expect(head.style.width).toBe("200px");
    screen.getByRole("separator", { name: "Resize Comments column" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(head.style.width).toBe("200px");
  });

  test("every column sorts", async () => {
    renderTable();
    await sortBy("course");
    expect(columnText("course")).toEqual([
      "CMPSC   8 (0100)",
      "CMPSC  16 (0100)",
      "CMPSC 130A (0100)",
      "CMPSC 156 (0100)",
    ]);
    await sortBy("instructor");
    expect(columnText("instructor")[0]).toBe("CONRAD Ppconrad@ucsb.edu");
    // On the answer, not the character: checked first, then the other way.
    await sortBy("allocReasonable");
    expect(columnText("allocReasonable")).toEqual(["☒", "☐", "☐", "☐"]);
    await sortBy("allocReasonable");
    expect(columnText("allocReasonable")).toEqual(["☐", "☐", "☐", "☒"]);
    await sortBy("comments");
    expect(columnText("comments")[0]).toBe("");
    await sortBy("lastUpdated");
    expect(columnText("lastUpdated")[0]).toBe("1/10/2026, 9:00:00 AM");
  });

  test("a missing number sorts last both ways", async () => {
    renderTable();
    // Numbers sort largest first on the first click.
    await sortBy("taAllocation");
    expect(columnText("taAllocation")).toEqual(["3", "2", "2", "N/A"]);
    await sortBy("taAllocation");
    expect(columnText("taAllocation")).toEqual(["2", "2", "3", "N/A"]);
    await sortBy("numULAsPreferred");
    expect(columnText("numULAsPreferred")).toEqual(["8", "2", "", ""]);
  });

  test("Enrolled and Max Enroll show the section's figures, blank when none, and sort last (issue #477)", async () => {
    renderTable();
    expect(columnText("enrollment")).toEqual(["180", "410", "", "95"]);
    expect(columnText("maxEnroll")).toEqual(["200", "400", "", "120"]);
    // Headed like the other short columns: "Enrolled" on one line, "Max" over "Enroll".
    const enrolled = within(
      screen.getByTestId(`${T}-header-enrollment`),
    ).getByTestId(/-sort-header$/);
    expect(enrolled).toHaveTextContent(/^Enrolled$/);
    expect(
      enrolled.querySelector(".instructor-feedback-stacked-heading").innerHTML,
    ).toBe("Enrolled");
    const maxEnroll = within(
      screen.getByTestId(`${T}-header-maxEnroll`),
    ).getByTestId(/-sort-header$/);
    expect(maxEnroll).toHaveTextContent("Max Enroll");
    expect(
      maxEnroll.querySelector(".instructor-feedback-stacked-heading").innerHTML,
    ).toBe("Max <br>Enroll");
    // Numbers: right-aligned, shrunk to content.
    for (const id of ["enrollment", "maxEnroll"]) {
      expect(cell(0, id), id).toHaveStyle({
        textAlign: "right",
        whiteSpace: "nowrap",
        width: "1%",
      });
      expect(screen.getByTestId(`${T}-header-${id}`), id).toHaveClass(
        FEEDBACK_COLUMN_CLASS,
      );
    }
    // Largest first on the first click, smallest first on the second; a blank last either way.
    await sortBy("enrollment");
    expect(columnText("enrollment")).toEqual(["410", "180", "95", ""]);
    await sortBy("enrollment");
    expect(columnText("enrollment")).toEqual(["95", "180", "410", ""]);
    await sortBy("maxEnroll");
    expect(columnText("maxEnroll")).toEqual(["400", "200", "120", ""]);
    await sortBy("maxEnroll");
    expect(columnText("maxEnroll")).toEqual(["120", "200", "400", ""]);
    // Each has a hide link, like the other columns.
    expect(screen.getByTestId(`${T}-header-enrollment-hide`)).toHaveAttribute(
      "aria-label",
      "Hide Enrolled column",
    );
    expect(screen.getByTestId(`${T}-header-maxEnroll-hide`)).toHaveAttribute(
      "aria-label",
      "Hide Max Enroll column",
    );
  });

  test("Enrolled and Max Enroll are left out when hidden, as the page hides them at first", () => {
    renderTable({ hiddenColumns: FEEDBACK_OPT_IN_COLUMNS });
    expect(screen.queryByTestId(`${T}-header-enrollment`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-maxEnroll`)).toBeNull();
    expect(screen.queryByTestId(`${T}-cell-row-0-col-enrollment`)).toBeNull();
    expect(screen.getByTestId(`${T}-header-instructor`)).toBeInTheDocument();
    expect(
      screen.getByTestId(`${T}-header-allocReasonable`),
    ).toBeInTheDocument();
  });

  test("the copy control beside an email copies that email", async () => {
    const onCopyEmail = vi.fn();
    renderTable({ onCopyEmail });
    await userEvent.click(
      screen.getByRole("button", { name: "Copy newprof@ucsb.edu" }),
    );
    expect(onCopyEmail).toHaveBeenCalledWith("newprof@ucsb.edu");
    expect(
      screen.getByTestId(`${T}-cell-row-2-copy-email`),
    ).toBeInTheDocument();
  });

  test("hidden columns are left out, and Course Name has no hide link", async () => {
    const onHide = vi.fn();
    renderTable({ hiddenColumns: ["comments", "instructor"], onHide });
    expect(screen.queryByTestId(`${T}-header-comments`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-instructor`)).toBeNull();
    expect(screen.queryByTestId(`${T}-header-course-hide`)).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Hide TA Allocation column" }),
    );
    expect(onHide).toHaveBeenCalledWith("taAllocation");
  });
});
