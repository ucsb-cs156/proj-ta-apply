import { fireEvent, render, screen } from "@testing-library/react";
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
  showTestColumn = undefined,
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationTable
          applications={applications}
          recruitments={recruitmentList}
          showTestColumn={showTestColumn}
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

  test("renders the headers, without a Test column for an applicant", () => {
    renderTable();

    ["Quarter", "Type", "Status", "First Choice", "Second Choice"].forEach(
      (header) => expect(screen.getByText(header)).toBeInTheDocument(),
    );
    // Issue #98: only an admin's list can hold a test application.
    expect(screen.queryByText("Test")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationTable-cell-row-0-col-testApplication"),
    ).toBeNull();
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

  /** An admin's test run is listed like any other application, but says so. */
  test("the Test column, when asked for, says whether an application is a test", () => {
    renderTable(
      applicationsFixtures.threeApplicationsIncludingATest,
      recruitments,
      true,
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-testApplication"),
    ).toHaveTextContent("false");
    expect(
      screen.getByTestId("ApplicationTable-cell-row-2-col-testApplication"),
    ).toHaveTextContent("true");
  });

  test("an application without the test flag is shown as not a test", () => {
    const { testApplication: _omitted, ...legacy } =
      applicationsFixtures.oneUlaApplication;
    renderTable([legacy], recruitments, true);

    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-testApplication"),
    ).toHaveTextContent("false");
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
  test("an open recruitment's row has an Edit button", () => {
    renderTable();

    const edit = screen.getByTestId(
      "ApplicationTable-cell-row-0-col-action-edit",
    );
    expect(edit).toHaveTextContent("Edit");
    expect(edit).toHaveAttribute("href", "/applications/2");
    expect(edit).toHaveClass("btn", "btn-primary", "btn-sm");
    expect(edit).not.toHaveAttribute("disabled");
    expect(
      screen.queryByTestId("ApplicationTable-cell-row-0-col-action-view"),
    ).toBeNull();
  });

  /** Issue #98: editing lasts until applications close, so the deadline changes nothing here. */
  test("past the deadline the row still has an Edit button", () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12, 0, 0));
    renderTable();

    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-action-edit"),
    ).toHaveAttribute("href", "/applications/2");
  });

  test("a closed recruitment's row has a disabled Edit button that says when, and a View link", async () => {
    // The tooltip appears asynchronously; a closed row does not depend on today's date.
    vi.useRealTimers();
    renderTable();

    const edit = screen.getByTestId(
      "ApplicationTable-cell-row-1-col-action-edit",
    );
    expect(edit).toBeDisabled();
    expect(edit).toHaveTextContent("Edit");
    expect(edit).not.toHaveAttribute("href");
    // So the hover reaches the wrapper rather than being swallowed by the disabled button.
    expect(edit).toHaveStyle({ pointerEvents: "none" });

    // A disabled button gets no mouse events, so the tooltip hangs off its wrapper.
    fireEvent.mouseOver(
      screen.getByTestId("ApplicationTable-cell-row-1-col-action-edit-wrapper"),
    );
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(
      "Applications were closed on 2026-02-01.",
    );
    expect(tooltip).toHaveAttribute(
      "id",
      "ApplicationTable-cell-row-1-col-action-tooltip",
    );

    const view = screen.getByTestId(
      "ApplicationTable-cell-row-1-col-action-view",
    );
    expect(view).toHaveTextContent("View");
    expect(view).toHaveAttribute("href", "/applications/1");
  });

  test("a closed recruitment without a recorded closing date gets the plain explanation", async () => {
    vi.useRealTimers();
    const [closedTa] = recruitments;
    renderTable(
      [
        {
          ...applicationsFixtures.oneTaApplication,
          recruitmentId: closedTa.id,
        },
      ],
      [{ ...closedTa, actualClosingDate: null }],
    );

    fireEvent.mouseOver(
      screen.getByTestId("ApplicationTable-cell-row-0-col-action-edit-wrapper"),
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Applications are closed.",
    );
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
      screen.getByTestId("ApplicationTable-cell-row-0-col-action-edit"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("ApplicationTable-cell-row-0-col-action-view"),
    ).toHaveAttribute("href", "/applications/2");
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
