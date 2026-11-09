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
  FEEDBACK_COLUMNS_STORAGE_KEY,
  NOT_APPLICABLE,
  commentsDefaultWidth,
  courseName,
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

/** The text of one column, top to bottom, as the rows are now sorted. */
const columnText = (column) =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map(
      (tr) =>
        within(tr)
          .getAllByRole("cell")
          .find((td) => td.dataset.testid.endsWith(`-col-${column}`))
          .textContent,
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

  test("the column choices are every column but Course Name, in table order", () => {
    expect(FEEDBACK_COLUMN_CHOICES.map((c) => c.id)).toEqual([
      "instructor",
      "allocReasonable",
      "differentTACount",
      "taAllocation",
      "numTAsPreferred",
      "differentULACount",
      "ulaAllocation",
      "otherConcerns",
      "numULAsPreferred",
      "comments",
      "lastUpdated",
    ]);
    expect(FEEDBACK_COLUMN_CHOICES.map((c) => c.label)).toEqual([
      "Instructor",
      "Alloc Reasonable",
      "Diff TA Count",
      "TA Allocation",
      "Preferred TA Allocation",
      "Diff ULA Count",
      "ULA Allocation",
      "Other Concerns",
      "Preferred ULA Allocation",
      "Comments",
      "Last Updated",
    ]);
    expect(FEEDBACK_COLUMNS_STORAGE_KEY).toBe(
      "instructorFeedback.hiddenColumns",
    );
  });
});

describe("InstructorFeedbackTable", () => {
  test("has the columns in the issue's order, then Last Updated", () => {
    renderTable();
    const headers = screen
      .getAllByRole("columnheader")
      .map((th) => th.dataset.testid.replace(`${T}-header-`, ""));
    expect(headers).toEqual([
      "course",
      "instructor",
      "allocReasonable",
      "differentTACount",
      "taAllocation",
      "numTAsPreferred",
      "differentULACount",
      "ulaAllocation",
      "otherConcerns",
      "numULAsPreferred",
      "comments",
      "lastUpdated",
    ]);
    const headings = screen
      .getAllByRole("columnheader")
      .map((th) => within(th).getByTestId(/-sort-header$/).textContent);
    expect(headings).toEqual([
      "Course Name",
      "Instructor",
      "Alloc Reasonable",
      "Diff TA Count",
      "TA Allocation",
      "Preferred TA Allocation",
      "Diff ULA Count",
      "ULA Allocation",
      "Other Concerns",
      "Preferred ULA Allocation",
      "Comments",
      "Last Updated",
    ]);
    // Every heading but Course Name, Instructor and Comments is two lines in the smaller class.
    for (const th of screen.getAllByRole("columnheader")) {
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
