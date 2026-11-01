import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import applicationsFixtures from "fixtures/applicationsFixtures";
import { submittedText } from "main/utils/adminApplications";
import {
  applicationColumns,
  defaultHiddenColumns,
} from "main/utils/applicationColumns";

const ta = applicationsFixtures.oneTaApplication;
const ula = applicationsFixtures.oneUlaApplication;
const testApp = applicationsFixtures.oneTestApplication;

function renderTable(props = {}) {
  render(
    <MemoryRouter>
      <AdminApplicationTable applications={[ta]} type="TA" {...props} />
    </MemoryRouter>,
  );
}

describe("AdminApplicationTable tests", () => {
  /** Issue #189: id, View, Edit and Name first, then Submitted; the new columns start hidden. */
  test("a TA table with the default columns hidden has the TA columns, in order, with Level", () => {
    renderTable({ hiddenColumns: defaultHiddenColumns("TA") });

    const headers = [...screen.getAllByRole("columnheader")].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      "id",
      "View",
      "Edit",
      "Name",
      "Submitted",
      "Email",
      "Major",
      "Level",
    ]);
    // Issue #109: the two course choices are not shown until asked for.
    expect(screen.queryByText("First Choice")).toBeNull();
    expect(screen.queryByText("Second Choice")).toBeNull();
  });

  test("with nothing hidden, a TA table has every TA column, in catalogue order", () => {
    renderTable();

    const headers = [...screen.getAllByRole("columnheader")].map((th) =>
      th
        .getAttribute("data-testid")
        .replace("AdminApplicationTable-header-", ""),
    );
    expect(headers).toEqual([
      "id",
      "view",
      "edit",
      "name",
      ...applicationColumns("TA").map((column) => column.id),
    ]);
    expect(headers).toHaveLength(32);
    expect(headers).toContain("residencyStatus");
    expect(headers).not.toContain("permNumber");
    expect(headers).not.toContain("interests");
    expect(screen.getByText("First Choice")).toBeInTheDocument();
  });

  test("the table takes its natural width", () => {
    renderTable();
    expect(screen.getByTestId("AdminApplicationTable")).toHaveClass("w-auto");
    expect(
      screen.getByTestId("AdminApplicationTable-header-name").style.width,
    ).toBe("1%");
    expect(
      screen.getByTestId("AdminApplicationTable-header-major").style.width,
    ).toBe("1%");
    // Long free-text answers are the columns that may wrap.
    expect(
      screen.getByTestId("AdminApplicationTable-header-comments").style.width,
    ).toBe("");
  });

  test("View and Edit do not sort; the rest do", () => {
    renderTable();
    expect(
      screen.getByTestId("AdminApplicationTable-header-view-sort-header").style
        .cursor,
    ).toBe("");
    expect(
      screen.getByTestId("AdminApplicationTable-header-edit-sort-header").style
        .cursor,
    ).toBe("");
    expect(
      screen.getByTestId("AdminApplicationTable-header-name-sort-header").style
        .cursor,
    ).toBe("pointer");
    expect(
      screen.getByTestId("AdminApplicationTable-header-gpaMajor-sort-header")
        .style.cursor,
    ).toBe("pointer");
  });

  test("hidden columns leave the table, heading and cells alike", () => {
    renderTable({ hiddenColumns: ["major", "email", "_defaultsApplied"] });

    expect(
      screen.queryByTestId("AdminApplicationTable-header-major"),
    ).toBeNull();
    expect(
      screen.queryByTestId("AdminApplicationTable-cell-row-0-col-major"),
    ).toBeNull();
    expect(
      screen.queryByTestId("AdminApplicationTable-header-email"),
    ).toBeNull();
    expect(
      screen.getByTestId("AdminApplicationTable-header-submittedAt"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("AdminApplicationTable-header-id"),
    ).toBeInTheDocument();
  });

  test("the TA answers show in their columns, formatted", () => {
    renderTable({
      applications: [
        {
          ...ta,
          status: "CANCELLED",
          cancelledAt: "2026-02-03T04:05:00",
          cancellationReason: "Found other employment",
        },
      ],
    });
    const cell = (id) =>
      screen.getByTestId(`AdminApplicationTable-cell-row-0-col-${id}`)
        .textContent;

    expect(cell("status")).toBe("CANCELLED");
    expect(cell("gpaMajor")).toBe("3.9");
    expect(cell("gpaOverall")).toBe("3.8");
    expect(cell("yearInProgram")).toBe("2nd");
    expect(cell("graduationDate")).toBe("S27");
    expect(cell("residencyStatus")).toBe("F1 Student Visa");
    expect(cell("languageExam")).toBe("passed (F1 or J1 visa)");
    expect(cell("languageExamDatePassed")).toBe("F25");
    expect(cell("firstChoiceCourse")).toBe("CMPSC   156");
    expect(cell("secondChoiceCourse")).toBe("CMPSC   130A");
    expect(cell("availableForLecturesFirstChoice")).toBe("Yes");
    expect(cell("availableForDiscussionFirstChoice")).toBe("Yes");
    expect(cell("availabilityCommentsFirstChoice")).toBe(
      "Free any afternoon but Wednesday.",
    );
    expect(cell("availableForLecturesSecondChoice")).toBe("No");
    expect(cell("availableForDiscussionSecondChoice")).toBe("No");
    expect(cell("availabilityCommentsSecondChoice")).toBe("");
    expect(cell("courseInterests")).toBe(
      "CMPSC     8 Enthusiastic; CMPSC    16 Would Consider",
    );
    expect(cell("topicProficiencies")).toBe("Java 5; React 3");
    expect(cell("prevExperience")).toBe("TA for CS 24 twice");
    expect(cell("comments")).toBe("Happy to help with either lecture.");
    expect(cell("postApplicationComments")).toBe("");
    expect(cell("adminComments")).toBe("");
    expect(cell("cancelled")).toBe(
      `${submittedText("2026-02-03T04:05:00")}: Found other employment`,
    );
    expect(cell("noticeVersionId")).toBe("1");
  });

  test("the ULA answers show in their columns, formatted, and a TA answer is not a ULA column", () => {
    renderTable({ applications: [ula], type: "ULA" });
    const cell = (id) =>
      screen.getByTestId(`AdminApplicationTable-cell-row-0-col-${id}`)
        .textContent;

    expect(screen.getAllByRole("columnheader")).toHaveLength(36);
    expect(
      screen.queryByTestId("AdminApplicationTable-header-classLevel"),
    ).toBeNull();
    expect(
      screen.queryByTestId("AdminApplicationTable-header-residencyStatus"),
    ).toBeNull();
    expect(
      screen.queryByTestId(
        "AdminApplicationTable-header-availableForLecturesFirstChoice",
      ),
    ).toBeNull();
    expect(cell("permNumber")).toBe("A1B2C3D");
    expect(cell("previousServiceAsUla")).toBe("2");
    expect(cell("videoLink")).toBe("https://example.org/chris");
    expect(cell("changingMajor")).toBe("No");
    expect(cell("bsMsStudent")).toBe("Yes");
    expect(cell("studentStatusNextQuarter")).toBe("Undergraduate");
    expect(cell("wantsTaEligibility")).toBe("Yes");
    expect(cell("otherCampusJob")).toBe("Not sure yet");
    expect(cell("priorUcsbEmployment")).toBe("Yes");
    expect(cell("employeeId")).toBe("1234567");
    expect(cell("i9Appointment")).toBe("No");
    expect(cell("trainingCommitment")).toBe("");
    expect(cell("trainingCommitmentExplanation")).toBe("");
    expect(cell("interests")).toBe("Grading 2; Tutoring 5");
    expect(cell("postApplicationComments")).toBe(
      "I have since finished CS 130A.",
    );
    expect(cell("adminComments")).toBe("Strong candidate; interview Tuesday.");
    expect(cell("cancelled")).toBe("");
    expect(cell("status")).toBe("PENDING");
  });

  test("long headings are stacked on two lines", () => {
    renderTable();
    const heading = screen.getByTestId("AdminApplicationTable-header-gpaMajor");
    expect(heading).toHaveTextContent("GPA in Major");
    expect(heading.querySelector("br")).not.toBeNull();
    expect(
      screen
        .getByTestId("AdminApplicationTable-header-residencyStatus")
        .querySelector("br"),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId("AdminApplicationTable-header-email")
        .querySelector("br"),
    ).toBeNull();
  });

  /** Issue #109: a read-only view beside the edit form. */
  test("each row has a View button leading to the admin's read-only view", () => {
    renderTable();

    const button = screen.getByTestId(
      "AdminApplicationTable-cell-row-0-col-view-button",
    );
    expect(button).toHaveTextContent("View");
    expect(button).toHaveAttribute("href", `/admin/applications/${ta.id}`);
    expect(button).toHaveClass("btn", "btn-outline-primary", "btn-sm");
  });

  test("each row has an Edit button leading to the admin's edit form", () => {
    renderTable();

    const button = screen.getByTestId(
      "AdminApplicationTable-cell-row-0-col-edit-button",
    );
    expect(button).toHaveTextContent("Edit");
    expect(button).toHaveAttribute("href", `/admin/applications/${ta.id}/edit`);
  });

  test("a ULA table with the default columns hidden swaps Level for Expected Graduation", () => {
    renderTable({
      applications: [ula],
      type: "ULA",
      hiddenColumns: defaultHiddenColumns("ULA"),
    });

    const headers = [...screen.getAllByRole("columnheader")].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      "id",
      "View",
      "Edit",
      "Name",
      "Submitted",
      "Email",
      "Major",
      "Expected Graduation",
    ]);
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-graduationDate"),
    ).toHaveTextContent(ula.graduationDate);
    // Issue #109: the heading is stacked on two lines so the column stays narrow.
    const heading = screen
      .getAllByRole("columnheader")
      .find((th) => th.textContent === "Expected Graduation");
    expect(heading.querySelector("br")).not.toBeNull();
    expect(heading.innerHTML).toContain("Expected <br>Graduation");
  });

  test("the id links to the admin's view of that application", () => {
    renderTable();

    const link = screen.getByTestId(
      "AdminApplicationTable-cell-row-0-col-id-link",
    );
    expect(link).toHaveTextContent(String(ta.id));
    expect(link).toHaveAttribute("href", `/admin/applications/${ta.id}`);
    // A real application carries no test badge.
    expect(
      screen.queryByTestId("AdminApplicationTable-cell-row-0-col-id-test"),
    ).toBeNull();
  });

  test("shows the submission time, full name, major, level and email", () => {
    renderTable({
      applications: [{ ...ta, middleName: "M", classLevel: "PHD" }],
    });

    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-submittedAt"),
    ).toHaveTextContent(submittedText(ta.submittedAt));
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-name"),
    ).toHaveTextContent(`${ta.firstName} M ${ta.lastName}`);
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-major"),
    ).toHaveTextContent(ta.major);
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-classLevel"),
    ).toHaveTextContent("PhD");
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-email"),
    ).toHaveTextContent(ta.email);
  });

  test("MS is spelled out and an unknown or missing level is blank", () => {
    renderTable({
      applications: [
        { ...ta, id: 1, classLevel: "MS" },
        { ...ta, id: 2, classLevel: null },
        { ...ta, id: 3, classLevel: "BS" },
      ],
    });

    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-classLevel"),
    ).toHaveTextContent("MS");
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-1-col-classLevel")
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-2-col-classLevel")
        .textContent,
    ).toBe("");
  });

  test("blank answers read as blank, not null, and a missing middle name leaves no gap", () => {
    renderTable({
      applications: [
        {
          ...ta,
          middleName: null,
          major: null,
          email: null,
          submittedAt: null,
        },
        // An answer that was never sent at all reads the same as a null one.
        { ...ta, id: 2, middleName: undefined, major: undefined },
      ],
    });

    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-1-col-name")
        .textContent,
    ).toBe(`${ta.firstName} ${ta.lastName}`);
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-1-col-major")
        .textContent,
    ).toBe("");

    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-name")
        .textContent,
    ).toBe(`${ta.firstName} ${ta.lastName}`);
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-major")
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-email")
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-0-col-submittedAt")
        .textContent,
    ).toBe("");
  });

  test("a fake developer-mode application gets a red fake badge", () => {
    renderTable({
      applications: [ta, { ...testApp, origin: "DEVELOPER_MODE" }],
    });

    const badge = screen.getByTestId(
      "AdminApplicationTable-cell-row-1-col-id-test",
    );
    expect(badge).toHaveTextContent("fake");
    expect(badge).toHaveClass("text-bg-danger");
  });

  test("a test application is marked as such beside its id", () => {
    renderTable({ applications: [ta, testApp] });

    expect(
      screen.queryByTestId("AdminApplicationTable-cell-row-0-col-id-test"),
    ).toBeNull();
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-1-col-id-test"),
    ).toHaveTextContent("test");
    expect(
      screen.getByTestId("AdminApplicationTable-cell-row-1-col-id-link"),
    ).toHaveAttribute("href", `/admin/applications/${testApp.id}`);
  });

  test("renders an empty table, and tolerates a non-array prop", () => {
    renderTable({
      applications: null,
      hiddenColumns: defaultHiddenColumns("TA"),
    });
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
    expect(
      screen.queryByTestId("AdminApplicationTable-cell-row-0-col-id-link"),
    ).toBeNull();
  });

  test("the test id prefix can be overridden", () => {
    renderTable({ testIdPrefix: "RecruitmentApplicationsPage-applications" });
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-applications-cell-row-0-col-id-link",
      ),
    ).toBeInTheDocument();
  });

  test("clicking the id heading sorts the rows by id", async () => {
    renderTable({ applications: [ta, testApp] });
    const firstLink = () =>
      screen.getByTestId("AdminApplicationTable").querySelector("tbody tr a")
        .textContent;
    expect(firstLink()).toBe(String(ta.id));

    await userEvent.click(
      screen.getByTestId("AdminApplicationTable-header-id-sort-header"),
    );
    expect(firstLink()).toBe(String(testApp.id));
    await userEvent.click(
      screen.getByTestId("AdminApplicationTable-header-id-sort-header"),
    );
    expect(firstLink()).toBe(String(ta.id));
  });
});
