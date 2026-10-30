import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { AUDIT_PAGE_SIZES } from "main/utils/recruitmentAuditTrail";
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
    axiosMock
      .onGet("/api/admin/recruitmentaudittrail/all")
      .reply(200, recruitmentAuditTrailFixtures.onePage);
  });

  // The audit trail requests made so far, as their params.
  const auditRequests = () =>
    axiosMock.history.get
      .filter(
        (request) => request.url === "/api/admin/recruitmentaudittrail/all",
      )
      .map((request) => request.params);

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

  // ---- issue #139: the recruitment's own audit trail, at the bottom, paged ----

  test("lists the recruitment's change history at the bottom, newest first, asked for by id", async () => {
    renderPage(1);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Change History" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-intro"),
    ).toHaveTextContent(
      "Every change to this recruitment itself, newest first: when it was created, each time it was opened or closed, and each date that changed. Changes to individual applications are on the Audit Trail page.",
    );
    expect(
      await screen.findByTestId("RecruitmentApplicationsPage-audit-total"),
    ).toHaveTextContent("3 changes recorded.");
    const cell = (row, col) =>
      screen.getByTestId(
        `RecruitmentApplicationsPage-audit-cell-row-${row}-col-${col}`,
      );
    expect(cell(0, "whatChanged")).toHaveTextContent("actualOpeningDate");
    expect(cell(1, "whatChanged")).toHaveTextContent("applicationStatus");
    expect(cell(2, "whatChanged")).toHaveTextContent("created");
    // The trail comes after the applications table.
    const applications = screen.getByTestId(
      "RecruitmentApplicationsPage-count",
    );
    expect(applications.compareDocumentPosition(cell(0, "whatChanged"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await waitFor(() => expect(auditRequests()).toHaveLength(1));
    expect(auditRequests()[0]).toEqual({
      recruitmentId: "1",
      page: 0,
      size: 10,
      sort: "id",
      direction: "desc",
    });
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-previous"),
    ).toBeDisabled();
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-next"),
    ).toBeDisabled();
  });

  test("Next and Previous move through the pages, and a new page size starts over", async () => {
    // One handler, choosing by page and size: the first registered handler for a url wins, so
    // separate handlers per params would never be reached past the one in beforeEach.
    axiosMock.onGet("/api/admin/recruitmentaudittrail/all").reply((config) => {
      const { page, size } = config.params;
      if (size === 25) {
        return [200, recruitmentAuditTrailFixtures.onePage];
      }
      return [
        200,
        page === 0
          ? recruitmentAuditTrailFixtures.firstOfTwoPages
          : recruitmentAuditTrailFixtures.secondOfTwoPages,
      ];
    });
    renderPage(1);

    const indicator = await screen.findByTestId(
      "RecruitmentApplicationsPage-audit-page-indicator",
    );
    await waitFor(() => expect(indicator).toHaveTextContent("Page 1 of 2"));
    const previous = screen.getByTestId(
      "RecruitmentApplicationsPage-audit-previous",
    );
    const next = screen.getByTestId("RecruitmentApplicationsPage-audit-next");
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-audit-cell-row-0-col-whatChanged",
      ),
    ).toHaveTextContent("actualOpeningDate");

    await userEvent.click(next);
    await waitFor(() => expect(indicator).toHaveTextContent("Page 2 of 2"));
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-audit-cell-row-0-col-whatChanged",
      ),
    ).toHaveTextContent("created");
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
    expect(auditRequests()[1]).toEqual({
      recruitmentId: "1",
      page: 1,
      size: 10,
      sort: "id",
      direction: "desc",
    });

    await userEvent.click(previous);
    await waitFor(() => expect(indicator).toHaveTextContent("Page 1 of 2"));
    expect(previous).toBeDisabled();

    // A bigger page starts again from the first page.
    await userEvent.click(next);
    await waitFor(() => expect(indicator).toHaveTextContent("Page 2 of 2"));
    const pageSize = screen.getByTestId(
      "RecruitmentApplicationsPage-audit-page-size",
    );
    expect([...pageSize.options].map((o) => Number(o.value))).toEqual(
      AUDIT_PAGE_SIZES,
    );
    expect(AUDIT_PAGE_SIZES).toEqual([10, 25, 50, 100]);
    await userEvent.selectOptions(pageSize, "25");
    await waitFor(() => expect(indicator).toHaveTextContent("Page 1 of 1"));
    expect(auditRequests().at(-1)).toEqual({
      recruitmentId: "1",
      page: 0,
      size: 25,
      sort: "id",
      direction: "desc",
    });
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-total"),
    ).toHaveTextContent("3 changes recorded.");
  });

  test("with no changes recorded the trail says so and shows page 1 of 1", async () => {
    axiosMock
      .onGet("/api/admin/recruitmentaudittrail/all")
      .reply(200, recruitmentAuditTrailFixtures.emptyPage);
    renderPage(1);

    expect(
      await screen.findByTestId("RecruitmentApplicationsPage-audit-total"),
    ).toHaveTextContent("0 changes recorded.");
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-next"),
    ).toBeDisabled();
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-audit-cell-row-0-col-id",
      ),
    ).toBeNull();
  });

  test("before the trail arrives, the section is there with nothing in it", async () => {
    axiosMock.onGet("/api/admin/recruitmentaudittrail/all").timeout();
    renderPage(1);

    expect(
      await screen.findByRole("heading", { level: 2, name: "Change History" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-total"),
    ).toHaveTextContent("0 changes recorded.");
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-audit-page-indicator"),
    ).toHaveTextContent("Page 1 of 1");
  });
});
