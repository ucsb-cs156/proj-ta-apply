import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import DeveloperModeFooterProvider from "main/components/Nav/DeveloperModeFooterProvider";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

/**
 * The page through its real layout, with the provider App puts around every route. Nothing here
 * stands in for the footer: the buttons must get from the page into the real Footer.
 */
function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/admin/recruitments/1/applications"]}>
        <DeveloperModeFooterProvider>
          <Routes>
            <Route
              path="/admin/recruitments/:recruitmentId/applications"
              element={<RecruitmentApplicationsPage />}
            />
          </Routes>
        </DeveloperModeFooterProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const course = (id, removed = false) => ({ id, courseId: `C${id}`, removed });

/** True when `before` comes ahead of `after` in the document. */
const precedes = (before, after) =>
  Boolean(
    before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

describe("RecruitmentApplicationsPage fake application controls", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
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
      .reply(200, [course(1), course(2), course(3, true)]);
  });

  test("with developer mode on, a red Create button sits in the footer just left of the badge", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderPage();

    const create = await screen.findByTestId(
      "RecruitmentApplicationsPage-fake-create",
    );
    const remove = screen.getByTestId(
      "RecruitmentApplicationsPage-fake-delete",
    );
    const badge = screen.getByTestId("Footer-developer-mode-badge");
    const footer = screen.getByTestId("Footer-developer-mode");

    expect(footer).toContainElement(create);
    expect(footer).toContainElement(remove);
    expect(create).toHaveClass("btn", "btn-danger", "btn-sm");
    expect(create).not.toHaveClass("btn-outline-danger");
    expect(remove).toHaveClass("btn", "btn-outline-danger", "btn-sm");
    // Left to right: Delete, Create, then the badge, so Create is the button beside it.
    expect(precedes(remove, create)).toBe(true);
    expect(precedes(create, badge)).toBe(true);
    expect(footer.lastChild).toBe(badge);
  });

  test("with developer mode off, neither button is anywhere", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    renderPage();

    await screen.findByTestId("RecruitmentApplicationsPage-count");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/developerMode"),
      ).toHaveLength(1),
    );
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-fake-create"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-fake-delete"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("Footer-developer-mode-badge")).toBeNull();
  });

  test("the controls are sized by the courses not removed", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderPage();

    await userEvent.click(
      await screen.findByTestId("RecruitmentApplicationsPage-fake-create"),
    );
    const request = axiosMock.history.get.find(
      (r) => r.url === "/api/recruitmentcourses/all",
    );
    expect(request.params).toEqual({
      recruitmentId: "1",
      includeRemoved: false,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentApplicationsPage-fake-count-help"),
      ).toHaveTextContent("Between 4 and 20"),
    );
  });

  test("a course list that is not an array counts as no courses", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    axiosMock.onGet("/api/recruitmentcourses/all").reply(200, null);
    renderPage();

    await userEvent.click(
      await screen.findByTestId("RecruitmentApplicationsPage-fake-create"),
    );
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-fake-no-courses"),
    ).toBeInTheDocument();
  });
});
