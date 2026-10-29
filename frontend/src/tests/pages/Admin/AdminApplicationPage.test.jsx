import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AdminApplicationPage from "main/pages/Admin/AdminApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { submittedText } from "main/utils/adminApplications";
import auditTrailFixtures from "fixtures/auditTrailFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

const ula = applicationsFixtures.oneUlaApplication;
const ta = applicationsFixtures.oneTaApplication;

function renderPage(id = ula.id) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/admin/applications/${id}`]}>
        <Routes>
          <Route
            path="/admin/applications/:id"
            element={<AdminApplicationPage />}
          />
          <Route
            path="/admin/recruitments/:recruitmentId/applications"
            element={<p data-testid="list-page">the list</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminApplicationPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
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
      .onGet("/api/admin/applications", { params: { id: String(ula.id) } })
      .reply(200, ula);
    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ta.id) } })
      .reply(200, { ...ta, postApplicationComments: "Still keen" });
    axiosMock.onGet("/api/notices").reply(200, noticesFixtures.ulaV1);
    axiosMock
      .onPut("/api/admin/applications/adminComments")
      .reply(200, { ...ula, adminComments: "Interview Tuesday" });
    axiosMock.onGet("/api/admin/audittrail/application").reply(200, []);
  });

  test("has an Edit button leading to the admin's edit form", async () => {
    renderPage();

    const button = await screen.findByTestId("AdminApplicationPage-edit");
    expect(button).toHaveTextContent("Edit");
    expect(button).toHaveAttribute(
      "href",
      `/admin/applications/${ula.id}/edit`,
    );
  });

  /** The rows for this application only, asked for by the recruitment's type and the id. */
  test("ends with this application's audit trail, or a note that there is none", async () => {
    renderPage();

    expect(
      await screen.findByTestId("AdminApplicationPage-audit-none"),
    ).toHaveTextContent("No admin has changed this application.");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/audittrail/application",
        )[0].params,
      ).toEqual({ type: "ULA", id: String(ula.id) }),
    );
  });

  test("lists the audit trail rows when there are some", async () => {
    axiosMock
      .onGet("/api/admin/audittrail/application")
      .reply(200, auditTrailFixtures.threeRows.slice(1));
    renderPage();

    expect(
      await screen.findByTestId(
        "AdminApplicationPage-audit-cell-row-0-col-fieldName",
      ),
    ).toHaveTextContent("priorCoursework");
    expect(
      screen.getByTestId("AdminApplicationPage-audit-cell-row-1-col-fieldName"),
    ).toHaveTextContent("comments");
    expect(screen.queryByTestId("AdminApplicationPage-audit-none")).toBeNull();
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
  });

  test("shows who applied, when, and the application read only, with the agreed notice", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: `Application ${ula.id}: ULA positions, W26`,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("AdminApplicationPage-about"),
    ).toHaveTextContent(
      `Application from ${ula.email}, submitted ${submittedText(ula.submittedAt)}. Status: ${ula.status}.`,
    );
    // The summary, in ULA form, with the stored interests.
    expect(
      screen.getByTestId("AdminApplicationPage-summary-Name"),
    ).toHaveTextContent(ula.firstName);
    expect(
      screen.getByTestId(
        "AdminApplicationPage-summary-Interests (1 not interested to 5 very interested)",
      ),
    ).toHaveTextContent("Tutoring: 5 / 5");
    // The version the applicant agreed to is fetched by id and shown ticked.
    const box = await screen.findByTestId(
      "AdminApplicationPage-summary-notice-agree",
    );
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices")[0].params,
    ).toEqual({ id: ula.noticeVersionId });
    // Nothing editable but the admin comments: no form fields from the application.
    expect(screen.queryByTestId("AdminApplicationPage-firstName")).toBeNull();
    // The applicant's post-application comments are shown too, when there are any.
    expect(
      screen.getByTestId("AdminApplicationPage-post-comments"),
    ).toHaveTextContent(
      `Post application comments: ${ula.postApplicationComments}`,
    );
  });

  test("a TA application uses the TA summary and shows its post-application comments", async () => {
    renderPage(ta.id);

    expect(
      await screen.findByTestId("AdminApplicationPage-post-comments"),
    ).toHaveTextContent("Post application comments: Still keen");
    expect(
      screen.getByTestId("AdminApplicationPage-summary-Class Level"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(
        "AdminApplicationPage-summary-Interests (1 not interested to 5 very interested)",
      ),
    ).toBeNull();
  });

  /** Also the case of a recruitment the page cannot find: the heading has no suffix, TA form. */
  test("a test application says so", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    axiosMock
      .onGet("/api/admin/applications", { params: { id: "9" } })
      .reply(200, {
        ...applicationsFixtures.oneTestApplication,
        id: 9,
        noticeVersionId: null,
      });
    renderPage(9);

    expect(
      await screen.findByTestId("AdminApplicationPage-about"),
    ).toHaveTextContent("Test application from admin@ucsb.edu");
    expect(
      screen.getByRole("heading", { level: 1, name: "Application 9" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("AdminApplicationPage-summary-Class Level"),
    ).toBeInTheDocument();
    // No agreed version, so no notice is fetched; and no post-application comments to show.
    await screen.findByTestId("AdminApplicationPage-summary-Name");
    expect(
      screen.queryByTestId("AdminApplicationPage-post-comments"),
    ).toBeNull();
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices"),
    ).toHaveLength(0);
  });

  test("the admin comments start as the stored text and Save sends them, then returns to the list", async () => {
    renderPage();

    const box = await screen.findByTestId("AdminApplicationPage-adminComments");
    expect(box).toHaveValue(ula.adminComments);
    expect(screen.getByLabelText("Admin Comments")).toBe(box);

    await userEvent.clear(box);
    await userEvent.type(box, "Interview Tuesday");
    await userEvent.click(screen.getByTestId("AdminApplicationPage-save"));

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/admin/applications/adminComments",
    );
    expect(axiosMock.history.put[0].params).toEqual({
      id: String(ula.id),
      adminComments: "Interview Tuesday",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Admin comments saved."),
    );
    expect(await screen.findByTestId("list-page")).toBeInTheDocument();
  });

  test("Cancel returns to the recruitment's list without saving", async () => {
    renderPage();

    const box = await screen.findByTestId("AdminApplicationPage-adminComments");
    await userEvent.type(box, " more");
    await userEvent.click(screen.getByTestId("AdminApplicationPage-cancel"));

    expect(await screen.findByTestId("list-page")).toBeInTheDocument();
    expect(axiosMock.history.put).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("an application with no comments yet starts with an empty box, and Save can send empty text", async () => {
    axiosMock
      .onGet("/api/admin/applications", { params: { id: String(ula.id) } })
      .reply(200, { ...ula, adminComments: null });
    renderPage();

    const box = await screen.findByTestId("AdminApplicationPage-adminComments");
    expect(box).toHaveValue("");
    await userEvent.click(screen.getByTestId("AdminApplicationPage-save"));

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].params).toEqual({
      id: String(ula.id),
      adminComments: "",
    });
  });

  test("before the application arrives only the heading is shown, even once the recruitments are in", async () => {
    axiosMock.onGet("/api/admin/applications").reply(200, null);
    renderPage(77);

    expect(
      screen.getByRole("heading", { level: 1, name: "Application 77" }),
    ).toBeInTheDocument();
    // The recruitments arrive while the application is still null; nothing may blow up.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/recruitments/all",
        ),
      ).toHaveLength(1),
    );
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/applications",
        ),
      ).toHaveLength(1),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      screen.getByRole("heading", { level: 1, name: "Application 77" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("AdminApplicationPage-about")).toBeNull();
    expect(
      screen.queryByTestId("AdminApplicationPage-adminComments"),
    ).toBeNull();
  });
});
