import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import CoursesPage from "main/pages/Instructor/CoursesPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const url = "/api/instructor/recruitments/1/courses";
const STORAGE_KEY = "recruitmentCourses.hiddenColumns.1";

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/recruitments/1/courses"]}>
        <Routes>
          <Route
            path="/recruitments/:recruitmentId/courses"
            element={<CoursesPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The ids of the columns in the table, left to right.
const headers = () =>
  [...document.querySelectorAll("thead th")].map((th) =>
    th.getAttribute("data-testid").replace("CoursesPage-header-", ""),
  );

describe("CoursesPage (instructors) tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    localStorage.clear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("with all allocations shown, the default columns include the five allocation columns", async () => {
    axiosMock
      .onGet(url)
      .reply(200, instructorRecruitmentsFixtures.coursesWithAllocations);
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Courses" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("CoursesPage-description"),
    ).toHaveTextContent(
      "Courses for which the department is planning to hire TAs for W26.",
    );
    expect(screen.getByRole("link", { name: "home page" })).toHaveAttribute(
      "href",
      "/",
    );
    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");
    expect(headers()).toEqual([
      "courseId",
      "instructor",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
    ]);
    // Read-only, with the figures as text and in page order.
    expect(
      screen.getByTestId("CoursesPage-cell-row-0-allocation"),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId("CoursesPage-cell-row-0-allocation").tagName,
    ).toBe("SPAN");
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.getByTestId("CoursesPage-cell-row-0-enrollmentEstimate"),
    ).toHaveTextContent("160");
  });

  test("with allocations not shown, the allocation columns are not in the table or the Columns menu", async () => {
    axiosMock
      .onGet(url)
      .reply(200, instructorRecruitmentsFixtures.coursesWithoutAllocations);
    renderPage();

    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");
    expect(headers()).toEqual([
      "courseId",
      "instructor",
      "enrollment",
      "maxEnroll",
    ]);
    fireEvent.click(screen.getByTestId("CoursesPage-columns-toggle"));
    for (const id of [
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
      "instructorEmail",
      "removed",
      "rankingCount",
    ]) {
      expect(screen.queryByTestId(`CoursesPage-columns-${id}`)).toBeNull();
    }
    for (const id of ["section", "title", "instructor", "status"]) {
      expect(
        screen.getByTestId(`CoursesPage-columns-${id}`),
      ).toBeInTheDocument();
    }
    // The menu is Show All and Show None plus the checkboxes: the course actions are the
    // Assignments page's alone.
    expect(
      screen.getByTestId("CoursesPage-columns-select-all"),
    ).toHaveTextContent("Show All");
    expect(
      screen.getByTestId("CoursesPage-columns-select-none"),
    ).toHaveTextContent("Show None");
    expect(
      screen.queryByTestId("CoursesPage-columns-show-all-courses"),
    ).toBeNull();
    expect(screen.queryByText("Show Only Incomplete Courses")).toBeNull();
    // Not hidden by the user's own list either: showing every column brings back only the offered.
    fireEvent.click(screen.getByTestId("CoursesPage-columns-select-all"));
    await screen.findByTestId("CoursesPage-header-section");
    expect(headers()).toEqual([
      "courseId",
      "section",
      "title",
      "instructor",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "status",
    ]);
  });

  test("an instructor never gets the Email column or the Remove button, even with every column shown", async () => {
    localStorage.setItem(STORAGE_KEY, "[]");
    axiosMock
      .onGet(url)
      .reply(200, instructorRecruitmentsFixtures.coursesWithAllocations);
    renderPage();

    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");
    expect(headers()).toEqual([
      "courseId",
      "section",
      "title",
      "instructor",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "allocation",
      "unroundedAllocation",
      "delta",
      "ratio",
      "status",
    ]);
  });

  test("the choice of columns is remembered in local storage and restored", async () => {
    axiosMock
      .onGet(url)
      .reply(200, instructorRecruitmentsFixtures.coursesWithAllocations);
    renderPage();
    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");

    fireEvent.click(screen.getByTestId("CoursesPage-columns-toggle"));
    fireEvent.click(screen.getByTestId("CoursesPage-columns-room"));
    fireEvent.click(screen.getByTestId("CoursesPage-columns-instructor"));
    await waitFor(() =>
      expect(screen.queryByTestId("CoursesPage-header-instructor")).toBeNull(),
    );
    expect(screen.getByTestId("CoursesPage-header-room")).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored).toContain("instructor");
    expect(stored).not.toContain("room");

    cleanup();
    renderPage();
    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");
    expect(screen.queryByTestId("CoursesPage-header-instructor")).toBeNull();
    expect(screen.getByTestId("CoursesPage-header-room")).toBeInTheDocument();
  });

  test("the hide link over a column hides it", async () => {
    axiosMock
      .onGet(url)
      .reply(200, instructorRecruitmentsFixtures.coursesWithAllocations);
    renderPage();
    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");

    fireEvent.click(screen.getByRole("button", { name: "Hide Delta column" }));

    await waitFor(() =>
      expect(screen.queryByTestId("CoursesPage-header-delta")).toBeNull(),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toContain("delta");
  });

  test("a summer recruitment offers the Summer Session column", async () => {
    axiosMock.onGet(url).reply(200, {
      ...instructorRecruitmentsFixtures.coursesWithoutAllocations,
      quarter: "20263",
    });
    renderPage();
    await screen.findByTestId("CoursesPage-cell-row-0-col-courseId");

    fireEvent.click(screen.getByTestId("CoursesPage-columns-toggle"));
    expect(
      screen.getByTestId("CoursesPage-columns-summerSession"),
    ).toBeInTheDocument();
  });

  test("a failed load says why", async () => {
    axiosMock
      .onGet(url)
      .reply(404, { message: "Recruitment with id 1 not found" });
    renderPage();

    expect(await screen.findByTestId("CoursesPage-error")).toHaveTextContent(
      "Unable to load the courses: Recruitment with id 1 not found",
    );
    // The page says so itself; no toast as well.
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("while loading it says so, and when nothing comes back it says that", async () => {
    axiosMock.onGet(url).reply(200, null);
    renderPage();

    expect(await screen.findByRole("status")).toHaveTextContent(
      /Loading courses\.\.\.|No courses were returned\./,
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No courses were returned.",
      ),
    );
  });
});
