import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import applicationsFixtures from "fixtures/applicationsFixtures";
import { submittedText } from "main/utils/adminApplications";

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
  test("a TA table has the TA columns, in order, with Level", () => {
    renderTable();

    const headers = [...screen.getAllByRole("columnheader")].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      "id",
      "Submitted",
      "Name",
      "Major",
      "Level",
      "Email",
      "View",
      "Edit",
    ]);
    // Issue #109: the two course choices gave way to the email.
    expect(screen.queryByText("First Choice")).toBeNull();
    expect(screen.queryByText("Second Choice")).toBeNull();
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

  test("a ULA table swaps Level for Expected Graduation", () => {
    renderTable({ applications: [ula], type: "ULA" });

    const headers = [...screen.getAllByRole("columnheader")].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual([
      "id",
      "Submitted",
      "Name",
      "Major",
      "Expected Graduation",
      "Email",
      "View",
      "Edit",
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
    renderTable({ applications: null });
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
});
