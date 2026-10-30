import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// S26 TA CLOSED never opened (id 3); W26 ULA OPEN (id 2); W26 TA CLOSED on 2026-02-01 (id 1).
const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

function renderHome(currentUserFixture, backend = {}) {
  const queryClient = new QueryClient();
  axiosMock.reset();
  axiosMock.resetHistory();
  axiosMock.onGet("/api/currentUser").reply(200, currentUserFixture);
  axiosMock
    .onGet("/api/systemInfo")
    .reply(200, systemInfoFixtures.showingNeither);
  axiosMock
    .onGet("/api/admin/recruitments/all")
    .reply(200, backend.adminRecruitments ?? []);
  axiosMock
    .onGet("/api/recruitments/applicable")
    .reply(200, backend.recruitments ?? []);
  axiosMock
    .onGet("/api/applications/mine")
    .reply(200, backend.applications ?? []);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePageLoggedIn />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePageLoggedIn tests", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 2, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Issue #118: no page title or greeting; the navbar already carries both. */
  test("has no TA Apply heading and no greeting", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);
    await screen.findByTestId("HomePageLoggedIn-student");
    expect(screen.queryByTestId("HomePageLoggedIn-greeting")).toBeNull();
    expect(screen.queryByText("Welcome, Gaucho.")).toBeNull();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  // ---- the sections per role (issue #107) ----

  test("a plain user gets only the Student section, without its heading", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);

    expect(
      await screen.findByTestId("HomePageLoggedIn-student"),
    ).toBeInTheDocument();
    // Issue #118: with nothing to tell it from, the section needs no heading.
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.queryByText("Student")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toHaveTextContent("Applications are not currently being accepted.");
    // The admin's list is not asked for.
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/admin/recruitments/all",
      ),
    ).toHaveLength(0);
  });

  test("an admin gets the Admin section with the recruitments table, then Student", async () => {
    renderHome(apiCurrentUserFixtures.adminUser, {
      adminRecruitments: recruitmentsFixtures.threeRecruitments,
    });

    expect(
      await screen.findByTestId("HomePageLoggedIn-admin"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Admin", "Student"]);
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
    expect(
      await screen.findByTestId(
        "HomePageLoggedIn-admin-recruitments-cell-row-0-col-quarter",
      ),
    ).toHaveTextContent("S26");
    expect(
      screen.getByTestId(
        "HomePageLoggedIn-admin-recruitments-cell-row-2-col-actualClosingDate",
      ),
    ).toHaveTextContent("2026-02-01");
    // Admins are students too, as far as applying goes.
    expect(screen.getByTestId("HomePageLoggedIn-student")).toBeInTheDocument();
  });

  test("an instructor gets the Instructor section, then Student", async () => {
    renderHome(apiCurrentUserFixtures.instructorUser);

    expect(
      await screen.findByTestId("HomePageLoggedIn-instructor-soon"),
    ).toHaveTextContent("Instructor Functions Coming Soon");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Instructor", "Student"]);
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
  });

  test("a user who is both admin and instructor gets all three sections in order", async () => {
    renderHome(apiCurrentUserFixtures.adminAndInstructorUser);

    await screen.findByTestId("HomePageLoggedIn-admin");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Admin", "Instructor", "Student"]);
  });

  // ---- the student section is fed from the backend ----

  test("the recruitments and applications feed the student section", async () => {
    renderHome(apiCurrentUserFixtures.userOnly, {
      recruitments: recruitmentsFixtures.threeRecruitments,
      applications: [applicationsFixtures.oneUlaApplication],
    });

    expect(
      await screen.findByTestId(
        "HomePageLoggedIn-dashboard-upcoming-cell-row-0-col-quarter",
      ),
    ).toHaveTextContent("S26");
    expect(
      screen.getByTestId("HomePageLoggedIn-dashboard-current-card-2-applied"),
    ).toHaveTextContent("Application on File");
    expect(
      screen.getByTestId("HomePageLoggedIn-dashboard-current-card-1-apply"),
    ).toBeDisabled();
    expect(upcomingTa.id).toBe(3);
    expect(openUla.id).toBe(2);
    expect(closedTa.id).toBe(1);
  });

  test("a past application is listed under Past Recruitments", async () => {
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
    renderHome(apiCurrentUserFixtures.userOnly, {
      recruitments: recruitmentsFixtures.threeRecruitments,
      applications: [applicationsFixtures.oneTaApplication],
    });

    expect(
      await screen.findByTestId(
        "HomePageLoggedIn-dashboard-past-cell-row-0-col-view-link",
      ),
    ).toHaveAttribute("href", "/applications/1");
  });

  test("nothing is asked of the backend while nobody is signed in", async () => {
    // A 403 from currentUser is how the hook learns nobody is signed in.
    axiosMock.reset();
    axiosMock.onGet("/api/currentUser").reply(403);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock.onGet("/api/applications/mine").reply(200, []);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <HomePageLoggedIn />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByTestId("HomePageLoggedIn-student");
    await waitFor(() =>
      expect(
        axiosMock.history.get.some((r) => r.url === "/api/currentUser"),
      ).toBe(true),
    );
    expect(
      axiosMock.history.get.filter(
        (r) =>
          r.url === "/api/applications/mine" ||
          r.url === "/api/recruitments/applicable",
      ),
    ).toHaveLength(0);
  });
});
