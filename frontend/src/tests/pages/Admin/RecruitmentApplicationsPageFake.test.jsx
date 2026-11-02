import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import {
  DeveloperModeFooterControlsContext,
  DeveloperModeFooterSetterContext,
} from "main/utils/developerModeFooter";
import { useState } from "react";

const axiosMock = new AxiosMockAdapter(axios);

/** Stands in for the footer: shows whatever controls the page registers. */
function FooterHost({ children }) {
  const [controls, setControls] = useState(null);
  return (
    <DeveloperModeFooterSetterContext.Provider value={setControls}>
      <DeveloperModeFooterControlsContext.Provider value={controls}>
        {children}
        <div data-testid="footer-slot">{controls}</div>
      </DeveloperModeFooterControlsContext.Provider>
    </DeveloperModeFooterSetterContext.Provider>
  );
}

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/admin/recruitments/1/applications"]}>
        <FooterHost>
          <Routes>
            <Route
              path="/admin/recruitments/:recruitmentId/applications"
              element={<RecruitmentApplicationsPage />}
            />
          </Routes>
        </FooterHost>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const course = (id, removed = false) => ({ id, courseId: `C${id}`, removed });

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
  });

  test("registers the controls in the footer, sized by the courses not removed", async () => {
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, [course(1), course(2), course(3, true)]);
    renderPage();

    await screen.findByTestId("RecruitmentApplicationsPage-fake-create");
    expect(screen.getByTestId("footer-slot")).toContainElement(
      screen.getByTestId("RecruitmentApplicationsPage-fake-delete"),
    );
    const request = axiosMock.history.get.find(
      (r) => r.url === "/api/recruitmentcourses/all",
    );
    expect(request.params).toEqual({
      recruitmentId: "1",
      includeRemoved: false,
    });

    await userEvent.click(
      screen.getByTestId("RecruitmentApplicationsPage-fake-create"),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentApplicationsPage-fake-count-help"),
      ).toHaveTextContent("Between 4 and 20"),
    );
  });

  test("a course list that is not an array counts as no courses", async () => {
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
