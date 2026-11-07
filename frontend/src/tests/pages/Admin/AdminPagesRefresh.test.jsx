import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import InstructorsIndexPage from "main/pages/Admin/InstructorsIndexPage";
import CoursesIndexPage from "main/pages/Admin/CoursesIndexPage";
import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";
import coursesFixtures from "fixtures/coursesFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

/** Issue #282: admin pages update by themselves; the shortest interval allowed, 1 s. */
const fastRefresh = {
  ...systemInfoFixtures.showingNeither,
  adminRefreshSec: 1,
  adminRefreshJitter: 0,
  nonAdminRefresh: 1,
  nonAdminJitter: 0,
};

const slow = { timeout: 5000 };

function setup() {
  axiosMock.reset();
  axiosMock.resetHistory();
  axiosMock
    .onGet("/api/currentUser")
    .reply(200, apiCurrentUserFixtures.adminUser);
  axiosMock.onGet("/api/systemInfo").reply(200, fastRefresh);
}

const client = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const gets = (url) => axiosMock.history.get.filter((r) => r.url === url);

describe("Instructors page refreshes by itself (issue #282)", () => {
  const select = "InstructorsIndexPage-cell-row-2-col-catalogName-select";
  const email = "InstructorsIndexPage-cell-row-2-col-email";

  const renderPage = () =>
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  beforeEach(() => {
    setup();
    axiosMock
      .onGet("/api/admin/instructors/catalogNames")
      .reply(200, roleEmailFixtures.catalogNames);
  });

  test("an instructor added by another admin appears without a reload", async () => {
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems.slice(0, 2));
    renderPage();
    await screen.findByTestId("InstructorsIndexPage-cell-row-1-col-email");
    expect(screen.queryByTestId(email)).not.toBeInTheDocument();

    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    expect(await screen.findByTestId(email, {}, slow)).toHaveTextContent(
      "instructor2@example.com",
    );
  });

  test("a catalog name set by another admin appears, but not under a dropdown being used", async () => {
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    renderPage();
    const dropdown = await screen.findByTestId(select);
    expect(dropdown).toHaveValue("");

    // Focused: another admin's change is held back.
    dropdown.focus();
    const elsewhere = roleEmailFixtures.threeItems.map((i) =>
      i.email === "instructor2@example.com"
        ? { ...i, catalogName: "TEACHER S" }
        : i,
    );
    axiosMock.onGet("/api/admin/instructors/get").reply(200, elsewhere);
    const before = gets("/api/admin/instructors/get").length;
    await waitFor(
      () =>
        expect(gets("/api/admin/instructors/get").length).toBeGreaterThan(
          before,
        ),
      slow,
    );
    expect(screen.getByTestId(select)).toHaveValue("");

    // Left: it follows the stored value.
    dropdown.blur();
    await waitFor(
      () => expect(screen.getByTestId(select)).toHaveValue("TEACHER S"),
      slow,
    );
  });

  test("choosing a name keeps showing the choice and saves it", async () => {
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    axiosMock.onPut("/api/admin/instructors/catalogName").reply(200, {});
    renderPage();
    const dropdown = await screen.findByTestId(select);
    await userEvent.selectOptions(dropdown, "CONRAD P");
    expect(screen.getByTestId(select)).toHaveValue("CONRAD P");
    await waitFor(() =>
      expect(
        axiosMock.history.put.filter(
          (r) => r.url === "/api/admin/instructors/catalogName",
        )[0].params,
      ).toEqual({ email: "instructor2@example.com", catalogName: "CONRAD P" }),
    );
  });
});

describe("Courses page refreshes by itself (issue #282)", () => {
  test("a course added by another admin appears without a reload", async () => {
    setup();
    axiosMock
      .onGet("/api/courses/all")
      .reply(200, coursesFixtures.threeCourses.slice(0, 1));
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <CoursesIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("Data Structures and Algorithms I");
    expect(
      screen.queryByText("Advanced Applications Programming"),
    ).not.toBeInTheDocument();

    axiosMock
      .onGet("/api/courses/all")
      .reply(200, coursesFixtures.threeCourses);
    expect(
      await screen.findByText("Advanced Applications Programming", {}, slow),
    ).toBeInTheDocument();
  });
});

describe("A recruitment's course list refreshes by itself (issue #282)", () => {
  const notRemoved = recruitmentCoursesFixtures.fourCourses.filter(
    (c) => !c.removed,
  );
  // Issue #358: the estimates left this page, so the figure watched is the enrollment.
  const box = "RecruitmentCoursesPage-cell-row-0-col-enrollment";

  const withEstimate = (value) =>
    notRemoved.map((c, i) => (i === 0 ? { ...c, enrollment: value } : c));

  beforeEach(() => {
    setup();
    axiosMock.onGet("/api/admin/hiddencolumns").reply(200, []);
    axiosMock.onPost("/api/recruitmentcourses/refresh").reply(200, notRemoved);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, [{ ...recruitmentsFixtures.threeRecruitments[1], id: 7 }]);
    axiosMock
      .onGet("/api/instructor/recruitments/7/admin-course-rankings")
      .reply(200, recruitmentCoursesFixtures.rankingSummaries);
  });

  const renderPage = (edit = false) =>
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter
          initialEntries={[
            `/admin/recruitments/7/courses${edit ? "/edit" : ""}`,
          ]}
        >
          <Routes>
            <Route
              path="/admin/recruitments/:recruitmentId/courses"
              element={<RecruitmentCoursesPage />}
            />
            <Route
              path="/admin/recruitments/:recruitmentId/courses/edit"
              element={<RecruitmentCoursesPage edit />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  test("the view-only page shows another admin's change on its own", async () => {
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, withEstimate(220));
    renderPage();
    expect(await screen.findByTestId(box)).toHaveTextContent("220");
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, withEstimate(500));
    await waitFor(
      () => expect(screen.getByTestId(box)).toHaveTextContent("500"),
      slow,
    );
  });

  test("the edit page does not refresh in the background, so nothing moves under the editor", async () => {
    axiosMock.onPost("/api/recruitmentcourses/heartbeat").reply(200, {});
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, withEstimate(220));
    renderPage(true);
    expect(await screen.findByTestId(box)).toHaveTextContent("220");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const before = gets("/api/recruitmentcourses/all").length;
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, withEstimate(500));
    // Longer than the 1 s refresh interval used here: no further read is made.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(gets("/api/recruitmentcourses/all").length).toBe(before);
    expect(screen.getByTestId(box)).toHaveTextContent("220");
  });
});
