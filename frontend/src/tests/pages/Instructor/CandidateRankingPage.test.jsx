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
import candidatesFixtures from "fixtures/candidatesFixtures";

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
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/candidates")
      .reply(200, candidatesFixtures);
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
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Level (PhD/MS)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  test("shows ULA-specific columns and no sibling heading when there are no other courses", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      type: "ULA",
      otherCourses: [],
    });
    renderPage();

    expect(
      await screen.findByRole("columnheader", { name: "GPA in Major" }),
    ).toBeInTheDocument();
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
    await screen.findByRole("table");
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

  test("Open reviews allow instructors to rank immediately even after the informational deadline", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      reviewStatus: "Open",
      canRank: true,
      facultyRankingDeadline: "2020-01-01",
    });
    renderPage();
    expect(
      await screen.findByRole("spinbutton", {
        name: "Ranking for Ada Lovelace",
      }),
    ).toHaveValue(1);
  });

  test("the page is read-only when the backend says this user may not rank, whatever their roles", async () => {
    axiosMock.onGet("/api/currentUser").reply(200, {
      ...apiCurrentUserFixtures.adminUser,
      rolesList: ["ROLE_ADMIN", "ROLE_INSTRUCTOR", "ROLE_USER"],
    });
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      reviewStatus: "Open",
      canRank: false,
    });
    renderPage();
    expect(
      await screen.findByText("Rankings are read-only."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  test("a response without canRank is read-only too", async () => {
    const { canRank: _omitted, ...withoutFlag } =
      instructorRecruitmentsFixtures.candidateRankingPage;
    axiosMock.onGet(rankingUrl).reply(200, withoutFlag);
    renderPage();
    expect(
      await screen.findByText("Rankings are read-only."),
    ).toBeInTheDocument();
  });

  /** Issue #202: an admin who also teaches the course ranks it like any instructor. */
  test("an admin may rank when the backend says they are the course's instructor", async () => {
    axiosMock.onGet("/api/currentUser").reply(200, {
      ...apiCurrentUserFixtures.adminUser,
      rolesList: ["ROLE_ADMIN", "ROLE_INSTRUCTOR", "ROLE_USER"],
    });
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      canRank: true,
    });
    renderPage();
    expect(
      await screen.findByRole("spinbutton", {
        name: "Ranking for Ada Lovelace",
      }),
    ).toHaveValue(1);
    expect(
      screen.queryByText("Rankings are read-only."),
    ).not.toBeInTheDocument();
  });

  test("successful null candidate response is an error, not infinite loading", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/candidates")
      .reply(200, null);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No candidate data were returned.",
    );
    expect(screen.queryByText("Loading candidates...")).not.toBeInTheDocument();
  });

  test("candidate fetch failures and pending fetches have explicit states", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    let finish;
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/candidates")
      .reply(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    renderPage();
    expect(
      await screen.findByText("Loading candidates..."),
    ).toBeInTheDocument();
    finish([500, { message: "Candidates unavailable" }]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load candidates: Candidates unavailable",
    );
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

  // ---- the allocation notice (issue #178) ----

  test("no allocation notice while the admin hides allocations", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    renderPage();

    await screen.findByTestId("CandidateRankingPage-quarter");
    expect(
      instructorRecruitmentsFixtures.candidateRankingPage.allocation,
    ).toBeNull();
    expect(screen.queryByTestId("CandidateRankingPage-allocation")).toBeNull();
    expect(screen.queryByRole("note")).toBeNull();
  });

  test("no allocation notice when the response leaves the field out", async () => {
    const { allocation, ...withoutField } =
      instructorRecruitmentsFixtures.candidateRankingPage;
    expect(allocation).toBeNull();
    axiosMock.onGet(rankingUrl).reply(200, withoutField);
    renderPage();

    await screen.findByTestId("CandidateRankingPage-quarter");
    expect(screen.queryByTestId("CandidateRankingPage-allocation")).toBeNull();
  });

  test("once shown, the notice opens the page with the allocation and how many to rank", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(
        200,
        instructorRecruitmentsFixtures.candidateRankingPageWithAllocation,
      );
    renderPage();

    const notice = await screen.findByTestId("CandidateRankingPage-allocation");
    expect(notice).toHaveTextContent(
      "2 TAs have been allocated to this course. Please rank at least 2 candidates, and preferably 4.",
    );
    expect(notice).toHaveAttribute("role", "note");
    expect(notice).toHaveClass("lead");
    expect(screen.getByRole("note")).toBe(notice);
    // Above the recruitment details, as the design asks (top of the page).
    expect(
      notice.compareDocumentPosition(
        screen.getByRole("heading", { level: 2, name: "Recruitment" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the notice is singular for one ULA", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      type: "ULA",
      allocation: 1,
    });
    renderPage();

    expect(
      await screen.findByTestId("CandidateRankingPage-allocation"),
    ).toHaveTextContent(
      "1 ULA has been allocated to this course. Please rank at least 1 candidate, and preferably 2.",
    );
  });

  test("an allocation of zero is still announced", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      allocation: 0,
    });
    renderPage();

    expect(
      await screen.findByTestId("CandidateRankingPage-allocation"),
    ).toHaveTextContent("0 TAs have been allocated to this course.");
  });
});
