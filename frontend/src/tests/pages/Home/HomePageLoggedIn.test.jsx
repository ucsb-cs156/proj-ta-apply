import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

function renderHome(currentUserFixture, backend = {}) {
  const queryClient = new QueryClient();
  axiosMock.reset();
  axiosMock.resetHistory();
  axiosMock.onGet("/api/currentUser").reply(200, currentUserFixture);
  axiosMock
    .onGet("/api/systemInfo")
    .reply(200, systemInfoFixtures.showingNeither);
  axiosMock.onGet("/api/recruitments/open").reply(200, backend.open ?? []);
  axiosMock
    .onGet("/api/recruitments/upcoming")
    .reply(200, backend.upcoming ?? []);
  axiosMock
    .onGet("/api/recruitments/recentlyClosed")
    .reply(200, backend.recentlyClosed ?? []);
  axiosMock
    .onGet("/api/recruitments/applicable")
    .reply(200, backend.applicable ?? []);
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
  test("greets the user by given name", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);
    expect(
      await screen.findByTestId("HomePageLoggedIn-greeting"),
    ).toHaveTextContent("Welcome, Gaucho.");
  });

  // ---- role messages ----

  test("an admin sees the admin message but is not treated as an applicant", async () => {
    renderHome(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HomePageLoggedIn-admin");
    // Roles are independent: admin does not imply anything else.
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-dashboard")).toBeNull();
  });

  test("an instructor sees the instructor message and no dashboard", async () => {
    renderHome(apiCurrentUserFixtures.instructorUser);
    await screen.findByTestId("HomePageLoggedIn-instructor");
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-dashboard")).toBeNull();
  });

  test("a user who is both admin and instructor sees both messages and no dashboard", async () => {
    renderHome(apiCurrentUserFixtures.adminAndInstructorUser);
    await screen.findByTestId("HomePageLoggedIn-admin");
    expect(
      screen.getByTestId("HomePageLoggedIn-instructor"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("HomePageLoggedIn-dashboard")).toBeNull();
  });

  /** Nobody who cannot apply should be asking the applicant endpoints anything. */
  test("a non-applicant does not query the applicant endpoints", async () => {
    renderHome(apiCurrentUserFixtures.adminUser);

    await screen.findByTestId("HomePageLoggedIn-admin");
    expect(
      axiosMock.history.get.filter((r) =>
        r.url.startsWith("/api/applications"),
      ),
    ).toHaveLength(0);
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/recruitments/open"),
    ).toHaveLength(0);
  });

  // ---- the applicant dashboard ----

  /** A user with no other role is an applicant, and there is no TA/ULA split any more. */
  test("a plain user gets the dashboard and is told nothing is open", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toHaveTextContent("Applications are not currently being accepted.");
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
  });

  test("open recruitments of both types give the applicant links to apply", async () => {
    renderHome(apiCurrentUserFixtures.userOnly, {
      open: [openUla, { ...upcomingTa, id: 9 }],
    });

    const link = await screen.findByTestId(
      "HomePageLoggedIn-dashboard-apply-2",
    );
    expect(link).toHaveAttribute("href", "/apply/2");
    expect(
      screen.getByTestId("HomePageLoggedIn-dashboard-open-2"),
    ).toHaveTextContent("ULA positions");
    expect(
      screen.getByTestId("HomePageLoggedIn-dashboard-open-9"),
    ).toHaveTextContent("TA positions");
    expect(
      screen.queryByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toBeNull();
  });

  test("an upcoming recruitment reports its tentative opening date", async () => {
    renderHome(apiCurrentUserFixtures.userOnly, {
      upcoming: [upcomingTa],
    });

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-upcoming-3"),
    ).toHaveTextContent("expected to open on 2026-03-30");
  });

  test("a recently closed recruitment reports its dates", async () => {
    renderHome(apiCurrentUserFixtures.userOnly, {
      recentlyClosed: [closedTa],
    });

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-closed-1"),
    ).toHaveTextContent("opened on 2026-01-06 and closed on 2026-02-01");
  });

  test("the applicant's own applications are listed", async () => {
    renderHome(apiCurrentUserFixtures.userOnly, {
      applications: [applicationsFixtures.oneUlaApplication],
      applicable: [openUla],
    });

    expect(
      await screen.findByTestId(
        "HomePageLoggedIn-dashboard-applications-cell-row-0-col-status",
      ),
    ).toHaveTextContent("PENDING");
  });

  test("an applicant who has never applied is told so", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-no-applications"),
    ).toHaveTextContent("You have not applied for any positions yet.");
  });
});
