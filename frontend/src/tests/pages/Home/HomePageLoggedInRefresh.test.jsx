import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

/** Issue #281: the pages update by themselves; the intervals are the shortest allowed, 1 s. */
const fastRefresh = {
  ...systemInfoFixtures.showingNeither,
  adminRefreshSec: 1,
  adminRefreshJitter: 0,
  nonAdminRefresh: 1,
  nonAdminJitter: 0,
};

function renderHome(currentUserFixture) {
  axiosMock.reset();
  axiosMock.resetHistory();
  axiosMock.onGet("/api/currentUser").reply(200, currentUserFixture);
  axiosMock.onGet("/api/systemInfo").reply(200, fastRefresh);
  axiosMock
    .onGet(/\/api\/admin\/recruitments\/\d+\/steps$/)
    .reply(200, recruitmentStepsFixtures.fresh);
  axiosMock.onGet("/api/admin/recruitments/applicationCounts").reply(200, {});
  axiosMock.onGet("/api/applications/mine").reply(200, []);
  axiosMock.onGet("/api/draftApplications/mine").reply(200, []);
  axiosMock.onGet("/api/instructor/recruitments").reply(200, []);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <HomePageLoggedIn />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const gets = (url) => axiosMock.history.get.filter((r) => r.url === url);

describe("HomePageLoggedIn refreshes by itself (issue #281)", () => {
  test("a student sees an application window open and close without reloading", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    await screen.findByTestId("HomePageLoggedIn-dashboard-none-open");

    // An admin opens applications: the next refresh shows them.
    axiosMock.onGet("/api/recruitments/applicable").reply(200, [openUla]);
    expect(
      await screen.findByTestId(
        /^HomePageLoggedIn-dashboard-current-card-\d+-apply$/,
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();

    // And closes them again.
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    expect(
      await screen.findByTestId(
        "HomePageLoggedIn-dashboard-none-open",
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
  }, 15000);

  test("the student sections poll only their light reads, never the admin ones", async () => {
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    renderHome(apiCurrentUserFixtures.userOnly);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    await screen.findByTestId("HomePageLoggedIn-dashboard-none-open");
    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(gets("/api/recruitments/applicable").length).toBeGreaterThan(1);
    expect(gets("/api/applications/mine").length).toBeGreaterThan(1);
    expect(gets("/api/draftApplications/mine").length).toBeGreaterThan(1);
    // A student never asks for the admin endpoints, least of all the one that counts.
    expect(
      axiosMock.history.get.filter((r) => r.url.startsWith("/api/admin")),
    ).toHaveLength(0);
  }, 10000);

  test("an admin's recruitment cards follow changes made elsewhere", async () => {
    renderHome(apiCurrentUserFixtures.adminUser);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [closedTa]);
    expect(
      await screen.findByTestId("HomePageLoggedIn-admin-card-0-quarter"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("HomePageLoggedIn-admin-card-1-quarter"),
    ).toBeNull();

    // Another admin creates a second recruitment.
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [openUla, closedTa]);
    expect(
      await screen.findByTestId(
        "HomePageLoggedIn-admin-card-1-quarter",
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    // The step panel of each card refreshed too.
    expect(
      gets("/api/admin/recruitments/1/steps").length,
    ).toBeGreaterThanOrEqual(1);
  }, 15000);

  test("the heavy count endpoint is read once, not on the refresh", async () => {
    renderHome(apiCurrentUserFixtures.adminUser);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [closedTa]);
    await screen.findByTestId("HomePageLoggedIn-admin-card-0-quarter");
    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(
      gets("/api/admin/recruitments/applicationCounts").length,
    ).toBeLessThanOrEqual(1);
    expect(gets("/api/admin/recruitments/all").length).toBeGreaterThan(1);
  }, 10000);
});
