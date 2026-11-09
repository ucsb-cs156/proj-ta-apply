import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import InstructorFeedbackPage from "main/pages/Admin/InstructorFeedbackPage";
import { FEEDBACK_COLUMNS_STORAGE_KEY } from "main/utils/instructorFeedbackColumns";
import adminInstructorFeedbackFixtures from "fixtures/adminInstructorFeedbackFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage(qyy = "W26") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/admin/instructorFeedback/${qyy}`]}>
        <Routes>
          <Route
            path="/admin/instructorFeedback/:qyy"
            element={<InstructorFeedbackPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InstructorFeedbackPage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("asks for the quarter's feedback and shows a row per record, every column shown", async () => {
    axiosMock
      .onGet("/api/admin/instructorFeedback")
      .reply(200, adminInstructorFeedbackFixtures.severalRecords);
    renderPage();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Instructor Feedback for W26",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("InstructorFeedbackPage-loading"),
    ).toHaveTextContent("Loading…");
    expect(
      await screen.findByTestId("InstructorFeedbackPage-table-row-3"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("InstructorFeedbackPage-loading")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Combined allocations" }),
    ).toHaveAttribute("href", "/admin/allocations/W26");
    expect(
      screen.getByRole("link", { name: "Combined allocations" }).parentElement,
    ).toHaveTextContent(
      "What instructors said about the TA and ULA allocations of their courses, beside each course's current allocations. Combined allocations",
    );
    const get = axiosMock.history.get.find(
      (r) => r.url === "/api/admin/instructorFeedback",
    );
    expect(get.params).toEqual({ quarter: "20261" });
    expect(
      screen.getByTestId("InstructorFeedbackPage-table-header-lastUpdated"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        "InstructorFeedbackPage-table-cell-row-0-col-taAllocation",
      ),
    ).toHaveTextContent(/^3$/);
    expect(
      screen.getByTestId("InstructorFeedbackPage-columns"),
    ).toBeInTheDocument();
  });

  test("hiding a column, by its link or the menu, is remembered in this browser", async () => {
    axiosMock
      .onGet("/api/admin/instructorFeedback")
      .reply(200, adminInstructorFeedbackFixtures.severalRecords);
    renderPage();
    await screen.findByTestId("InstructorFeedbackPage-table-row-0");

    await userEvent.click(
      screen.getByRole("button", { name: "Hide Comments column" }),
    );
    expect(
      screen.queryByTestId("InstructorFeedbackPage-table-header-comments"),
    ).toBeNull();
    expect(
      JSON.parse(localStorage.getItem(FEEDBACK_COLUMNS_STORAGE_KEY)),
    ).toEqual(["comments"]);

    await userEvent.click(screen.getByRole("button", { name: /Columns/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Comments" }));
    expect(
      screen.getByTestId("InstructorFeedbackPage-table-header-comments"),
    ).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(FEEDBACK_COLUMNS_STORAGE_KEY)),
    ).toEqual([]);
  });

  test("columns hidden on an earlier visit stay hidden", async () => {
    localStorage.setItem(
      FEEDBACK_COLUMNS_STORAGE_KEY,
      JSON.stringify(["instructor"]),
    );
    axiosMock
      .onGet("/api/admin/instructorFeedback")
      .reply(200, adminInstructorFeedbackFixtures.severalRecords);
    renderPage();
    await screen.findByTestId("InstructorFeedbackPage-table-row-0");
    expect(
      screen.queryByTestId("InstructorFeedbackPage-table-header-instructor"),
    ).toBeNull();
  });

  test("a failed request is reported", async () => {
    axiosMock.onGet("/api/admin/instructorFeedback").reply(500);
    renderPage();
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(
      screen.getByTestId("InstructorFeedbackPage-loading"),
    ).toBeInTheDocument();
  });

  test("a quarter with no feedback says so", async () => {
    axiosMock.onGet("/api/admin/instructorFeedback").reply(200, []);
    renderPage("S26");
    expect(
      await screen.findByTestId("InstructorFeedbackPage-empty"),
    ).toHaveTextContent(
      /^No instructor has given feedback on their allocation for S26 yet\.$/,
    );
    expect(screen.queryByTestId("InstructorFeedbackPage-table")).toBeNull();
    expect(screen.queryByTestId("InstructorFeedbackPage-columns")).toBeNull();
  });

  test("something that is not a quarter is said to be so, and nothing is asked for", async () => {
    renderPage("Fall2026");
    expect(
      screen.getByRole("heading", { level: 1, name: "Instructor Feedback" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("InstructorFeedbackPage-bad-quarter"),
    ).toHaveTextContent(
      "“Fall2026” is not a quarter. Quarters are written as a letter and two digits, such as F26. Choose a quarter on the home page.",
    );
    expect(
      screen.getByRole("link", { name: "Choose a quarter on the home page" }),
    ).toHaveAttribute("href", "/");
    await screen.findByText("Choose a quarter on the home page");
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/admin/instructorFeedback",
      ),
    ).toHaveLength(0);
  });
});
