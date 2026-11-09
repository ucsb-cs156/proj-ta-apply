import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import draftConflictsFixtures from "fixtures/draftConflictsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";
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
    localStorage.clear();
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
    // Issue #390: the change history has its own page now; were it still asked for here, the
    // answer would show up on the page.
    axiosMock
      .onGet("/api/admin/recruitmentaudittrail/all")
      .reply(200, recruitmentAuditTrailFixtures.onePage);
    // Issue #189: the defaults are already on file for both recruitments.
    axiosMock
      .onGet("/api/admin/hiddencolumns", {
        params: { tableKey: "recruitmentApplications", recruitmentId: "1" },
      })
      .reply(200, defaultHiddenColumns("TA"));
    axiosMock
      .onGet("/api/admin/hiddencolumns", {
        params: { tableKey: "recruitmentApplications", recruitmentId: "2" },
      })
      .reply(200, defaultHiddenColumns("ULA"));
    axiosMock.onPut("/api/admin/hiddencolumns/all").reply(200, []);
    axiosMock.onPut("/api/admin/hiddencolumns").reply(200, []);
    // Issue #417: normally no one has both a draft and an application.
    axiosMock
      .onGet("/api/admin/applications/draftConflicts")
      .reply(200, draftConflictsFixtures.none);
  });

  // ---- issue #417: students with both a draft and an application ----

  test("shows no warning when no one has both a draft and an application", async () => {
    renderPage(1);

    await screen.findByRole("heading", {
      level: 1,
      name: "Applications: TA positions, W26",
    });
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/applications/draftConflicts",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.get.find(
        (r) => r.url === "/api/admin/applications/draftConflicts",
      ).params,
    ).toEqual({ recruitmentId: "1" });
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-draft-conflicts"),
    ).toBeNull();
  });

  test("warns about the students with both, above the heading, with links to both", async () => {
    // The same matcher as the one in beforeEach, so this answer replaces that one.
    axiosMock
      .onGet("/api/admin/applications/draftConflicts")
      .reply(200, draftConflictsFixtures.one);

    renderPage(1);

    const warning = await screen.findByTestId(
      "RecruitmentApplicationsPage-draft-conflicts",
    );
    expect(warning).toHaveTextContent("WARNING");
    expect(screen.getByRole("link", { name: "13" })).toHaveAttribute(
      "href",
      "/admin/draft-applications/13",
    );
    expect(screen.getByRole("link", { name: "17" })).toHaveAttribute(
      "href",
      "/admin/applications/17",
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(
      warning.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  const hiddenColumnGets = () =>
    axiosMock.history.get.filter((r) => r.url === "/api/admin/hiddencolumns");
  const seedPuts = () =>
    axiosMock.history.put.filter(
      (r) => r.url === "/api/admin/hiddencolumns/all",
    );
  const togglePuts = () =>
    axiosMock.history.put.filter((r) => r.url === "/api/admin/hiddencolumns");

  // ---- issue #189: column order, hiding and showing ----

  test("asks for the hidden columns, leaves them out, and writes nothing when the defaults are on file", async () => {
    renderPage(1);
    await screen.findByTestId(
      "RecruitmentApplicationsPage-applications-cell-row-0-col-id-link",
    );

    await waitFor(() => expect(hiddenColumnGets()).toHaveLength(1));
    expect(hiddenColumnGets()[0].params).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "1",
    });
    const headers = [
      ...screen
        .getByTestId("RecruitmentApplicationsPage-applications")
        .querySelectorAll("thead th"),
    ].map((th) =>
      th
        .getAttribute("data-testid")
        .replace("RecruitmentApplicationsPage-applications-header-", ""),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(
          "RecruitmentApplicationsPage-applications-header-gpaMajor",
        ),
      ).toBeNull(),
    );
    expect(headers).toEqual([
      "id",
      "view",
      "edit",
      "name",
      "submittedAt",
      "email",
      "major",
      "classLevel",
    ]);
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-applications"),
    ).toHaveClass("w-auto");
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-toggle"),
    ).toHaveTextContent(
      `Columns (${defaultHiddenColumns("TA").length - 1} hidden)`,
    );
    // The marker is on file, so the defaults are not written again.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/applications/all",
        ),
      ).toHaveLength(1),
    );
    expect(seedPuts()).toHaveLength(0);
  });

  test("the first time a recruitment's table is opened, the default-hidden columns are written once", async () => {
    axiosMock
      .onGet("/api/admin/hiddencolumns", {
        params: { tableKey: "recruitmentApplications", recruitmentId: "2" },
      })
      .reply(200, []);
    renderPage(2);

    await waitFor(() => expect(seedPuts()).toHaveLength(1));
    expect(seedPuts()[0].params).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "2",
      columnIds: defaultHiddenColumns("ULA").join(","),
    });
    expect(seedPuts()[0].params.columnIds).toContain("_defaultsApplied");
    expect(seedPuts()[0].params.columnIds).not.toContain("graduationDate");
    expect(seedPuts()[0].params.columnIds).toContain("permNumber");
    // Nothing hidden yet in this answer, so every ULA column shows meanwhile.
    expect(
      screen.getByTestId(
        "RecruitmentApplicationsPage-applications-header-permNumber",
      ),
    ).toBeInTheDocument();
    // The seeding re-reads the list, and does not run a second time.
    await waitFor(() => expect(hiddenColumnGets().length).toBeGreaterThan(1));
    expect(seedPuts()).toHaveLength(1);
  });

  test("the defaults wait for the recruitment, since TA and ULA tables differ", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    axiosMock
      .onGet("/api/admin/hiddencolumns", {
        params: { tableKey: "recruitmentApplications", recruitmentId: "1" },
      })
      .reply(200, []);
    renderPage(1);

    await waitFor(() => expect(hiddenColumnGets()).toHaveLength(1));
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ),
      ).toHaveLength(1),
    );
    expect(seedPuts()).toHaveLength(0);
  });

  test("an admin who showed every column but kept the marker is not given the defaults again", async () => {
    axiosMock
      .onGet("/api/admin/hiddencolumns", {
        params: { tableKey: "recruitmentApplications", recruitmentId: "1" },
      })
      .reply(200, ["_defaultsApplied"]);
    renderPage(1);

    await screen.findByTestId(
      "RecruitmentApplicationsPage-applications-header-gpaMajor",
    );
    await waitFor(() => expect(hiddenColumnGets()).toHaveLength(1));
    expect(seedPuts()).toHaveLength(0);
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-toggle"),
    ).toHaveTextContent("Columns");
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-toggle"),
    ).not.toHaveTextContent("hidden");
  });

  test("unticking a column in the Columns menu hides it on the backend and re-reads the list", async () => {
    renderPage(1);
    await screen.findByTestId(
      "RecruitmentApplicationsPage-applications-cell-row-0-col-id-link",
    );
    await waitFor(() => expect(hiddenColumnGets()).toHaveLength(1));

    await userEvent.click(
      screen.getByTestId("RecruitmentApplicationsPage-columns-toggle"),
    );
    // Issue #343: the course actions belong to the Assignments page alone.
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-columns-show-all-courses",
      ),
    ).toBeNull();
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-columns-show-incomplete-courses",
      ),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-select-all"),
    ).toHaveTextContent("Show All");
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-columns-id"),
    ).toBeNull();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-columns-name"),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-residencyStatus"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-columns-permNumber"),
    ).toBeNull();
    await userEvent.click(
      screen.getByTestId("RecruitmentApplicationsPage-columns-major"),
    );

    await waitFor(() => expect(togglePuts()).toHaveLength(1));
    expect(togglePuts()[0].params).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "1",
      columnId: "major",
      hidden: true,
    });
    await waitFor(() => expect(hiddenColumnGets().length).toBeGreaterThan(1));
  });

  test("a ULA recruitment offers the ULA columns in the menu", async () => {
    renderPage(2);
    await screen.findByText("Expected Graduation");

    await userEvent.click(
      screen.getByTestId("RecruitmentApplicationsPage-columns-toggle"),
    );
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-permNumber"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-columns-classLevel"),
    ).toBeNull();
  });

  /** Issue #234: the two controls that used to be on the recruitment card are at the top. */
  test("has Download Applications as CSV and Test Application at the top, for this recruitment", async () => {
    renderPage(2);

    await screen.findByRole("heading", { level: 1 });
    const header = screen.getByTestId("RecruitmentApplicationsPage-header");
    const download = screen.getByTestId(
      "RecruitmentApplicationsPage-header-download-csv",
    );
    expect(download).toHaveTextContent("Download Applications as CSV");
    expect(download).toHaveAttribute(
      "href",
      "/api/admin/applications/csv?recruitmentId=2",
    );
    expect(download).toHaveAttribute("download", "applications-2.csv");
    const testApplication = screen.getByTestId(
      "RecruitmentApplicationsPage-header-test-application",
    );
    expect(testApplication).toHaveTextContent("Test Application");
    expect(testApplication).toHaveAttribute(
      "href",
      "/admin/recruitments/2/test-application",
    );
    // At the top: in the same row as the heading, before the recruitment's row and the table.
    expect(header).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(
      header.compareDocumentPosition(
        screen.getByTestId("RecruitmentApplicationsPage-count"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    // With no recruitment known, the TA columns are the default, in the menu too.
    expect(screen.getByText("Level")).toBeInTheDocument();
    await userEvent.click(
      screen.getByTestId("RecruitmentApplicationsPage-columns-toggle"),
    );
    expect(
      screen.getByTestId("RecruitmentApplicationsPage-columns-classLevel"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-columns-permNumber"),
    ).toBeNull();
  });

  // ---- issue #390: the recruitment's own change history has its own page now ----

  test("the Change History card is gone, and the change history is not asked for", async () => {
    renderPage(1);

    await screen.findByTestId(
      "RecruitmentApplicationsPage-applications-cell-row-0-col-id-link",
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentApplicationsPage-count"),
      ).toHaveTextContent("1 Application Received (plus 1 test application)"),
    );
    expect(screen.queryByText("Change History")).toBeNull();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Change History" }),
    ).toBeNull();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-changeHistory-toggle"),
    ).toBeNull();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-audit-intro"),
    ).toBeNull();
    expect(
      screen.queryByTestId("RecruitmentApplicationsPage-audit-total"),
    ).toBeNull();
    expect(screen.queryByText(/changes recorded/)).toBeNull();
    expect(screen.queryByLabelText("Page size")).toBeNull();
    expect(
      axiosMock.history.get.filter(
        (request) => request.url === "/api/admin/recruitmentaudittrail/all",
      ),
    ).toHaveLength(0);
    // The applications table is the last thing on the page.
    const table = screen.getByTestId(
      "RecruitmentApplicationsPage-applications",
    );
    expect(
      table.closest(".pt-2").lastElementChild.contains(table),
    ).toBeTruthy();
  });

  test("the hide link over a column hides it like the menu, and the id and name columns have none (issue #314)", async () => {
    renderPage(1);
    await screen.findByTestId(
      "RecruitmentApplicationsPage-applications-cell-row-0-col-id-link",
    );
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-applications-header-id-hide",
      ),
    ).toBeNull();
    expect(
      screen.queryByTestId(
        "RecruitmentApplicationsPage-applications-header-name-hide",
      ),
    ).toBeNull();

    await userEvent.click(
      screen.getByTestId(
        "RecruitmentApplicationsPage-applications-header-major-hide",
      ),
    );

    await waitFor(() => expect(togglePuts()).toHaveLength(1));
    expect(togglePuts()[0].params).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "1",
      columnId: "major",
      hidden: true,
    });
  });
});
