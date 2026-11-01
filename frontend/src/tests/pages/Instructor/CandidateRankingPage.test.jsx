import userEvent from "@testing-library/user-event";
import { render, screen, within, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import CandidateRankingPage from "main/pages/Instructor/CandidateRankingPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import candidatesFixtures, {
  candidatesWithNotInterested,
} from "fixtures/candidatesFixtures";
import cancelledApplicationsFixtures from "fixtures/cancelledApplicationsFixtures";

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
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/cancelled")
      .reply(200, cancelledApplicationsFixtures.two);
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
    expect(
      screen.getByTestId("CandidateRankingPage-tentative-opening"),
    ).toHaveTextContent("2025-12-01");
    expect(
      screen.getByTestId("CandidateRankingPage-primary-consideration"),
    ).toHaveTextContent("2026-01-20");
    expect(
      screen.getByTestId("CandidateRankingPage-actual-opening"),
    ).toHaveTextContent("2026-01-06");
    expect(
      screen.getByTestId("CandidateRankingPage-actual-closing"),
    ).toHaveTextContent("2026-02-01");
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
    expect((await screen.findAllByRole("table"))[0]).toBeInTheDocument();
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
    await screen.findAllByRole("table");
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

  // ---- the targets table (issue #224) ----

  test("once released, the targets table opens the page above the notice", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(
        200,
        instructorRecruitmentsFixtures.candidateRankingPageWithAllocation,
      );
    renderPage();

    const table = await screen.findByTestId("CandidateRankingPage-targets");
    expect(
      [...table.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "HiringTarget",
      "RankingTarget",
      "CandidatesRanked",
      "RankingsStillNeeded",
    ]);
    expect(
      screen.getByTestId("CandidateRankingPage-hiring-target"),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId("CandidateRankingPage-ranking-target"),
    ).toHaveTextContent("4");
    expect(
      screen.getByTestId("CandidateRankingPage-candidates-ranked"),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId("CandidateRankingPage-rankings-still-needed"),
    ).toHaveTextContent("3");
    // The table comes first, then the sentence, then the recruitment details.
    const notice = screen.getByTestId("CandidateRankingPage-allocation");
    expect(
      table.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      notice.compareDocumentPosition(
        screen.getByRole("heading", { level: 2, name: "Recruitment" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("no targets table while withheld, whether the field is null or absent", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    renderPage();
    await screen.findByTestId("CandidateRankingPage-quarter");
    expect(screen.queryByTestId("CandidateRankingPage-targets")).toBeNull();

    const { targets, ...withoutField } =
      instructorRecruitmentsFixtures.candidateRankingPageWithAllocation;
    expect(targets).toBeDefined();
    axiosMock.onGet(rankingUrl).reply(200, { ...withoutField, allocation: 1 });
    renderPage();
    await screen.findByTestId("CandidateRankingPage-quarter");
    expect(screen.queryByTestId("CandidateRankingPage-targets")).toBeNull();
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

  // ---- issue #199 ----

  const candidatesRequests = () =>
    axiosMock.history.get.filter(
      (r) => r.url === "/api/instructor/recruitments/1/courses/2/candidates",
    );

  test("asks for interested candidates only, until the box is ticked, then warns", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    // Replaces the beforeEach handler for this url: the answer depends on the parameter.
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/candidates")
      .reply((config) => [
        200,
        config.params.includeNotInterested
          ? candidatesWithNotInterested
          : candidatesFixtures,
      ]);
    renderPage();

    const box = await screen.findByTestId(
      "CandidateRankingPage-include-not-interested",
    );
    expect(
      screen.getByLabelText(
        'Include candidates that marked my course with "Not Interested/Not Applicable"',
      ),
    ).toBe(box);
    expect(box).not.toBeChecked();
    await waitFor(() => expect(candidatesRequests()).toHaveLength(1));
    expect(candidatesRequests()[0].params).toEqual({
      includeNotInterested: false,
    });
    expect(
      screen.queryByTestId("CandidateRankingPage-not-interested-warning"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Edsger")).not.toBeInTheDocument();
    // The checkbox sits after the candidates table.
    const table = screen.getAllByRole("table")[0];
    expect(
      table.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByTestId("CandidateRankingPage-legend"),
    ).toBeInTheDocument();

    await userEvent.click(box);

    expect(box).toBeChecked();
    await waitFor(() => expect(candidatesRequests()).toHaveLength(2));
    expect(candidatesRequests()[1].params).toEqual({
      includeNotInterested: true,
    });
    expect(await screen.findByText("Edsger")).toBeInTheDocument();
    const warning = screen.getByTestId(
      "CandidateRankingPage-not-interested-warning",
    );
    expect(warning).toHaveTextContent(
      "Consider whether you should rank candidates that did not express interest in your course",
    );
    expect(warning).toHaveClass("text-danger", "fw-bold");
    expect(warning).toHaveAttribute("role", "alert");
    expect(
      screen.getByTestId("CandidateRankingPage-danger-icon"),
    ).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByTestId("CandidateTable-preference-99-mark"),
    ).toHaveTextContent("✖");

    await userEvent.click(box);
    expect(box).not.toBeChecked();
    await waitFor(() =>
      expect(screen.queryByText("Edsger")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("CandidateRankingPage-not-interested-warning"),
    ).not.toBeInTheDocument();
  });

  // ---- Issue #221: the Not Interested tier cannot be hidden while one of its candidates is ranked ----

  const rankedNotInterested = candidatesWithNotInterested.map((candidate) =>
    candidate.applicationId === 99 ? { ...candidate, rank: 3 } : candidate,
  );

  test("while a not-interested candidate is ranked, the tier is shown and the box is checked, disabled and explained", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      canRank: true,
      reviewStatus: "Open",
      hasRankedNotInterested: true,
    });
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/candidates")
      .reply((config) => [
        200,
        config.params.includeNotInterested
          ? rankedNotInterested
          : candidatesFixtures,
      ]);
    renderPage();

    const box = await screen.findByTestId(
      "CandidateRankingPage-include-not-interested",
    );
    expect(await screen.findByText("Edsger")).toBeInTheDocument();
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    // The narrow list is never asked for: the page knew before it fetched candidates.
    expect(
      candidatesRequests().every((r) => r.params.includeNotInterested === true),
    ).toBe(true);
    expect(
      screen.getByTestId("CandidateRankingPage-not-interested-warning"),
    ).toBeInTheDocument();

    // Hovering the box (through its wrapper) explains why it cannot be cleared.
    await userEvent.hover(box.closest("span.d-inline-block"));
    expect(
      await screen.findByText(
        "This option cannot be deselected when there are ranked candidates in this section",
      ),
    ).toBeInTheDocument();
    expect(box).toBeChecked();
  });

  test("clearing the last ranked not-interested candidate re-enables the box and keeps the tier shown", async () => {
    let stillRanked = true;
    axiosMock.onGet(rankingUrl).reply(() => [
      200,
      {
        ...instructorRecruitmentsFixtures.candidateRankingPage,
        canRank: true,
        reviewStatus: "Open",
        hasRankedNotInterested: stillRanked,
      },
    ]);
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/candidates")
      .reply((config) => [
        200,
        config.params.includeNotInterested
          ? rankedNotInterested
          : candidatesFixtures,
      ]);
    axiosMock
      .onPut("/api/instructor/recruitments/1/courses/2/candidates/99/rank")
      .reply(() => {
        stillRanked = false;
        return [200, { rank: null }];
      });
    renderPage();

    const box = await screen.findByTestId(
      "CandidateRankingPage-include-not-interested",
    );
    await screen.findByText("Edsger");
    expect(box).toBeDisabled();
    const rankingGets = () =>
      axiosMock.history.get.filter((r) => r.url === rankingUrl).length;
    const before = rankingGets();

    await userEvent.clear(
      screen.getByRole("spinbutton", { name: "Ranking for Edsger Dijkstra" }),
    );

    // The page re-reads the ranking details after the save, and the box comes back to life.
    await waitFor(() => expect(box).toBeEnabled());
    expect(rankingGets()).toBeGreaterThan(before);
    // It stays checked and the tier stays on screen: nothing vanishes under the user's hands.
    expect(box).toBeChecked();
    expect(screen.getByText("Edsger")).toBeInTheDocument();
    await userEvent.hover(box);
    expect(
      screen.queryByText(
        "This option cannot be deselected when there are ranked candidates in this section",
      ),
    ).not.toBeInTheDocument();

    // Now the instructor may untick it, as before.
    await userEvent.click(box);
    expect(box).not.toBeChecked();
    await waitFor(() =>
      expect(screen.queryByText("Edsger")).not.toBeInTheDocument(),
    );
  });

  test("without a ranked not-interested candidate (or without the field) the box is enabled and hovering explains nothing", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      hasRankedNotInterested: false,
    });
    renderPage();
    const box = await screen.findByTestId(
      "CandidateRankingPage-include-not-interested",
    );
    expect(box).toBeEnabled();
    expect(box).not.toBeChecked();
    await userEvent.hover(box.closest("span.d-inline-block"));
    expect(
      screen.queryByText(
        "This option cannot be deselected when there are ranked candidates in this section",
      ),
    ).not.toBeInTheDocument();
  });

  test("lists the cancelled applications under the candidates", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    renderPage();

    const cancelled = await screen.findByTestId(
      "CandidateRankingPage-cancelled",
    );
    expect(
      within(cancelled).getByTestId(
        "CandidateRankingPage-cancelled-table-cell-row-0-col-name",
      ),
    ).toHaveTextContent("Grace Hopper");
    expect(
      within(cancelled).getByTestId(
        "CandidateRankingPage-cancelled-table-cell-row-0-col-cancellationReason",
      ),
    ).toHaveTextContent("Took a position in another department");
    expect(
      screen.getByTestId("CandidateRankingPage-cancelled-why"),
    ).toHaveTextContent("not among the candidates above");
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/instructor/recruitments/1/courses/2/cancelled",
      ),
    ).toHaveLength(1);
    const box = screen.getByTestId(
      "CandidateRankingPage-include-not-interested",
    );
    expect(
      box.compareDocumentPosition(cancelled) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("says so when no one has cancelled, and reports a failed cancelled fetch", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/cancelled")
      .reply(200, []);
    const { unmount } = renderPage();
    expect(
      await screen.findByTestId("CandidateRankingPage-cancelled-empty"),
    ).toHaveTextContent("No applicant has cancelled their application.");
    unmount();

    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/cancelled")
      .reply(500, { message: "Cancelled unavailable" });
    renderPage();
    expect(
      await screen.findByText(
        "Unable to load cancelled applications: Cancelled unavailable",
      ),
    ).toHaveAttribute("role", "alert");
    expect(
      screen.queryByTestId("CandidateRankingPage-cancelled"),
    ).not.toBeInTheDocument();
    // The page reports the failure itself; no toast.
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("an invalid link asks for neither candidates nor cancelled applications", async () => {
    renderPage("/recruitments/x/courses/2/ranking");
    expect(
      await screen.findByText("This candidate-ranking link is invalid."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/currentUser"),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.get.filter(
        (r) => r.url.endsWith("/cancelled") || r.url.endsWith("/candidates"),
      ),
    ).toHaveLength(0);
  });

  test("shows the empty cancelled state while the cancelled list is still loading", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    axiosMock
      .onGet("/api/instructor/recruitments/1/courses/2/cancelled")
      .reply(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve([200, cancelledApplicationsFixtures.two]),
              300,
            ),
          ),
      );
    renderPage();

    expect(
      await screen.findByTestId("CandidateRankingPage-cancelled-empty"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(
        "CandidateRankingPage-cancelled-table-cell-row-0-col-name",
      ),
    ).toHaveTextContent("Grace Hopper");
  });

  /** Issue #205: the details are one-row tables, so the rankings are visible without scrolling. */
  test("the recruitment and course details are one-row tables with stacked headings", async () => {
    axiosMock
      .onGet(rankingUrl)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    renderPage();
    await screen.findByTestId("CandidateRankingPage-quarter");

    const recruitment = screen.getByTestId("CandidateRankingPage-recruitment");
    expect(recruitment).toHaveClass("w-auto");
    expect(recruitment.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(
      [...recruitment.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "Quarter",
      "Type",
      "TentativeOpening",
      "PrimaryConsideration",
      "ActuallyOpened",
      "ActuallyClosed",
      "FacultyReviewsOpened",
      "FacultyRankingDeadline",
    ]);
    // "Faculty Ranking Deadline" is longer than a date, so it is shown smaller; so is "Quarter"
    // over "W26"; "Title" over "TITLE 1" is not.
    expect(
      screen.getByTestId(
        "CandidateRankingPage-recruitment-heading-Faculty Ranking Deadline",
      ).style.fontSize,
    ).toBe("80%");
    expect(
      screen.getByTestId("CandidateRankingPage-recruitment-heading-Quarter")
        .style.fontSize,
    ).toBe("80%");
    expect(
      screen.getByTestId("CandidateRankingPage-course-heading-Title").style
        .fontSize,
    ).toBe("");
    expect(
      screen.getByRole("heading", { level: 2, name: "Recruitment" }),
    ).toHaveClass("h5");

    const course = screen.getByTestId("CandidateRankingPage-course");
    expect(
      [...course.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual(["Course", "Section", "Title", "Instructor"]);
    expect(course.querySelectorAll("tbody tr")).toHaveLength(1);
    const courseId = screen
      .getByTestId("CandidateRankingPage-course-id")
      .querySelector("span");
    expect(courseId.style.fontFamily).toBe("monospace");
    expect(courseId.style.whiteSpace).toBe("pre");
  });

  test("missing details show their fallbacks in the tables", async () => {
    axiosMock.onGet(rankingUrl).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      tentativeOpeningDate: null,
      primaryConsiderationDate: null,
      actualOpeningDate: null,
      actualClosingDate: null,
      facultyReviewOpeningDate: null,
      facultyRankingDeadline: null,
      course: {
        ...instructorRecruitmentsFixtures.candidateRankingPage.course,
        section: null,
        title: null,
        instructor: null,
      },
    });
    renderPage();
    await screen.findByTestId("CandidateRankingPage-quarter");

    expect(
      screen.getByTestId("CandidateRankingPage-tentative-opening"),
    ).toHaveTextContent("Not set");
    expect(
      screen.getByTestId("CandidateRankingPage-primary-consideration"),
    ).toHaveTextContent("Not set");
    expect(
      screen.getByTestId("CandidateRankingPage-actual-opening"),
    ).toHaveTextContent("Not opened");
    expect(
      screen.getByTestId("CandidateRankingPage-actual-closing"),
    ).toHaveTextContent("Not closed");
    expect(
      screen.getByTestId("CandidateRankingPage-opening-date"),
    ).toHaveTextContent("Not recorded");
    expect(
      screen.getByTestId("CandidateRankingPage-deadline"),
    ).toHaveTextContent("Not set");
    ["section", "title", "instructor"].forEach((key) => {
      expect(
        screen.getByTestId(`CandidateRankingPage-${key}`),
      ).toHaveTextContent("Not specified");
    });
  });
});
