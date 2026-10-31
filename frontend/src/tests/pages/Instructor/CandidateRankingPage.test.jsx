import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import CandidateRankingPage from "main/pages/Instructor/CandidateRankingPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (message) => mockToast(message),
}));

const axiosMock = new AxiosMockAdapter(axios);
const rankingUrl = "/api/instructor/recruitments/1/courses/2/ranking";

function renderPage(path = "/recruitments/1/courses/2/ranking") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/recruitments/:recruitmentId/courses/:recruitmentCourseId/ranking"
            element={<CandidateRankingPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CandidateRankingPage", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("shows the TA recruitment and course details and links only to other courses", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    renderPage();

    expect(
      await screen.findByTestId("CandidateRankingPage-quarter"),
    ).toHaveTextContent("W26");
    expect(
      screen.getByTestId("CandidateRankingPage-quarter"),
    ).toHaveTextContent("W26");
    expect(screen.getByTestId("CandidateRankingPage-type")).toHaveTextContent(
      "TA",
    );
    expect(screen.getByText("Tentative Opening").nextSibling).toHaveTextContent(
      "2025-12-01",
    );
    expect(
      screen.getByText("Primary Consideration").nextSibling,
    ).toHaveTextContent("2026-01-20");
    expect(screen.getByText("Actually Opened").nextSibling).toHaveTextContent(
      "2026-01-06",
    );
    expect(screen.getByText("Actually Closed").nextSibling).toHaveTextContent(
      "2026-02-01",
    );
    expect(
      screen.getByTestId("CandidateRankingPage-opening-date"),
    ).toHaveTextContent("2026-01-08");
    expect(
      screen.getByTestId("CandidateRankingPage-deadline"),
    ).toHaveTextContent("2026-02-15");
    expect(
      screen.getByTestId("CandidateRankingPage-course-id"),
    ).toHaveTextContent("CMPSC   156", { normalizeWhitespace: false });
    expect(
      screen.getByTestId("CandidateRankingPage-section"),
    ).toHaveTextContent("0100");
    expect(screen.getByTestId("CandidateRankingPage-title")).toHaveTextContent(
      "Advanced Applications Programming",
    );
    expect(
      screen.getByTestId("CandidateRankingPage-instructor"),
    ).toHaveTextContent("CONRAD P");
    expect(
      screen.getByRole("heading", { name: "Your other W26 Courses" }),
    ).toBeInTheDocument();
    const otherCourseLink = screen.getByRole("link", {
      name: /CMPSC\s+156 \(0200\)/,
    });
    expect(otherCourseLink).toHaveAttribute(
      "href",
      "/recruitments/1/courses/3/ranking",
    );
    expect(
      screen.getByTestId("CandidateRankingPage-placeholder"),
    ).toHaveTextContent(
      "Coming soon on this page: a table to rank the candidates for TA for this course",
    );
  });

  test("shows the ULA-specific placeholder and no sibling heading when there are no other courses", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      type: "ULA",
      otherCourses: [],
    });
    renderPage();

    expect(
      await screen.findByTestId("CandidateRankingPage-placeholder"),
    ).toHaveTextContent(
      "Coming soon on this page: a table to rank the candidates for ULA for this course",
    );
    expect(
      screen.queryByRole("heading", { name: /Your other/ }),
    ).not.toBeInTheDocument();
  });

  test("shows loading state while course metadata is pending", async () => {
    axiosMock.onGet(rankingUrl).reply(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve([
                200,
                instructorRecruitmentsFixtures.candidateRankingPage,
              ]),
            100,
          );
        }),
    );
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading candidate ranking...",
    );
    await screen.findByTestId("CandidateRankingPage-placeholder");
  });

  test("shows the backend's explicit error message", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(403, { message: "This course is not assigned to you." });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load candidate ranking: This course is not assigned to you.",
    );
    await waitFor(() => expect(mockToast).not.toHaveBeenCalled());
  });

  test("shows an explicit error for a successful response without page details", async () => {
    axiosMock.onGet(rankingUrl).reply(200, null);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No candidate-ranking details were returned.",
    );
  });

  test("rejects malformed route identifiers without requesting metadata", async () => {
    renderPage("/recruitments/not-an-id/courses/2/ranking");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This candidate-ranking link is invalid.",
    );
    expect(
      axiosMock.history.get.some((request) => request.url.includes("/ranking")),
    ).toBe(false);
  });
});
