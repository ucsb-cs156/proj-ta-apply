import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import ApplicationTable from "main/components/Applications/ApplicationTable";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

// The ULA application belongs to recruitment 2 (open, deadline 2026-01-20); the TA one to
// recruitment 1 (closed).
const recruitments = recruitmentsFixtures.threeRecruitments;

function renderTable(
  applications = applicationsFixtures.twoApplications,
  recruitmentList = recruitments,
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationTable
          applications={applications}
          recruitments={recruitmentList}
          testIdPrefix="ApplicationTable"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ApplicationTable tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders the headers", () => {
    renderTable();

    ["Quarter", "Type", "Status", "First Choice", "Second Choice"].forEach(
      (header) => expect(screen.getByText(header)).toBeInTheDocument(),
    );
  });

  /** The quarter and type come from the recruitment, not the application. */
  test("labels each row with its recruitment's quarter and type", () => {
    renderTable();

    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-quarter"),
    ).toHaveTextContent("W26");
    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-type"),
    ).toHaveTextContent("ULA");
    expect(
      screen.getByTestId("ApplicationTable-cell-row-1-col-type"),
    ).toHaveTextContent("TA");
  });

  test("shows the status", () => {
    renderTable();

    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-status"),
    ).toHaveTextContent("PENDING");
  });

  test("course choices keep their padding", () => {
    renderTable();

    const span = screen
      .getByTestId("ApplicationTable-cell-row-0-col-firstChoiceCourse")
      .querySelector("span");
    expect(span).toHaveStyle({ whiteSpace: "pre", fontFamily: "monospace" });
    expect(span.textContent).toBe("CMPSC   156");
  });

  /** Row 0 is open and before its deadline; row 1's recruitment is closed. */
  test("the action says what the applicant may still do", () => {
    renderTable();

    const editable = screen.getByTestId(
      "ApplicationTable-cell-row-0-col-action-link",
    );
    expect(editable).toHaveTextContent("Edit");
    expect(editable).toHaveAttribute("href", "/applications/2");

    const closed = screen.getByTestId(
      "ApplicationTable-cell-row-1-col-action-link",
    );
    expect(closed).toHaveTextContent("View");
    expect(closed).toHaveAttribute("href", "/applications/1");
  });

  test("past the deadline the action offers comments instead of editing", () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    renderTable();

    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-action-link"),
    ).toHaveTextContent("Add comments");
  });

  /** Without its recruitment a row still renders, just without a quarter or type. */
  test("an application whose recruitment is unknown still renders", () => {
    renderTable(applicationsFixtures.twoApplications, []);

    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-quarter"),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-type"),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-action-link"),
    ).toHaveTextContent("View");
  });

  test("renders an empty table without crashing", () => {
    renderTable([]);

    expect(screen.getByText("Quarter")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ApplicationTable-cell-row-0-col-status"),
    ).toBeNull();
  });

  test("tolerates non-array props", () => {
    renderTable(null, null);

    expect(screen.getByText("Quarter")).toBeInTheDocument();
  });
});
