import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import MissingFeedbackTable from "main/components/InstructorFeedback/MissingFeedbackTable";
import adminInstructorFeedbackFixtures from "fixtures/adminInstructorFeedbackFixtures";

const rows = adminInstructorFeedbackFixtures.missing;
const T = "MissingFeedbackTable";

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

describe("MissingFeedbackTable", () => {
  test("has Course and Email, the course written as in the feedback table", () => {
    render(<MissingFeedbackTable rows={rows} onCopyEmail={vi.fn()} />);
    expect(
      screen
        .getAllByRole("columnheader")
        .map((th) => th.dataset.testid.replace(`${T}-header-`, "")),
    ).toEqual(["course", "email"]);
    expect(screen.getByTestId(`${T}-header-course`)).toHaveTextContent(
      /^Course$/,
    );
    expect(screen.getByTestId(`${T}-header-email`)).toHaveTextContent(
      /^Email$/,
    );
    const course = screen.getByTestId(`${T}-cell-row-2-col-course`);
    expect(course.textContent).toBe("CMPSC  24 (0100)");
    expect(course.firstChild).toHaveClass("instructor-feedback-course");
    expect(
      screen.getByTestId(`${T}-cell-row-3-col-email`).firstChild,
    ).toHaveClass("text-muted");
    expect(screen.getByTestId(T)).toHaveClass("w-auto");
  });

  test("both columns sort; an instructor with no email sorts last both ways", async () => {
    render(<MissingFeedbackTable rows={rows} onCopyEmail={vi.fn()} />);
    await sortBy("email");
    expect(columnText("email")).toEqual([
      "jsmith@ucsb.edu",
      "jsmith@ucsb.edu",
      "klee@ucsb.edu",
      "no email on file (VISITOR V)",
    ]);
    await sortBy("email");
    expect(columnText("email")).toEqual([
      "klee@ucsb.edu",
      "jsmith@ucsb.edu",
      "jsmith@ucsb.edu",
      "no email on file (VISITOR V)",
    ]);
    await sortBy("course");
    expect(columnText("course")[0]).toBe("CMPSC   5A (0100)");
  });

  test("a row's copy control copies its email", async () => {
    const onCopyEmail = vi.fn();
    render(<MissingFeedbackTable rows={rows} onCopyEmail={onCopyEmail} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Copy klee@ucsb.edu" }),
    );
    expect(onCopyEmail).toHaveBeenCalledWith("klee@ucsb.edu");
  });
});
