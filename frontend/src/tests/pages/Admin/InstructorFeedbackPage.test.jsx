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
const MISSING_URL = "/api/admin/instructorFeedback/missing";

const stubClipboard = () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
};

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
    axiosMock.onGet(MISSING_URL).reply(200, []);
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

  test("the copy control copies the instructor's email and says so, or says the browser refused", async () => {
    const writeText = stubClipboard();
    axiosMock
      .onGet("/api/admin/instructorFeedback")
      .reply(200, adminInstructorFeedbackFixtures.severalRecords);
    renderPage();
    await userEvent.click(
      await screen.findByTestId(
        "InstructorFeedbackPage-table-cell-row-0-copy-email",
      ),
    );
    expect(writeText).toHaveBeenCalledWith("pconrad@ucsb.edu");
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Email copied to clipboard."),
    );

    mockToast.mockClear();
    writeText.mockRejectedValueOnce(new Error("permission denied"));
    await userEvent.click(
      screen.getByTestId("InstructorFeedbackPage-table-cell-row-1-copy-email"),
    );
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Unable to copy to clipboard. Check your browser clipboard permissions.",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
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
      axiosMock.history.get.filter((r) =>
        r.url.startsWith("/api/admin/instructorFeedback"),
      ),
    ).toHaveLength(0);
    expect(
      screen.queryByRole("heading", {
        name: "No Feedback Yet From These Instructors",
      }),
    ).toBeNull();
  });

  describe("No Feedback Yet From These Instructors", () => {
    beforeEach(() => {
      axiosMock
        .onGet("/api/admin/instructorFeedback")
        .reply(200, adminInstructorFeedbackFixtures.severalRecords);
    });

    test("lists the course and email of each instructor who has not answered", async () => {
      axiosMock
        .onGet(MISSING_URL)
        .reply(200, adminInstructorFeedbackFixtures.missing);
      renderPage();

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "No Feedback Yet From These Instructors",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("InstructorFeedbackPage-missing-loading"),
      ).toHaveTextContent("Loading…");
      expect(
        await screen.findByTestId("InstructorFeedbackPage-missing-row-3"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("InstructorFeedbackPage-missing-loading"),
      ).toBeNull();
      expect(
        screen.getByText(
          "The instructors of the quarter's courses who have not checked any box of the feedback form, including those who have never opened it.",
        ),
      ).toBeInTheDocument();
      const get = axiosMock.history.get.find((r) => r.url === MISSING_URL);
      expect(get.params).toEqual({ quarter: "20261" });
      expect(
        screen.getByTestId(
          "InstructorFeedbackPage-missing-cell-row-0-col-course",
        ).textContent,
      ).toBe("CMPSC   5A (0100)");
      expect(
        screen.getByTestId(
          "InstructorFeedbackPage-missing-cell-row-0-col-email",
        ),
      ).toHaveTextContent(/^jsmith@ucsb\.edu$/);
      expect(
        screen.getByTestId(
          "InstructorFeedbackPage-missing-cell-row-3-col-email",
        ),
      ).toHaveTextContent(/^no email on file \(VISITOR V\)$/);
      expect(
        screen.queryByTestId(
          "InstructorFeedbackPage-missing-cell-row-3-copy-email",
        ),
      ).toBeNull();
      expect(
        screen.queryByTestId("InstructorFeedbackPage-missing-empty"),
      ).toBeNull();
    });

    test("the button copies each email once, one per line, and a row's control copies its own", async () => {
      const writeText = stubClipboard();
      axiosMock
        .onGet(MISSING_URL)
        .reply(200, adminInstructorFeedbackFixtures.missing);
      renderPage();

      const button = await screen.findByRole("button", {
        name: "Copy emails of instructors that have not provided feedback",
      });
      expect(button).toBeEnabled();
      await userEvent.click(button);
      expect(writeText).toHaveBeenCalledWith("jsmith@ucsb.edu\nklee@ucsb.edu");
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith("2 emails copied to clipboard."),
      );

      mockToast.mockClear();
      await userEvent.click(
        screen.getByTestId(
          "InstructorFeedbackPage-missing-cell-row-1-copy-email",
        ),
      );
      expect(writeText).toHaveBeenLastCalledWith("klee@ucsb.edu");
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith("Email copied to clipboard."),
      );
    });

    test("a failed request for the list is reported", async () => {
      axiosMock.onGet(MISSING_URL).reply(500);
      renderPage();
      await waitFor(() => expect(mockToast).toHaveBeenCalled());
      expect(
        screen.getByTestId("InstructorFeedbackPage-missing-loading"),
      ).toBeInTheDocument();
    });

    test("the button is disabled when no one listed has an email", async () => {
      axiosMock
        .onGet(MISSING_URL)
        .reply(200, [adminInstructorFeedbackFixtures.missing[3]]);
      renderPage();
      expect(
        await screen.findByTestId("InstructorFeedbackPage-copy-missing-emails"),
      ).toBeDisabled();
    });

    test("when everyone has answered it says so, with no table and no button", async () => {
      renderPage();
      expect(
        await screen.findByTestId("InstructorFeedbackPage-missing-empty"),
      ).toHaveTextContent(/^Every instructor has given feedback\.$/);
      expect(screen.queryByTestId("InstructorFeedbackPage-missing")).toBeNull();
      expect(
        screen.queryByTestId("InstructorFeedbackPage-copy-missing-emails"),
      ).toBeNull();
    });
  });
});
