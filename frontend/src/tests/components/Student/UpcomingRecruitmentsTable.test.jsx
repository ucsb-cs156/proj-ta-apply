import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import UpcomingRecruitmentsTable from "main/components/Student/UpcomingRecruitmentsTable";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const [upcomingTa] = recruitmentsFixtures.threeRecruitments;

function renderTable(recruitments, prefix = "U") {
  render(
    <MemoryRouter>
      <UpcomingRecruitmentsTable
        recruitments={recruitments}
        testIdPrefix={prefix}
      />
    </MemoryRouter>,
  );
}

describe("UpcomingRecruitmentsTable tests", () => {
  beforeEach(() => {
    // Timers keep running, so a sort's re-render is not stuck behind the fake clock.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("shows the quarter, type, tentative opening date and days until it", () => {
    renderTable([
      upcomingTa,
      { ...upcomingTa, id: 9, type: "ULA", tentativeOpeningDate: "2026-03-02" },
      { ...upcomingTa, id: 10, tentativeOpeningDate: "2026-02-01" },
      { ...upcomingTa, id: 11, tentativeOpeningDate: null },
    ]);

    expect(
      [...screen.getAllByRole("columnheader")].map((th) => th.textContent),
    ).toEqual(["Quarter", "Type", "Tentative Opening Date", "Opens in"]);
    expect(screen.getByTestId("U-cell-row-0-col-quarter")).toHaveTextContent(
      "S26",
    );
    expect(screen.getByTestId("U-cell-row-0-col-type")).toHaveTextContent("TA");
    expect(
      screen.getByTestId("U-cell-row-0-col-tentativeOpeningDate"),
    ).toHaveTextContent("2026-03-30");
    expect(screen.getByTestId("U-cell-row-0-col-opensIn")).toHaveTextContent(
      "29 days",
    );
    expect(screen.getByTestId("U-cell-row-1-col-opensIn")).toHaveTextContent(
      "1 day",
    );
    expect(screen.getByTestId("U-cell-row-2-col-opensIn")).toHaveTextContent(
      "any day now",
    );
    expect(screen.getByTestId("U-cell-row-3-col-opensIn").textContent).toBe("");
  });

  test("the Opens in column sorts by the number of days", async () => {
    // Real timers: a sort's re-render does not get through the fake clock. The dates are
    // relative to the real today, so the labels are known: 1 day, 30 days, any day now.
    vi.useRealTimers();
    const isoDaysFromNow = (days) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      const pad = (n) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    // Deliberately out of order either way.
    renderTable([
      { ...upcomingTa, id: 9, tentativeOpeningDate: isoDaysFromNow(1) },
      { ...upcomingTa, id: 10, tentativeOpeningDate: isoDaysFromNow(-5) },
      { ...upcomingTa, id: 11, tentativeOpeningDate: isoDaysFromNow(30) },
    ]);
    // In document order: the cell test ids carry each row's original index, not its position.
    const shown = () =>
      screen
        .getAllByTestId(/^U-cell-row-\d+-col-opensIn$/)
        .map((cell) => cell.textContent);
    expect(shown()).toEqual(["1 day", "any day now", "30 days"]);

    // The table sorts by the number of days; a numeric column goes descending first.
    await userEvent.click(screen.getByTestId("U-header-opensIn-sort-header"));
    expect(shown()).toEqual(["30 days", "1 day", "any day now"]);
    await userEvent.click(screen.getByTestId("U-header-opensIn-sort-header"));
    expect(shown()).toEqual(["any day now", "1 day", "30 days"]);
  });

  test("renders an empty table and tolerates a non-array prop", () => {
    renderTable(null, "UpcomingRecruitmentsTable");
    expect(screen.getByText("Opens in")).toBeInTheDocument();
    expect(
      screen.queryByTestId("UpcomingRecruitmentsTable-cell-row-0-col-quarter"),
    ).toBeNull();
  });

  test("uses UpcomingRecruitmentsTable as the default test id prefix", () => {
    render(
      <MemoryRouter>
        <UpcomingRecruitmentsTable recruitments={[upcomingTa]} />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("UpcomingRecruitmentsTable-cell-row-0-col-quarter"),
    ).toHaveTextContent("S26");
  });
});
