import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentsIndexPage from "main/pages/Admin/RecruitmentsIndexPage";
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

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RecruitmentsIndexPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RecruitmentsIndexPage tests", () => {
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
    axiosMock.onPost("/api/admin/recruitments/post").reply(200, { id: 4 });
    axiosMock
      .onDelete("/api/admin/recruitments/delete")
      .reply(200, { message: "deleted" });
  });

  test("renders the heading and the recruitments", async () => {
    renderPage();

    expect(await screen.findByText("Recruitments")).toBeInTheDocument();
    expect(
      await screen.findByTestId("RecruitmentsIndexPage-cell-row-0-col-quarter"),
    ).toHaveTextContent("S26");
  });

  test("creating a recruitment posts the form and toasts", async () => {
    renderPage();
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
  });

  test("the form will not submit without the required dates", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentForm-submit");

    await userEvent.click(screen.getByTestId("RecruitmentForm-submit"));

    expect(
      await screen.findByText(/A tentative opening date is required./),
    ).toBeInTheDocument();
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("Delete asks for confirmation and deletes nothing yet", async () => {
    renderPage();
    await screen.findByTestId(
      "RecruitmentsIndexPage-cell-row-0-col-delete-button",
    );

    await userEvent.click(
      screen.getByTestId("RecruitmentsIndexPage-cell-row-0-col-delete-button"),
    );

    expect(
      await screen.findByTestId("RecruitmentDeleteModal"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("RecruitmentDeleteModal-body")).toHaveTextContent(
      "TA recruitment for S26",
    );
    expect(axiosMock.history.delete.length).toBe(0);
  });

  test("confirming the modal deletes that recruitment", async () => {
    renderPage();
    await screen.findByTestId(
      "RecruitmentsIndexPage-cell-row-1-col-delete-button",
    );

    await userEvent.click(
      screen.getByTestId("RecruitmentsIndexPage-cell-row-1-col-delete-button"),
    );
    await userEvent.click(
      await screen.findByTestId("RecruitmentDeleteModal-confirm"),
    );

    await waitFor(() => expect(axiosMock.history.delete.length).toBe(1));
    expect(axiosMock.history.delete[0].params).toEqual({ id: 2 });
  });

  test("cancelling the modal deletes nothing", async () => {
    renderPage();
    await screen.findByTestId(
      "RecruitmentsIndexPage-cell-row-0-col-delete-button",
    );

    await userEvent.click(
      screen.getByTestId("RecruitmentsIndexPage-cell-row-0-col-delete-button"),
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

    renderPage();

    expect(
      await screen.findByTestId("RecruitmentForm.Quarter"),
    ).toBeInTheDocument();
  });
});
