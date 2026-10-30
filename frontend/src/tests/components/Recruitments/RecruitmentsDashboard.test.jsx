import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentsDashboard from "main/components/Recruitments/RecruitmentsDashboard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const axiosMock = new AxiosMockAdapter(axios);

function renderDashboard() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RecruitmentsDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RecruitmentsDashboard tests", () => {
  beforeEach(() => {
    localStorage.clear();
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
      .onGet("/api/admin/recruitments/applicationCounts")
      .reply(200, { 1: 15, 2: 1, 3: 0 });
    axiosMock.onPost("/api/admin/recruitments/post").reply(200, { id: 4 });
    axiosMock
      .onDelete("/api/admin/recruitments/delete")
      .reply(200, { message: "deleted" });
  });

  test("renders the heading, the explanation and the recruitments with their counts", async () => {
    renderDashboard();

    // Issue #141: an h3, since it sits under the home page's Admin h2.
    const heading = await screen.findByTestId("RecruitmentsDashboard-heading");
    expect(heading).toHaveTextContent("Recruitments");
    expect(heading.tagName).toBe("H3");
    expect(heading).toHaveClass("h4");
    // Issue #108: the new explanation, in three paragraphs.
    const intro = screen.getByTestId("RecruitmentsDashboard-intro");
    expect(
      Array.from(intro.querySelectorAll("p")).map((p) => p.textContent),
    ).toEqual([
      "Applications for new recruitments do not automatically open and close on the tentative dates listed; the admin must manually open and close the recruitments by clicking the Open or Close button.",
      "Only one recruitment of each type (TA or ULA) may be created for a given quarter.",
      "Recruitments are automatically populated with the undergraduate courses offered in the specified quarter; the list of courses can then be manually adjusted using the Courses button.",
    ]);
    expect(
      await screen.findByTestId("RecruitmentsDashboard-card-0-quarter"),
    ).toHaveTextContent("S26");
    // Card 1 is W26 TA, id 1, with 15 applications.
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentsDashboard-card-1-applications"),
      ).toHaveTextContent("15 applications"),
    );
    // The form is behind a button, not on the page.
    expect(screen.queryByTestId("RecruitmentForm-submit")).toBeNull();
    expect(
      screen.getByTestId("RecruitmentsDashboard-create-button"),
    ).toHaveTextContent("Create New Recruitment");
  });

  test("the test id prefix names every part", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecruitmentsDashboard testIdPrefix="Home-admin" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByTestId("Home-admin-dashboard"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Home-admin-heading")).toBeInTheDocument();
    expect(screen.getByTestId("Home-admin-intro")).toBeInTheDocument();
    expect(screen.getByTestId("Home-admin-create-button")).toBeInTheDocument();
    expect(
      await screen.findByTestId("Home-admin-card-0-quarter"),
    ).toHaveTextContent("S26");
  });

  test("creating a recruitment posts the form from its modal, toasts and closes it", async () => {
    renderDashboard();
    await userEvent.click(
      await screen.findByTestId("RecruitmentsDashboard-create-button"),
    );
    expect(
      await screen.findByTestId("RecruitmentsDashboard-create-modal"),
    ).toHaveTextContent("Create New Recruitment");
    await screen.findByTestId("RecruitmentForm-submit");

    await userEvent.selectOptions(
      screen.getByTestId("RecruitmentForm-type"),
      "ULA",
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentForm-tentativeOpeningDate"),
      "2026-01-05",
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentForm-primaryConsiderationDate"),
      "2026-01-20",
    );
    await userEvent.click(screen.getByTestId("RecruitmentForm-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].params).toEqual({
      quarter: "20211",
      type: "ULA",
      tentativeOpeningDate: "2026-01-05",
      primaryConsiderationDate: "2026-01-20",
    });
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/Recruitment created/);
    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentsDashboard-create-modal"),
      ).toBeNull(),
    );
  });

  test("the create modal is centred and its close button dismisses it", async () => {
    renderDashboard();
    await userEvent.click(
      await screen.findByTestId("RecruitmentsDashboard-create-button"),
    );
    const modal = await screen.findByTestId(
      "RecruitmentsDashboard-create-modal",
    );
    // The only dialog open at this point is the create modal's.
    expect(document.querySelector(".modal-dialog")).toHaveClass(
      "modal-dialog-centered",
    );

    await userEvent.click(within(modal).getByLabelText("Close"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentsDashboard-create-modal"),
      ).toBeNull(),
    );
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("Cancel closes the create modal without posting", async () => {
    renderDashboard();
    await userEvent.click(
      await screen.findByTestId("RecruitmentsDashboard-create-button"),
    );
    await userEvent.click(await screen.findByTestId("RecruitmentForm-cancel"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("RecruitmentsDashboard-create-modal"),
      ).toBeNull(),
    );
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("the form will not submit without the required dates", async () => {
    renderDashboard();
    await userEvent.click(
      await screen.findByTestId("RecruitmentsDashboard-create-button"),
    );
    await screen.findByTestId("RecruitmentForm-submit");

    await userEvent.click(screen.getByTestId("RecruitmentForm-submit"));

    expect(
      await screen.findByText(/A tentative opening date is required./),
    ).toBeInTheDocument();
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("Delete asks for confirmation and deletes nothing yet", async () => {
    renderDashboard();
    await screen.findByTestId("RecruitmentsDashboard-card-0-delete-button");

    await userEvent.click(
      screen.getByTestId("RecruitmentsDashboard-card-0-delete-button"),
    );

    expect(
      await screen.findByTestId("RecruitmentDeleteModal"),
    ).toHaveTextContent("Delete the TA recruitment for S26?");
    // Card 0 is S26 TA, id 3, with no applications.
    expect(screen.getByTestId("RecruitmentDeleteModal-body")).toHaveTextContent(
      "Are you really sure? This permanently deletes ALL data for this recruitment, including the 0 applications on file. Once they are gone, they cannot be retrieved. Please consider downloading a CSV of the data for this recruitment first if there is anything that should be saved.",
    );
    expect(
      screen.getByTestId("RecruitmentDeleteModal-confirm"),
    ).toHaveTextContent("Yes, I am really sure. Delete this recruitment");
    expect(
      screen.getByTestId("RecruitmentDeleteModal-cancel"),
    ).toHaveTextContent("No, do not delete");
    expect(axiosMock.history.delete.length).toBe(0);
  });

  test("the delete warning names how many applications are on file", async () => {
    renderDashboard();
    // Card 1 is W26 TA, id 1, with 15 applications; card 2 is W26 ULA, id 2, with 1.
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentsDashboard-card-1-applications"),
      ).toHaveTextContent("15 applications"),
    );
    await userEvent.click(
      screen.getByTestId("RecruitmentsDashboard-card-1-delete-button"),
    );
    expect(
      await screen.findByTestId("RecruitmentDeleteModal-body"),
    ).toHaveTextContent("including the 15 applications on file");
    await userEvent.click(screen.getByTestId("RecruitmentDeleteModal-cancel"));
    await waitFor(() =>
      expect(screen.queryByTestId("RecruitmentDeleteModal-body")).toBeNull(),
    );

    await userEvent.click(
      screen.getByTestId("RecruitmentsDashboard-card-2-delete-button"),
    );
    expect(
      await screen.findByTestId("RecruitmentDeleteModal-body"),
    ).toHaveTextContent("including the 1 application on file");
  });

  test("confirming the modal deletes that recruitment", async () => {
    renderDashboard();
    await screen.findByTestId("RecruitmentsDashboard-card-1-delete-button");

    await userEvent.click(
      screen.getByTestId("RecruitmentsDashboard-card-1-delete-button"),
    );
    await userEvent.click(
      await screen.findByTestId("RecruitmentDeleteModal-confirm"),
    );

    await waitFor(() => expect(axiosMock.history.delete.length).toBe(1));
    // The cards are sorted newest quarter first, TA before ULA: card 1 is W26 TA, id 1.
    expect(axiosMock.history.delete[0].params).toEqual({ id: 1 });
  });

  test("cancelling the modal deletes nothing", async () => {
    renderDashboard();
    await screen.findByTestId("RecruitmentsDashboard-card-0-delete-button");

    await userEvent.click(
      screen.getByTestId("RecruitmentsDashboard-card-0-delete-button"),
    );
    await userEvent.click(
      await screen.findByTestId("RecruitmentDeleteModal-cancel"),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("RecruitmentDeleteModal-confirm")).toBeNull(),
    );
    expect(axiosMock.history.delete.length).toBe(0);
  });

  test("falls back to default quarter bounds when systemInfo has none", async () => {
    axiosMock.onGet("/api/systemInfo").reply(200, {
      springH2ConsoleEnabled: false,
      showSwaggerUILink: false,
      oauthLogin: "/oauth2/authorization/google",
      sourceRepo: "",
    });

    renderDashboard();
    await userEvent.click(
      await screen.findByTestId("RecruitmentsDashboard-create-button"),
    );

    expect(
      await screen.findByTestId("RecruitmentForm.Quarter"),
    ).toBeInTheDocument();
  });
});
