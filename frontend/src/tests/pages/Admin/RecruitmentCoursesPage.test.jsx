import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
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

const notRemoved = recruitmentCoursesFixtures.fourCourses.filter(
  (c) => !c.removed,
);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/admin/recruitments/7/courses"]}>
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/courses"
            element={<RecruitmentCoursesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RecruitmentCoursesPage tests", () => {
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
      .onPost("/api/jobs/launch/populateRecruitmentCourses")
      .reply(200, { id: 1 });
    // Default view hides removed rows; includeRemoved=true reveals them.
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: false },
      })
      .reply(200, notRemoved);
    axiosMock
      .onGet("/api/recruitmentcourses/all", {
        params: { recruitmentId: "7", includeRemoved: true },
      })
      .reply(200, recruitmentCoursesFixtures.fourCourses);
  });

  test("lists the recruitment's courses", async () => {
    renderPage();

    expect(await screen.findByText("Recruitment Courses")).toBeInTheDocument();
    expect(
      await screen.findByTestId(
        "RecruitmentCoursesPage-cell-row-0-col-courseId",
      ),
    ).toHaveTextContent("CMPSC     1A", { normalizeWhitespace: false });
  });

  /** Removed rows are hidden until asked for. */
  test("removed courses are hidden by default", async () => {
    renderPage();

    await screen.findByTestId("RecruitmentCoursesPage-cell-row-0-col-courseId");
    expect(
      screen.queryByTestId("RecruitmentCoursesPage-cell-row-3-col-courseId"),
    ).toBeNull();
    expect(
      axiosMock.history.get.find((r) =>
        r.url.includes("/api/recruitmentcourses/all"),
      ).params.includeRemoved,
    ).toBe(false);
  });

  test("the toggle asks the backend for removed courses too", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-show-removed");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-show-removed"),
    );

    // The removed row appears, showing Unremove.
    const button = await screen.findByTestId(
      "RecruitmentCoursesPage-cell-row-3-col-removed-button",
    );
    expect(button).toHaveTextContent("Unremove");
  });

  test("Populate launches the job and points at the Jobs page", async () => {
    renderPage();
    await screen.findByTestId("RecruitmentCoursesPage-populate");

    await userEvent.click(
      screen.getByTestId("RecruitmentCoursesPage-populate"),
    );

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].params).toEqual({ recruitmentId: "7" });
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/Jobs/);
  });
});
