import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentTable from "main/components/Recruitments/RecruitmentTable";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderTable(
  recruitments = recruitmentsFixtures.threeRecruitments,
  onDeleteRequested = vi.fn(),
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RecruitmentTable
          recruitments={recruitments}
          onDeleteRequested={onDeleteRequested}
          testIdPrefix="RecruitmentTable"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onDeleteRequested;
}

describe("RecruitmentTable tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut("/api/admin/recruitments/status").reply(200, {});
  });

  test("renders the expected headers in order", () => {
    renderTable();

    // Scoped to the header row: "Courses" and "Delete" also appear as button labels in each row.
    const headers = Array.from(
      document.querySelectorAll('[data-testid="RecruitmentTable"] thead th'),
    ).map((th) => th.textContent.trim());

    expect(headers).toEqual([
      "Quarter",
      "Type",
      "Status",
      "Tentative Opening",
      "Primary Consideration",
      "Actually Opened",
      "Actually Closed",
      "Applications",
      "Courses",
      "Delete",
    ]);
  });

  /** Stored as YYYYQ so it sorts; shown as QYY because that is how people say it. */
  test("shows the quarter in QYY form", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-quarter"),
    ).toHaveTextContent("S26");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-quarter"),
    ).toHaveTextContent("W26");
  });

  test("shows both actual dates once they are set", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-2-col-actualOpeningDate"),
    ).toHaveTextContent("2026-01-06");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-2-col-actualClosingDate"),
    ).toHaveTextContent("2026-02-01");
  });

  test("a closed recruitment offers Open, an open one offers Close", () => {
    renderTable();
    // row 0 is CLOSED, row 1 is OPEN
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-status-button"),
    ).toHaveTextContent("Open");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-status-button"),
    ).toHaveTextContent("Close");
  });

  test("clicking Open asks the backend to open it", async () => {
    renderTable();

    await userEvent.click(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-status-button"),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({ id: 3, status: "OPEN" });
  });

  test("clicking Close asks the backend to close it", async () => {
    renderTable();

    await userEvent.click(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-status-button"),
    );

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({
      id: 2,
      status: "CLOSED",
    });
  });

  test("the Courses button links to that recruitment's course list", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-courses-button"),
    ).toHaveAttribute("href", "/admin/recruitments/3/courses");
  });

  /** Delete is confirmed by the page, so the table only reports the request. */
  test("Delete asks the page rather than deleting directly", async () => {
    const onDeleteRequested = renderTable();

    await userEvent.click(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-delete-button"),
    );

    expect(onDeleteRequested).toHaveBeenCalledTimes(1);
    expect(onDeleteRequested.mock.calls[0][0].id).toBe(3);
    expect(axiosMock.history.delete.length).toBe(0);
  });

  test("renders an empty table without crashing", () => {
    renderTable([]);
    expect(screen.getByText("Quarter")).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentTable-cell-row-0-col-quarter"),
    ).toBeNull();
  });

  test("tolerates a non-array recruitments prop", () => {
    renderTable(null);
    expect(screen.getByText("Quarter")).toBeInTheDocument();
  });
});
