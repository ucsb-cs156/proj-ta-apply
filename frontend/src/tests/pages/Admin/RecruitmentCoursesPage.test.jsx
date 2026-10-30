import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
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
    // Recruitment 7, refreshed once (issue #124).
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        lastPopulatedAt: "2026-02-01T03:00:00",
      },
    ]);
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

  /** Issue #124: how fresh the list is, and that it is refreshed nightly. */
  test("says when the list was last refreshed", async () => {
    renderPage();

    // The line is up before the recruitment arrives, so wait for the stamped text.
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-last-refreshed"),
      ).toHaveTextContent(
        `Last refreshed from the UCSB schedule: ${new Date("2026-02-01T03:00:00").toLocaleString()}. Open, upcoming and recently closed recruitments are also refreshed automatically every night.`,
      ),
    );
  });

  test("another recruitment's stamp is not taken for this one's", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      {
        ...recruitmentsFixtures.threeRecruitments[0],
        id: 9,
        lastPopulatedAt: "2026-05-05T03:00:00",
      },
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        id: 7,
        lastPopulatedAt: null,
      },
    ]);
    renderPage();

    await waitFor(() =>
      expect(
        axiosMock.history.get.some(
          (r) => r.url === "/api/admin/recruitments/all",
        ),
      ).toBe(true),
    );
    const line = await screen.findByTestId(
      "RecruitmentCoursesPage-last-refreshed",
    );
    expect(line).toHaveTextContent("Not yet refreshed from the UCSB schedule.");
    expect(line).not.toHaveTextContent("Last refreshed");
  });

  test("says so when the recruitment is unknown", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    renderPage();

    expect(
      await screen.findByTestId("RecruitmentCoursesPage-last-refreshed"),
    ).toHaveTextContent("Not yet refreshed from the UCSB schedule.");
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

  // ---- add by enroll code (issue #125) ----

  test("adding by enroll code posts the code, toasts what was added and clears the box", async () => {
    axiosMock
      .onPost("/api/recruitmentcourses/post")
      .reply(200, recruitmentCoursesFixtures.oneManual);
    renderPage();

    const add = await screen.findByTestId("RecruitmentCoursesPage-add");
    expect(add).toBeDisabled();
    const box = screen.getByTestId("RecruitmentCoursesPage-enrollCode");
    expect(box.style.width).toBe("7em");
    expect(box).toHaveAttribute("placeholder", "e.g. 07492");
    // Blank-looking input is still nothing to send.
    await userEvent.type(box, "   ");
    expect(add).toBeDisabled();
    await userEvent.clear(box);
    expect(screen.getByLabelText("Add by enroll code")).toBe(
      screen.getByTestId("RecruitmentCoursesPage-enrollCode"),
    );
    await userEvent.type(
      screen.getByTestId("RecruitmentCoursesPage-enrollCode"),
      " 07600 ",
    );
    expect(add).toBeEnabled();
    await userEvent.click(add);

    await waitFor(() =>
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/recruitmentcourses/post",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.post.find(
        (r) => r.url === "/api/recruitmentcourses/post",
      ).params,
    ).toEqual({ recruitmentId: "7", enrollCode: "07600" });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Added CMPSC   165A section 0100 (07600).",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("RecruitmentCoursesPage-enrollCode"),
      ).toHaveValue(""),
    );
    // The list is re-fetched.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/recruitmentcourses/all",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
  });

  test("a refused enroll code shows the backend's reason and keeps the box", async () => {
    axiosMock.onPost("/api/recruitmentcourses/post").reply(400, {
      message: "Enroll code 07500 is section 0101, a discussion or lab",
    });
    renderPage();

    await userEvent.type(
      await screen.findByTestId("RecruitmentCoursesPage-enrollCode"),
      "07500",
    );
    await userEvent.click(screen.getByTestId("RecruitmentCoursesPage-add"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Enroll code 07500 is section 0101, a discussion or lab",
      ),
    );
    expect(screen.getByTestId("RecruitmentCoursesPage-enrollCode")).toHaveValue(
      "07500",
    );
  });

  test("a section without a number is still announced", async () => {
    axiosMock
      .onPost("/api/recruitmentcourses/post")
      .reply(200, { ...recruitmentCoursesFixtures.oneManual, section: null });
    renderPage();

    await userEvent.type(
      await screen.findByTestId("RecruitmentCoursesPage-enrollCode"),
      "07600",
    );
    await userEvent.click(screen.getByTestId("RecruitmentCoursesPage-add"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Added CMPSC   165A section  (07600).",
      ),
    );
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
