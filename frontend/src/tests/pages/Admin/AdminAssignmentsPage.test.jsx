import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AdminAssignmentsPage from "main/pages/Admin/AdminAssignmentsPage";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
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

function renderPage(recruitmentId = 7) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[`/admin/recruitments/${recruitmentId}/assignments`]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/assignments"
            element={<AdminAssignmentsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const assignmentsGets = () =>
  axiosMock.history.get.filter((r) => r.url === "/api/admin/assignments");
const tentativePuts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/admin/assignments/tentative",
  );

describe("AdminAssignmentsPage tests (issue #179)", () => {
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
    // Recruitment 7 is a TA recruitment for S26; recruitment 2 a ULA one for W26.
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [
        { ...recruitmentsFixtures.threeRecruitments[0], id: 7 },
        recruitmentsFixtures.threeRecruitments[1],
      ]);
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.taPage);
    axiosMock
      .onPut("/api/admin/assignments/tentative")
      .reply(200, assignmentsFixtures.taPageAfterMove);
  });

  test("heads the page with the recruitment, explains it, and asks for the recruitment's assignments", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", {
        name: "Assignments: TA positions, S26",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("AdminAssignmentsPage-intro")).toHaveTextContent(
      "Every real applicant with each lecture's ranking of them. Choose a lecture under Tentative Assignment to pencil an applicant in; the counts under each lecture update at once. Tentative assignments are not shown to applicants or faculty at this stage.",
    );
    await waitFor(() => expect(assignmentsGets()).toHaveLength(1));
    expect(assignmentsGets()[0].params).toEqual({ recruitmentId: "7" });
    expect(
      await screen.findByTestId(
        "AdminAssignmentsPage-table-cell-row-0-col-email",
      ),
    ).toHaveTextContent("ada@ucsb.edu");
    expect(screen.getByTestId("AdminAssignmentsPage-count")).toHaveTextContent(
      "4 applicants, 3 lectures, 3 TAs allocated, 3 assigned so far.",
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-20-left"),
    ).toHaveTextContent("Left -1");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-20-left"),
    ).toHaveClass("text-danger");
  });

  test("choosing a lecture saves at once and the heading counts follow the response", async () => {
    // The GET keeps answering with the old page: the new counts can only come from the PUT.
    renderPage();

    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-tentative-select",
    );
    expect(select).toHaveValue("10");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 1");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-30-assigned"),
    ).toHaveTextContent("Assigned 0");

    await userEvent.selectOptions(select, "30");

    await waitFor(() => expect(tentativePuts()).toHaveLength(1));
    expect(tentativePuts()[0].params).toEqual({
      applicationId: 1,
      recruitmentCourseId: 30,
    });
    await waitFor(() =>
      expect(
        screen.getByTestId("AdminAssignmentsPage-table-course-30-assigned"),
      ).toHaveTextContent("Assigned 1"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-30-left"),
    ).toHaveTextContent("Left -1");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-30-left"),
    ).toHaveClass("text-danger");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 0");
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-left"),
    ).toHaveTextContent("Left 2");
    expect(
      screen.getByTestId(
        "AdminAssignmentsPage-table-cell-row-0-tentative-select",
      ),
    ).toHaveValue("30");
    // The response was enough: the list was not re-read, and nothing was toasted.
    expect(assignmentsGets()).toHaveLength(1);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("choosing the blank entry clears the assignment without a course parameter", async () => {
    renderPage();
    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-1-tentative-select",
    );
    expect(select).toHaveValue("20");

    await userEvent.selectOptions(select, "");

    await waitFor(() => expect(tentativePuts()).toHaveLength(1));
    expect(tentativePuts()[0].params).toEqual({ applicationId: 2 });
    expect(tentativePuts()[0].params).not.toHaveProperty("recruitmentCourseId");
  });

  test("a failed save is reported in a toast and the page keeps its data", async () => {
    axiosMock.onPut("/api/admin/assignments/tentative").reply(400, {
      message: "RecruitmentCourse 30 is not part of recruitment 7",
    });
    renderPage();
    const select = await screen.findByTestId(
      "AdminAssignmentsPage-table-cell-row-0-tentative-select",
    );

    await userEvent.selectOptions(select, "30");

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("status code 400"),
    );
    expect(
      screen.getByTestId("AdminAssignmentsPage-table-course-10-assigned"),
    ).toHaveTextContent("Assigned 1");
  });

  test("a ULA recruitment: its heading, singular counts and its identity columns", async () => {
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.ulaPage);
    renderPage(2);
    expect(
      await screen.findByRole("heading", {
        name: "Assignments: ULA positions, W26",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByTestId("AdminAssignmentsPage-count"),
      ).toHaveTextContent(
        "1 applicant, 1 lecture, 3 ULAs allocated, 0 assigned so far.",
      ),
    );
    expect(assignmentsGets()[0].params).toEqual({ recruitmentId: "2" });
    expect(
      screen.getByTestId(
        "AdminAssignmentsPage-table-header-previousServiceAsUla",
      ),
    ).toHaveTextContent("Previous ULA Quarters");
  });

  test("an unknown recruitment and no applicants: a bare heading and zero counts", async () => {
    axiosMock
      .onGet("/api/admin/assignments")
      .reply(200, assignmentsFixtures.empty);
    renderPage(99);
    expect(
      await screen.findByRole("heading", { name: "Assignments" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(assignmentsGets()).toHaveLength(1));
    expect(screen.getByTestId("AdminAssignmentsPage-count")).toHaveTextContent(
      "0 applicants, 0 lectures, 0 TAs allocated, 0 assigned so far.",
    );
    expect(
      screen.queryByTestId("AdminAssignmentsPage-table-cell-row-0-col-email"),
    ).toBeNull();
  });
});
