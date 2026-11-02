import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import App from "App";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

/**
 * The whole app, routed to a page that registers footer controls. This is the test that fails if
 * the footer's provider ends up below the pages again: the page would register into a slot the
 * footer never reads, and the buttons would be nowhere (issue #219).
 */
describe("App", () => {
  beforeEach(() => {
    axiosMock.reset();
    window.history.pushState({}, "", "/admin/recruitments/1/applications");
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, recruitmentsFixtures.threeRecruitments);
    axiosMock.onGet("/api/admin/applications/all").reply(200, []);
    axiosMock
      .onGet("/api/admin/recruitmentaudittrail/all")
      .reply(200, recruitmentAuditTrailFixtures.onePage);
    axiosMock
      .onGet("/api/admin/hiddencolumns")
      .reply(200, defaultHiddenColumns("TA"));
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, [{ id: 1, courseId: "C1", removed: false }]);
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  function renderApp() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>,
    );
  }

  test("the Applications page puts its Create button in the footer, left of the badge", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderApp();

    const create = await screen.findByTestId(
      "RecruitmentApplicationsPage-fake-create",
    );
    const badge = screen.getByTestId("Footer-developer-mode-badge");
    expect(screen.getByTestId("Footer-developer-mode")).toContainElement(
      create,
    );
    expect(create).toHaveClass("btn-danger");
    expect(
      Boolean(
        create.compareDocumentPosition(badge) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  test("with developer mode off the page shows no fake-data controls", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    renderApp();

    await screen.findByTestId("RecruitmentApplicationsPage-count");
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-fake-create"),
    ).not.toBeInTheDocument();
  });

  test("/help/developer is the Developer help page, for admins only (issue #266)", async () => {
    window.history.pushState({}, "", "/help/developer");
    renderApp();
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Developers" }),
    ).toBeInTheDocument();
    cleanup();

    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    renderApp();
    expect(
      await screen.findByText("You do not have access to this page."),
    ).toBeInTheDocument();
    expect(screen.queryByText("For Developers")).toBeNull();
  });

  test("the admin home page puts Auto Create Recruitments in the footer, left of the badge (issue #252)", async () => {
    window.history.pushState({}, "", "/");
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    axiosMock.onGet("/api/admin/recruitments/applicationCounts").reply(200, {});
    axiosMock.onGet("/api/recruitments/applicable").reply(200, []);
    axiosMock.onGet("/api/applications/mine").reply(200, []);
    axiosMock
      .onGet(/\/api\/admin\/recruitments\/\d+\/steps$/)
      .reply(200, recruitmentStepsFixtures.fresh);
    renderApp();

    const auto = await screen.findByTestId(
      "HomePageLoggedIn-admin-auto-create-button",
    );
    const badge = screen.getByTestId("Footer-developer-mode-badge");
    expect(screen.getByTestId("Footer-developer-mode")).toContainElement(auto);
    expect(auto).toHaveClass("btn-danger");
    expect(
      Boolean(
        auto.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });
});
