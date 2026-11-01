import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import PublishedAssignmentsPage from "main/pages/Assignments/PublishedAssignmentsPage";
import publishedAssignmentsFixtures from "fixtures/publishedAssignmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage(recruitmentId = 1) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[`/recruitments/${recruitmentId}/assignments`]}
      >
        <Routes>
          <Route
            path="/recruitments/:recruitmentId/assignments"
            element={<PublishedAssignmentsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const gets = () =>
  axiosMock.history.get
    .filter((r) => r.url === "/api/assignments")
    .map((r) => r.params);

const cellText = (row, col) =>
  screen.getByTestId(
    `PublishedAssignmentsPage-table-cell-row-${row}-col-c${col}`,
  ).textContent;

describe("PublishedAssignmentsPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/assignments", {
        params: { recruitmentId: "1", layout: "course" },
      })
      .reply(200, publishedAssignmentsFixtures.taByCourse);
    axiosMock
      .onGet("/api/assignments", {
        params: { recruitmentId: "1", layout: "student" },
      })
      .reply(200, publishedAssignmentsFixtures.taByStudent);
    axiosMock
      .onGet("/api/assignments", {
        params: { recruitmentId: "2", layout: "course" },
      })
      .reply(200, publishedAssignmentsFixtures.ulaByCourseEmpty);
    axiosMock
      .onGet("/api/assignments", {
        params: { recruitmentId: "2", layout: "student" },
      })
      .reply(200, publishedAssignmentsFixtures.ulaByStudent);
  });

  test("opens on one row per course, with the headers and rows the backend sent", async () => {
    renderPage(1);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Assignments" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("PublishedAssignmentsPage-type"),
    ).toHaveTextContent(
      "TA recruitment: who has been assigned to each course.",
    );

    const course = screen.getByLabelText("One Row per course");
    const student = screen.getByLabelText("One Row per TA/ULA");
    expect(course).toBeChecked();
    expect(student).not.toBeChecked();
    expect(course).toHaveAttribute("type", "radio");
    expect(course).toHaveAttribute("name", "layout");
    expect(course).toBe(
      screen.getByTestId("PublishedAssignmentsPage-layout-course"),
    );
    expect(course.closest(".form-check")).toHaveClass("form-check-inline");
    expect(screen.getByTestId("PublishedAssignmentsPage-layout")).toHaveClass(
      "mb-3",
    );

    expect(gets()).toEqual([{ recruitmentId: "1", layout: "course" }]);
    const headers = [
      ...screen
        .getByTestId("PublishedAssignmentsPage-table")
        .querySelectorAll("th"),
    ].map((th) => th.textContent.replace(/[🔼🔽]/g, "").trim());
    expect(headers).toEqual([
      "Course",
      "Instructor",
      "Instructor email",
      "TA",
      "TA",
    ]);
    expect(cellText(0, 0)).toBe("CMPSC 8");
    expect(cellText(0, 1)).toBe("CONRAD P");
    expect(cellText(0, 2)).toBe("pconrad@ucsb.edu");
    expect(cellText(0, 3)).toBe("Grace Hopper (grace@ucsb.edu)");
    expect(cellText(0, 4)).toBe("Ada Lovelace (ada@ucsb.edu)");
    expect(cellText(1, 2)).toBe("Not mapped");
    expect(cellText(1, 4)).toBe("");
    expect(cellText(2, 0)).toBe("CMPSC 130A");
    expect(
      screen
        .getByTestId("PublishedAssignmentsPage-table")
        .querySelectorAll("tbody tr"),
    ).toHaveLength(3);
    expect(
      screen.queryByTestId("PublishedAssignmentsPage-error"),
    ).not.toBeInTheDocument();
  });

  test("the other radio button fetches and shows one row per TA", async () => {
    renderPage(1);
    await screen.findByTestId(
      "PublishedAssignmentsPage-table-cell-row-0-col-c0",
    );

    await userEvent.click(screen.getByLabelText("One Row per TA/ULA"));

    await waitFor(() =>
      expect(gets()).toEqual([
        { recruitmentId: "1", layout: "course" },
        { recruitmentId: "1", layout: "student" },
      ]),
    );
    await waitFor(() => expect(cellText(0, 0)).toBe("Grace"));
    expect(screen.getByLabelText("One Row per TA/ULA")).toBeChecked();
    expect(screen.getByLabelText("One Row per course")).not.toBeChecked();
    const headers = [
      ...screen
        .getByTestId("PublishedAssignmentsPage-table")
        .querySelectorAll("th"),
    ].map((th) => th.textContent.replace(/[🔼🔽]/g, "").trim());
    expect(headers).toEqual([
      "First name",
      "Last name",
      "Email",
      "Course assignment",
      "Course instructor",
      "Course instructor email",
    ]);
    expect(cellText(2, 5)).toBe("Not mapped");

    // And back again, from the cache.
    await userEvent.click(screen.getByLabelText("One Row per course"));
    await waitFor(() => expect(cellText(0, 0)).toBe("CMPSC 8"));
  });

  test("a ULA recruitment has the first-time column and may have nobody assigned", async () => {
    renderPage(2);
    expect(
      await screen.findByTestId("PublishedAssignmentsPage-type"),
    ).toHaveTextContent("ULA recruitment");
    await waitFor(() => expect(cellText(0, 0)).toBe("CMPSC 1A"));
    expect(
      screen
        .getByTestId("PublishedAssignmentsPage-table")
        .querySelectorAll("th"),
    ).toHaveLength(3);

    await userEvent.click(screen.getByLabelText("One Row per TA/ULA"));

    await waitFor(() => expect(cellText(0, 6)).toBe("yes"));
    expect(cellText(1, 6)).toBe("no");
    expect(
      screen.getByTestId("PublishedAssignmentsPage-table-header-c6"),
    ).toHaveTextContent("First time ULA");
  });

  test("the download links point at the CSV endpoint for each layout", async () => {
    renderPage(1);
    await screen.findByTestId(
      "PublishedAssignmentsPage-table-cell-row-0-col-c0",
    );

    const byCourse = screen.getByTestId("PublishedAssignmentsPage-csv-course");
    expect(byCourse).toHaveTextContent("Download CSV (row per course)");
    expect(byCourse).toHaveAttribute(
      "href",
      "/api/assignments/csv?recruitmentId=1&layout=course",
    );
    expect(byCourse).toHaveAttribute("download", "assignments-1-course.csv");
    expect(byCourse).toHaveClass("btn", "btn-outline-secondary");
    const byStudent = screen.getByTestId(
      "PublishedAssignmentsPage-csv-student",
    );
    expect(byStudent).toHaveTextContent("Download CSV (row per student)");
    expect(byStudent).toHaveAttribute(
      "href",
      "/api/assignments/csv?recruitmentId=1&layout=student",
    );
    expect(byStudent).toHaveAttribute("download", "assignments-1-student.csv");
    expect(byCourse.parentElement).toHaveClass(
      "d-flex",
      "flex-wrap",
      "gap-2",
      "mt-3",
    );
    expect(byCourse.parentElement).toBe(byStudent.parentElement);
  });

  test("before the answer arrives the table is empty and nothing is said about the type", () => {
    renderPage(1);

    expect(
      screen.getByRole("heading", { level: 1, name: "Assignments" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("PublishedAssignmentsPage-type"),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByTestId("PublishedAssignmentsPage-table")
        .querySelectorAll("tbody tr"),
    ).toHaveLength(0);
    expect(
      screen
        .getByTestId("PublishedAssignmentsPage-table")
        .querySelectorAll("th"),
    ).toHaveLength(0);
  });

  test("unpublished assignments show the backend's message instead of a table, without a toast", async () => {
    axiosMock
      .onGet("/api/assignments", {
        params: { recruitmentId: "3", layout: "course" },
      })
      .reply(400, {
        type: "IllegalArgumentException",
        message: "Assignments for recruitment 3 have not been published",
      });
    renderPage(3);

    const alert = await screen.findByTestId("PublishedAssignmentsPage-error");
    expect(alert).toHaveTextContent(
      "Assignments for recruitment 3 have not been published",
    );
    expect(alert).toHaveAttribute("role", "alert");
    expect(
      screen.queryByTestId("PublishedAssignmentsPage-table"),
    ).not.toBeInTheDocument();
    expect(mockToast).not.toHaveBeenCalled();
    // The downloads are still offered; the backend refuses them the same way.
    expect(
      screen.getByTestId("PublishedAssignmentsPage-csv-course"),
    ).toHaveAttribute(
      "href",
      "/api/assignments/csv?recruitmentId=3&layout=course",
    );
  });

  test("a tentative table carries the note above the type line", async () => {
    axiosMock
      .onGet("/api/assignments", {
        params: { recruitmentId: "1", layout: "course" },
      })
      .reply(200, publishedAssignmentsFixtures.taByCourseTentative);
    renderPage();

    const note = await screen.findByTestId(
      "PublishedAssignmentsPage-tentative",
    );
    expect(note).toHaveTextContent(
      "Tentative; part of the hiring process has been reopened",
    );
    expect(note).toHaveClass("fw-bold");
    expect(
      note.compareDocumentPosition(
        screen.getByTestId("PublishedAssignmentsPage-type"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("a table that is not tentative has no note, and nothing says Final", async () => {
    renderPage();
    await screen.findByTestId("PublishedAssignmentsPage-type");

    expect(
      screen.queryByTestId("PublishedAssignmentsPage-tentative"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("PublishedAssignmentsPage").textContent,
    ).not.toMatch(/final/i);
  });
});
