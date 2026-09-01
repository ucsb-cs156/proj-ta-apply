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

  test("the request-access message is shown for ROLE_UNDERGRAD", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);
    expect(
      await screen.findByTestId("HomePageLoggedIn-undergrad"),
    ).toBeInTheDocument();
  });

  /** The backend withholds ROLE_UNDERGRAD from a non-UCSB address, so the message is withheld. */
  test("a signed-in user without ROLE_UNDERGRAD sees no request-access message", async () => {
    renderHome(apiCurrentUserFixtures.nonUcsbUser);

    await screen.findByTestId("HomePageLoggedIn-greeting");
    expect(screen.queryByTestId("HomePageLoggedIn-undergrad")).toBeNull();
  });

  test("an admin sees the admin message but is not treated as an applicant", async () => {
    renderHome(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HomePageLoggedIn-admin");
    // Roles are independent: admin does not imply anything else.
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-undergrad")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-dashboard")).toBeNull();
  });

  test("an instructor sees the instructor message and no dashboard", async () => {
    renderHome(apiCurrentUserFixtures.instructorUser);
    await screen.findByTestId("HomePageLoggedIn-instructor");
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-undergrad")).toBeNull();
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

  test("a grad student is told about TA positions", async () => {
    renderHome(apiCurrentUserFixtures.gradStudentUser);

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toHaveTextContent(
      "Applications for TA positions are not currently being accepted.",
    );
    // A grad student is not asked to request access.
    expect(screen.queryByTestId("HomePageLoggedIn-undergrad")).toBeNull();
  });

  test("an undergrad is told about ULA positions", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toHaveTextContent(
      "Applications for ULA positions are not currently being accepted.",
    );
  });

  test("an open recruitment gives the applicant a link to apply", async () => {
    renderHome(apiCurrentUserFixtures.userOnly, { open: [openUla] });

    const link = await screen.findByTestId(
      "HomePageLoggedIn-dashboard-apply-2",
    );
    expect(link).toHaveAttribute("href", "/apply/2");
    expect(
      screen.queryByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toBeNull();
  });

  test("an upcoming recruitment reports its tentative opening date", async () => {
    renderHome(apiCurrentUserFixtures.gradStudentUser, {
      upcoming: [upcomingTa],
    });

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-upcoming-3"),
    ).toHaveTextContent("expected to open on 2026-03-30");
  });

  test("a recently closed recruitment reports its dates", async () => {
    renderHome(apiCurrentUserFixtures.gradStudentUser, {
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
    renderHome(apiCurrentUserFixtures.gradStudentUser);

    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-no-applications"),
    ).toHaveTextContent("You have not applied for any TA positions yet.");
  });

  /** Instructor and grad student are independent, and the grad student half still applies. */
  test("a user who is both instructor and grad student sees both", async () => {
    renderHome(apiCurrentUserFixtures.instructorAndGradStudentUser);

    await screen.findByTestId("HomePageLoggedIn-instructor");
    expect(
      await screen.findByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toHaveTextContent("TA positions");
  });
});
