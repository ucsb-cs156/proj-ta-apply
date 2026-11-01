import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AllAllocationsPage from "main/pages/Instructor/AllAllocationsPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const url = "/api/instructor/recruitments/1/allocations";

function renderPage() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/recruitments/1/allocations"]}>
        <Routes>
          <Route
            path="/recruitments/:recruitmentId/allocations"
            element={<AllAllocationsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AllAllocationsPage tests", () => {
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
  });

  test("lists every course's allocation, sized to content, with the course id as stored", async () => {
    axiosMock
      .onGet(url)
      .reply(200, instructorRecruitmentsFixtures.allAllocations);
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "All Allocations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/How many TAs or ULAs the admin has allocated/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "home page" })).toHaveAttribute(
      "href",
      "/",
    );
    const table = await screen.findByTestId("AllAllocationsPage-table");
    expect(table).toHaveClass("w-auto");
    expect(
      [...table.querySelectorAll("thead th")].map((th) =>
        th.textContent.replace(/[🔼🔽]/g, "").trim(),
      ),
    ).toEqual(["Course", "Section", "Instructor", "Allocation"]);
    // Course, Section and Allocation shrink to their content; Instructor takes the rest.
    ["courseId", "section", "allocation"].forEach((id) => {
      const heading = screen.getByTestId(
        `AllAllocationsPage-table-header-${id}`,
      );
      expect(heading.style.width).toBe("1%");
      expect(heading.style.whiteSpace).toBe("nowrap");
    });
    expect(
      screen.getByTestId("AllAllocationsPage-table-header-instructor").style
        .width,
    ).toBe("");
    expect(
      screen.getByTestId("AllAllocationsPage-table-header-allocation").style
        .textAlign,
    ).toBe("right");
    expect(
      [...table.querySelectorAll("thead th")].map((th) =>
        th.getAttribute("data-testid"),
      ),
    ).toEqual([
      "AllAllocationsPage-table-header-courseId",
      "AllAllocationsPage-table-header-section",
      "AllAllocationsPage-table-header-instructor",
      "AllAllocationsPage-table-header-allocation",
    ]);
    const courseCell = screen.getByTestId(
      "AllAllocationsPage-table-cell-row-0-col-courseId",
    );
    expect(courseCell).toHaveTextContent("CMPSC     8", {
      normalizeWhitespace: false,
    });
    expect(courseCell.querySelector("span").style.fontFamily).toBe("monospace");
    expect(courseCell.querySelector("span").style.whiteSpace).toBe("pre");
    expect(
      screen.getByTestId("AllAllocationsPage-table-cell-row-1-col-section"),
    ).toHaveTextContent("0100");
    expect(
      screen.getByTestId("AllAllocationsPage-table-cell-row-1-col-instructor"),
    ).toHaveTextContent("CONRAD P");
    const allocation = screen.getByTestId(
      "AllAllocationsPage-table-cell-row-2-col-allocation",
    );
    expect(allocation).toHaveTextContent("3");
    expect(allocation.style.textAlign).toBe("right");
    expect(
      screen.getByTestId("AllAllocationsPage-table-header-courseId").style
        .width,
    ).toBe("1%");
    expect(axiosMock.history.get.filter((r) => r.url === url)).toHaveLength(1);
  });

  test("the course column sorts the padded id exactly as stored", async () => {
    axiosMock.onGet(url).reply(200, [
      {
        ...instructorRecruitmentsFixtures.allAllocations[1],
        id: 9,
        courseId: "CMPSC   130A",
      },
      {
        ...instructorRecruitmentsFixtures.allAllocations[0],
        id: 8,
        courseId: "CMPSC     5A",
      },
    ]);
    renderPage();
    await screen.findByTestId("AllAllocationsPage-table");
    const ids = () =>
      [
        ...screen
          .getByTestId("AllAllocationsPage-table")
          .querySelectorAll("tbody tr td:first-child span"),
      ].map((span) => span.textContent);
    expect(ids()).toEqual(["CMPSC   130A", "CMPSC     5A"]);

    screen
      .getByTestId("AllAllocationsPage-table-header-courseId-sort-header")
      .click();
    await waitFor(() =>
      expect(ids()).toEqual(["CMPSC     5A", "CMPSC   130A"]),
    );
  });

  test("while the admin hides all allocations, the backend's refusal is shown without a toast", async () => {
    axiosMock.onGet(url).reply(403, {
      message:
        "The admin has not chosen to show this recruitment's allocations to all faculty.",
    });
    renderPage();

    const alert = await screen.findByTestId("AllAllocationsPage-error");
    expect(alert).toHaveTextContent(
      "Unable to load the allocations: The admin has not chosen to show this recruitment's allocations to all faculty.",
    );
    expect(alert).toHaveAttribute("role", "alert");
    expect(mockToast).not.toHaveBeenCalled();
    expect(screen.queryByTestId("AllAllocationsPage-table")).toBeNull();
  });

  test("a server error is shown on the page and not toasted", async () => {
    axiosMock.onGet(url).reply(500, { message: "boom" });
    renderPage();

    expect(
      await screen.findByTestId("AllAllocationsPage-error"),
    ).toHaveTextContent("Unable to load the allocations: boom");
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("says it is loading, then that nothing came back when the body is empty", async () => {
    axiosMock.onGet(url).reply(200, null);
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading allocations...",
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No allocations were returned.",
      ),
    );
  });
});
