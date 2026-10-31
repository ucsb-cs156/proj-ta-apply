import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import CandidateApplicationPage from "main/pages/Instructor/CandidateApplicationPage";
import candidateApplicationsFixtures from "fixtures/candidateApplicationsFixtures";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mock = new AxiosMockAdapter(axios);
const base = "/api/instructor/recruitments/1/courses/2";
function renderPage(path = "/recruitments/1/courses/2/applications/1") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/recruitments/:recruitmentId/courses/:recruitmentCourseId/applications/:applicationId"
            element={<CandidateApplicationPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CandidateApplicationPage", () => {
  beforeEach(() => {
    mock.reset();
    mock.resetHistory();
    mock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);
    mock.onGet("/api/systemInfo").reply(200, systemInfoFixtures.showingNeither);
    mock
      .onGet(`${base}/ranking`)
      .reply(200, instructorRecruitmentsFixtures.candidateRankingPage);
    mock.onGet(`${base}/candidates/1`).reply(200, {
      ...candidateApplicationsFixtures.ta,
      answers: {
        ...candidateApplicationsFixtures.ta.answers,
        noticeVersionId: 9,
      },
    });
    mock.onGet("/api/quarters/one").reply(404, {});
    mock.onGet("/api/notices").reply(200, {
      id: 9,
      type: "TA",
      createdAt: "2026-01-02T03:04:05",
      content: "Terms for ${quarter}, deadline ${primaryConsiderationDate}.",
    });
  });

  test("full TA answers reuse the read-only summary and agreed notice, without admin controls", async () => {
    renderPage();
    expect(await screen.findByText("Ada M Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Email: grad@ucsb.edu")).toBeInTheDocument();
    expect(screen.getByText("PhD")).toBeInTheDocument();
    expect(screen.getByText("3.9")).toBeInTheDocument();
    expect(
      screen.getByText("Previous Teaching Experience"),
    ).toBeInTheDocument();
    expect(screen.getByText("Other Courses of Interest")).toBeInTheDocument();
    expect(screen.getByText("Anything Else")).toBeInTheDocument();
    const courses = within(screen.getByTestId("ApplicationSummary-coursework"));
    expect(courses.getByText("CMPSC 263")).toBeInTheDocument();
    expect(courses.getByText("Another University")).toBeInTheDocument();
    expect(courses.queryByText("Edit")).not.toBeInTheDocument();
    expect(courses.queryByText("Delete")).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /Terms for Winter 2026, deadline January 20, 2026/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(
      screen.getByText("This application is read-only."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Save|Edit|Delete|Hire|Cancel/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin Comments/)).not.toBeInTheDocument();
    expect(
      mock.history.get.some(
        (request) => request.url === "/api/notices" && request.params.id === 9,
      ),
    ).toBe(true);
  });

  test("applicant-written follow-up comments are visible as read-only text, not HTML or staff notes", async () => {
    mock.onGet(`${base}/candidates/1`).reply(200, {
      ...candidateApplicationsFixtures.ta,
      postApplicationComments: "Applicant follow-up\n<script>unsafe()</script>",
    });
    renderPage();
    const comments = within(
      await screen.findByRole("region", { name: "Post-Application Comments" }),
    );
    expect(comments.getByText(/Applicant follow-up/)).toHaveTextContent(
      "Applicant follow-up <script>unsafe()</script>",
    );
    expect(comments.getByText(/Applicant follow-up/)).toHaveStyle({
      whiteSpace: "pre-wrap",
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByText("Admin Comments")).not.toBeInTheDocument();
  });

  test("null applicant follow-up comments have an explicit empty read-only display", async () => {
    mock.onGet(`${base}/candidates/1`).reply(200, {
      ...candidateApplicationsFixtures.ta,
      postApplicationComments: null,
    });
    renderPage();
    expect(
      within(
        await screen.findByRole("region", {
          name: "Post-Application Comments",
        }),
      ).getByText("None"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("ULA displays all ULA answers and no TA-only fields; no agreed notice is requested for legacy answers", async () => {
    mock.onGet(`${base}/ranking`).reply(200, {
      ...instructorRecruitmentsFixtures.candidateRankingPage,
      type: "ULA",
    });
    mock.onGet(`${base}/candidates/1`).reply(200, {
      ...candidateApplicationsFixtures.ula,
      answers: {
        ...candidateApplicationsFixtures.ula.answers,
        noticeVersionId: null,
      },
    });
    renderPage();
    expect(await screen.findByText("Perm Number")).toBeInTheDocument();
    for (const label of [
      "Video Link",
      "BS/MS Student",
      "Student Status in the Quarter Applied For",
      "Other Campus Job",
      "Prior UCSB Employment",
      "Employee ID",
      "I-9 Verification Agreement",
      "Training Commitment",
      "Training Commitment Explanation",
      "Changing Major",
      "Quarters Previously Served as a ULA",
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("TA Language Exam")).not.toBeInTheDocument();
    expect(
      mock.history.get.some((request) => request.url === "/api/notices"),
    ).toBe(false);
  });

  test("invalid links make no course-scoped requests", () => {
    renderPage("/recruitments/bad/courses/2/applications/1");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This candidate-application link is invalid.",
    );
    expect(
      mock.history.get.some((request) =>
        request.url.startsWith("/api/instructor"),
      ),
    ).toBe(false);
  });

  test.each(["application", "metadata"])(
    "successful null %s response is an explicit error, never infinite loading",
    async (which) => {
      mock
        .onGet(
          which === "application" ? `${base}/candidates/1` : `${base}/ranking`,
        )
        .reply(200, null);
      renderPage();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "No candidate-application details were returned.",
      );
      expect(
        screen.queryByText("Loading candidate application..."),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("ApplicationSummary"),
      ).not.toBeInTheDocument();
    },
  );

  test("pending application requests have a genuine loading state", async () => {
    let finish;
    mock.onGet(`${base}/candidates/1`).reply(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading candidate application...",
    );
    finish([200, candidateApplicationsFixtures.ta]);
    expect(await screen.findByText("Ada M Lovelace")).toBeInTheDocument();
  });

  test("a successful null agreed-notice response is explicit, not hidden or endlessly loading", async () => {
    mock.onGet("/api/notices").reply(200, null);
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No agreed terms were returned.",
    );
    expect(
      screen.queryByText("Loading agreed terms..."),
    ).not.toBeInTheDocument();
  });

  test.each(["application", "metadata"])(
    "%s request failure shows the server denial, not a summary",
    async (which) => {
      mock
        .onGet(
          which === "application" ? `${base}/candidates/1` : `${base}/ranking`,
        )
        .reply(403, { message: "Not assigned to this primary section" });
      renderPage();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Not assigned to this primary section",
      );
      expect(
        screen.queryByTestId("ApplicationSummary"),
      ).not.toBeInTheDocument();
    },
  );

  test("notice failure is explicit while the read-only student answers remain visible", async () => {
    mock.onGet("/api/notices").reply(500, { message: "Notice unavailable" });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load agreed terms: Notice unavailable",
    );
    expect(screen.getByText("Ada M Lovelace")).toBeInTheDocument();
  });
});
