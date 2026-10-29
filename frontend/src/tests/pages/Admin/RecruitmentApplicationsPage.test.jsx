import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// Recruitment 1 is a closed TA round, 2 an open ULA one.
const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

function renderPage(recruitmentId = 1) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[`/admin/recruitments/${recruitmentId}/applications`]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/applications"
            element={<RecruitmentApplicationsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RecruitmentApplicationsPage tests", () => {
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
    axiosMock
      .onGet("/api/admin/applications/all", { params: { recruitmentId: "1" } })
      .reply(200, [
        applicationsFixtures.oneTaApplication,
        applicationsFixtures.oneTestApplication,
      ]);
    axiosMock
      .onGet("/api/admin/applications/all", { params: { recruitmentId: "2" } })
      .reply(200, [applicationsFixtures.oneUlaApplication]);
  });

  test("names the recruitment in the heading and repeats its row, read only", async () => {
    renderPage(1);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Applications: TA positions, W26",
      }),
    ).toBeInTheDocument();

    // The one recruitment, fields only.
    expect(
      await screen.findByTestId(
        "RecruitmentApplicationsPage-recruitment-cell-row-0-col-quarter",
      ),
    ).toHaveTextContent("W26");
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-recruitment-cell-row-0-col-type",
      ),
    ).toHaveTextContent(closedTa.type);
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-recruitment-cell-row-0-col-actualClosingDate",
      ),
    ).toHaveTextContent("2026-02-01");
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-recruitment-cell-row-1-col-quarter",
      ),
    ).toBeNull();
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-recruitment-cell-row-0-col-delete-button",
      ),
    ).toBeNull();
  });

  test("counts the applications, test ones apart, and lists them with the TA columns", async () => {
    renderPage(1);

    // The count starts at zero and updates once the list arrives.
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentApplicationsPage-count"),
      ).toHaveTextContent("1 Application Received (plus 1 test application)"),
    );

    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-applications-cell-row-0-col-id-link",
      ),
    ).toHaveAttribute("href", "/admin/applications/1");
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-applications-cell-row-1-col-id-test",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Level")).toBeInTheDocument();
    expect(screen.queryByText("Expected Graduation")).toBeNull();

    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/applications/all",
        )[0].params,
      ).toEqual({ recruitmentId: "1" }),
    );
  });

  test("a ULA recruitment gets the ULA columns", async () => {
    renderPage(2);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Applications: ULA positions, W26`,
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentApplicationsPage-count"),
      ).toHaveTextContent("1 Application Received"),
    );
    expect(await screen.findByText("Expected Graduation")).toBeInTheDocument();
    expect(screen.queryByText("Level")).toBeNull();
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-applications-cell-row-0-col-graduationDate",
      ),
    ).toHaveTextContent(applicationsFixtures.oneUlaApplication.graduationDate);
    expect(openUla.type).toBe("ULA");
  });

  test("before the recruitment arrives the heading is plain and the row is empty", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    axiosMock
      .onGet("/api/admin/applications/all", { params: { recruitmentId: "1" } })
      .reply(200, []);
    renderPage(1);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Applications" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("RecruitmentApplicationsPage-count"),
    ).toHaveTextContent("0 Applications Received");
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-recruitment-cell-row-0-col-quarter",
      ),
    ).toBeNull();
    // With no recruitment known, the TA columns are the default.
    expect(screen.getByText("Level")).toBeInTheDocument();
  });
});
