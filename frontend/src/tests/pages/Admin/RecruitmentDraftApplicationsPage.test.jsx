import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentDraftApplicationsPage from "main/pages/Admin/RecruitmentDraftApplicationsPage";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import draftConflictsFixtures from "fixtures/draftConflictsFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const mockClipboardWriteText = vi.fn();

const axiosMock = new AxiosMockAdapter(axios);

const taDraft = draftApplicationsFixtures.adminSavedTaDraft;
const ulaDraft = draftApplicationsFixtures.adminSavedUlaDraft;
const umaDraft = {
  ...taDraft,
  id: 23,
  firstName: "Uma",
  email: "uma@ucsb.edu",
};

function renderPage(recruitmentId = 1) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[
          `/admin/recruitments/${recruitmentId}/draft-applications`,
        ]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/draft-applications"
            element={<RecruitmentDraftApplicationsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const prefix = "RecruitmentDraftApplicationsPage";

describe("RecruitmentDraftApplicationsPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockClipboardWriteText.mockReset();
    mockClipboardWriteText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
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
    // Recruitment 1 is a TA round with two drafts, 2 a ULA round with one, 3 has none.
    axiosMock
      .onGet("/api/admin/draftApplications/all", {
        params: { recruitmentId: "1" },
      })
      .reply(200, [taDraft, umaDraft]);
    axiosMock
      .onGet("/api/admin/draftApplications/all", {
        params: { recruitmentId: "2" },
      })
      .reply(200, [ulaDraft]);
    axiosMock
      .onGet("/api/admin/draftApplications/all", {
        params: { recruitmentId: "3" },
      })
      .reply(200, []);
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
    axiosMock
      .onGet("/api/admin/hiddencolumns", {
        params: { tableKey: "recruitmentApplications", recruitmentId: "3" },
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
      name: "Draft Applications: TA positions, W26",
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
      screen.queryByTestId("RecruitmentDraftApplicationsPage-draft-conflicts"),
    ).toBeNull();
  });

  test("warns about the students with both, above the heading, with links to both", async () => {
    // The same matcher as the one in beforeEach, so this answer replaces that one.
    axiosMock
      .onGet("/api/admin/applications/draftConflicts")
      .reply(200, draftConflictsFixtures.one);

    renderPage(1);

    const warning = await screen.findByTestId(
      "RecruitmentDraftApplicationsPage-draft-conflicts",
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

  test("names the recruitment in the heading and repeats its row, read only", async () => {
    renderPage(1);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Draft Applications: TA positions, W26",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId(`${prefix}-recruitment-cell-row-0-col-quarter`),
    ).toHaveTextContent("W26");
    expect(
      screen.queryByTestId(`${prefix}-recruitment-cell-row-1-col-quarter`),
    ).toBeNull();
  });

  test("leads with how many drafts there are, and says what a draft is", async () => {
    renderPage(1);

    await waitFor(() =>
      expect(screen.getByTestId(`${prefix}-count`)).toHaveTextContent(
        "2 Draft Applications",
      ),
    );
    expect(screen.getByTestId(`${prefix}-about`)).toHaveTextContent(
      "not yet submitted",
    );
    expect(screen.getByTestId(`${prefix}-about`)).toHaveTextContent(
      "copied to the application when it is submitted",
    );
    // The count comes before the table.
    expect(
      screen
        .getByTestId(`${prefix}-count`)
        .compareDocumentPosition(screen.getByTestId(`${prefix}-drafts`)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("one draft is counted in the singular", async () => {
    renderPage(2);

    await waitFor(() =>
      expect(screen.getByTestId(`${prefix}-count`)).toHaveTextContent(
        /^1 Draft Application$/,
      ),
    );
  });

  test("asks for that recruitment's drafts only", async () => {
    renderPage(2);
    await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-id-link`);

    const requests = axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/draftApplications/all",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].params).toEqual({ recruitmentId: "2" });
  });

  test("lists the drafts in the Applications table's columns, with no Edit column", async () => {
    renderPage(1);

    expect(
      await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-id-link`),
    ).toHaveAttribute("href", `/admin/draft-applications/${taDraft.id}`);
    const headers = [
      ...screen.getByTestId(`${prefix}-drafts`).querySelectorAll("thead th"),
    ].map((th) =>
      th.getAttribute("data-testid").replace(`${prefix}-drafts-header-`, ""),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId(`${prefix}-drafts-header-gpaMajor`),
      ).toBeNull(),
    );
    expect(headers.slice(0, 4)).toEqual(["id", "view", "name", "submittedAt"]);
    expect(headers).not.toContain("edit");
    expect(
      screen.getByTestId(`${prefix}-drafts-cell-row-0-col-name`),
    ).toHaveTextContent("Tess A Ative");
    expect(
      screen.getByTestId(`${prefix}-drafts-cell-row-1-col-name`),
    ).toHaveTextContent("Uma A Ative");
    expect(
      screen.getByTestId(`${prefix}-drafts-header-submittedAt`),
    ).toHaveTextContent("Last saved");
  });

  test("a ULA recruitment gets the ULA columns", async () => {
    renderPage(2);
    await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-id-link`);

    expect(
      screen.getByTestId(`${prefix}-drafts-cell-row-0-col-name`),
    ).toHaveTextContent("Dana Draft");
    expect(
      screen.queryByTestId(`${prefix}-drafts-header-classLevel`),
    ).toBeNull();
    expect(
      screen.getByTestId(`${prefix}-drafts-header-graduationDate`),
    ).toBeInTheDocument();
  });

  test("shares which columns are hidden with the Applications table", async () => {
    renderPage(1);
    await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-id-link`);

    const gets = axiosMock.history.get.filter(
      (r) => r.url === "/api/admin/hiddencolumns",
    );
    await waitFor(() => expect(gets.length).toBeGreaterThan(0));
    expect(gets[0].params).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "1",
    });
  });

  test("the Columns menu offers the same columns, Last saved for Submitted, and hiding one is saved for both tables", async () => {
    renderPage(1);
    await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-id-link`);

    await userEvent.click(screen.getByTestId(`${prefix}-columns-toggle`));
    // Issue #343: the course actions belong to the Assignments page alone.
    expect(
      screen.queryByTestId(`${prefix}-columns-show-all-courses`),
    ).toBeNull();
    expect(
      screen.queryByTestId(`${prefix}-columns-show-incomplete-courses`),
    ).toBeNull();
    expect(
      screen.getByTestId(`${prefix}-columns-select-none`),
    ).toHaveTextContent("Show None");
    expect(screen.getByLabelText("Last saved")).toBe(
      screen.getByTestId(`${prefix}-columns-submittedAt`),
    );
    expect(screen.queryByLabelText("Submitted")).toBeNull();
    expect(
      screen.getByTestId(`${prefix}-columns-residencyStatus`),
    ).toBeInTheDocument();
    expect(screen.queryByTestId(`${prefix}-columns-permNumber`)).toBeNull();
    await userEvent.click(screen.getByTestId(`${prefix}-columns-major`));

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/admin/hiddencolumns",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find((r) => r.url === "/api/admin/hiddencolumns")
        .params,
    ).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "1",
      columnId: "major",
      hidden: true,
    });
  });

  test("with no drafts it says so, and shows no table", async () => {
    renderPage(3);

    expect(await screen.findByTestId(`${prefix}-none`)).toHaveTextContent(
      "No one has a draft application for this recruitment right now.",
    );
    expect(screen.getByTestId(`${prefix}-count`)).toHaveTextContent(
      "0 Draft Applications",
    );
    expect(screen.queryByTestId(`${prefix}-drafts`)).toBeNull();
    expect(screen.queryByTestId(`${prefix}-columns-toggle`)).toBeNull();
    // Issue #411: nobody to email, so no button to copy their addresses.
    expect(screen.queryByTestId(`${prefix}-copy-emails`)).toBeNull();
  });

  // Issue #411: the button that copies the draft applicants' emails.
  describe("Copy emails of draft applicants", () => {
    const BUTTON = `${prefix}-copy-emails`;

    test("sits between the explanation and the Columns chooser, small and outlined", async () => {
      renderPage(1);
      const button = await screen.findByTestId(BUTTON);

      expect(button).toHaveTextContent(
        /^Copy emails of draft applicants to clipboard$/,
      );
      expect(button).toHaveClass("btn-outline-primary", "btn-sm");
      expect(button).toBeEnabled();
      const about = screen.getByTestId(`${prefix}-about`);
      const columns = screen.getByTestId(`${prefix}-columns-toggle`);
      expect(
        about.compareDocumentPosition(button) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        button.compareDocumentPosition(columns) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // Its own row, above the chooser's.
      expect(button.parentElement).toHaveClass("mb-2");
      expect(button.parentElement.nextElementSibling).toContainElement(columns);
    });

    test("its tooltip explains the reminder and names the primary consideration date", async () => {
      renderPage(1);
      const button = await screen.findByTestId(BUTTON);
      await screen.findByTestId(`${prefix}-recruitment-cell-row-0-col-quarter`);

      fireEvent.mouseOver(button);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip).toHaveAttribute(
        "id",
        "RecruitmentDraftApplicationsPage-copy-emails-tooltip",
      );
      expect(tooltip.textContent).toBe(
        "A day or two before closing the applications, you may want to email all of the students that have submitted draft applications to let them know that they will need to login and finalize their application before 2026-01-20 if they want their application to be reviewed. Let them know that draft applications are not considered; only applications that have been submitted.",
      );
    });

    test("before the recruitment is known the tooltip names the date generically", async () => {
      axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
      renderPage(1);
      const button = await screen.findByTestId(BUTTON);

      fireEvent.mouseOver(button);
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip.textContent).toContain(
        "finalize their application before the primary consideration date if they want",
      );
    });

    test("clicking copies the emails one per line, in the table's order, and says how many", async () => {
      renderPage(1);
      await screen.findByTestId(`${prefix}-drafts-cell-row-1-col-name`);

      await userEvent.click(screen.getByTestId(BUTTON));

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Emails of 2 draft applicants copied to clipboard.",
        ),
      );
      expect(mockClipboardWriteText).toHaveBeenCalledTimes(1);
      expect(mockClipboardWriteText).toHaveBeenCalledWith(
        "ta@ucsb.edu\numa@ucsb.edu",
      );
      expect(mockToast).toHaveBeenCalledTimes(1);
    });

    test("one draft is copied in the singular", async () => {
      renderPage(2);
      await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-name`);

      await userEvent.click(screen.getByTestId(BUTTON));

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Email of 1 draft applicant copied to clipboard.",
        ),
      );
      expect(mockClipboardWriteText).toHaveBeenCalledWith("ula@ucsb.edu");
    });

    test("reports clipboard failures explicitly", async () => {
      mockClipboardWriteText.mockRejectedValueOnce(
        new Error("permission denied"),
      );
      renderPage(1);
      await screen.findByTestId(`${prefix}-drafts-cell-row-1-col-name`);

      await userEvent.click(screen.getByTestId(BUTTON));

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Unable to copy to clipboard. Check your browser clipboard permissions.",
        ),
      );
      expect(mockToast).toHaveBeenCalledTimes(1);
    });
  });

  test("links back to the recruitment's applications", async () => {
    renderPage(2);

    expect(
      await screen.findByTestId(`${prefix}-applications-link`),
    ).toHaveAttribute("href", "/admin/recruitments/2/applications");
  });

  test("before the recruitment arrives the heading is plain and the row is empty", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage(1);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Draft Applications",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`${prefix}-recruitment-cell-row-0-col-quarter`),
    ).toBeNull();
    // With the type not yet known the table has the TA columns, and so does the menu.
    expect(
      await screen.findByTestId(`${prefix}-drafts-header-classLevel`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`${prefix}-drafts-header-permNumber`),
    ).toBeNull();
    await userEvent.click(screen.getByTestId(`${prefix}-columns-toggle`));
    expect(
      screen.getByTestId(`${prefix}-columns-residencyStatus`),
    ).toBeInTheDocument();
    expect(screen.queryByTestId(`${prefix}-columns-permNumber`)).toBeNull();
  });

  test("the hide link over a column hides it for both tables (issue #314)", async () => {
    renderPage(1);
    await screen.findByTestId(`${prefix}-drafts-cell-row-0-col-id-link`);

    await userEvent.click(
      screen.getByTestId(`${prefix}-drafts-header-major-hide`),
    );

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/admin/hiddencolumns",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find((r) => r.url === "/api/admin/hiddencolumns")
        .params,
    ).toEqual({
      tableKey: "recruitmentApplications",
      recruitmentId: "1",
      columnId: "major",
      hidden: true,
    });
  });
});
