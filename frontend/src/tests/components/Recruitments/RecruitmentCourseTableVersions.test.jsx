import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import RecruitmentCourseTable from "main/components/Recruitments/RecruitmentCourseTable";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

const rows = recruitmentCoursesFixtures.fourCourses
  .filter((c) => !c.removed)
  .map((c) => ({ ...c, allocationVersion: 4 }));

function renderTable(props = {}, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RecruitmentCourseTable
          courses={rows}
          includeRemoved={false}
          testIdPrefix="T"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const puts = (url) => axiosMock.history.put.filter((r) => r.url === url);
const allocationPuts = () => puts("/api/recruitmentcourses/allocation");
const box = (row) => screen.getByTestId(`T-cell-row-${row}-allocation`);

describe("RecruitmentCourseTable: the edit page's safety net (issue #278)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimate")
      .reply(200, {});
    axiosMock.onPut("/api/recruitmentcourses/removed").reply(200, {});
  });

  test("an allocation edit carries the row's version and the recruitment's bulk version", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(200, { ...rows[0], allocation: 7, allocationVersion: 5 });
    renderTable({ allocationBulkVersion: 2 });

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    expect(allocationPuts()[0].params).toEqual({
      id: 1,
      allocation: 7,
      expectedVersion: 4,
      expectedBulkVersion: 2,
    });
  });

  test("the saves of one box go one after the other, each with the version the last came back with", async () => {
    let count = 0;
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(() => {
      count += 1;
      return [
        200,
        { ...rows[0], allocation: count, allocationVersion: 4 + count },
      ];
    });
    renderTable({ allocationBulkVersion: 0 });

    fireEvent.change(box(0), { target: { value: "1" } });
    fireEvent.change(box(0), { target: { value: "12" } });
    fireEvent.change(box(0), { target: { value: "123" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(3));
    expect(allocationPuts().map((r) => r.params.expectedVersion)).toEqual([
      4, 5, 6,
    ]);
    expect(allocationPuts().map((r) => r.params.allocation)).toEqual([
      1, 12, 123,
    ]);
  });

  test("after the saves are done, the next edit uses the version of the row as it was last read", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(200, { ...rows[0], allocationVersion: 5 });
    const { rerender } = renderTable();
    fireEvent.change(box(0), { target: { value: "1" } });
    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    // Let the chain finish.
    await waitFor(() =>
      expect(allocationPuts()[0].params.expectedVersion).toBe(4),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Another tab changed the row meanwhile and the page read it again.
    const newer = rows.map((r) => ({ ...r, allocationVersion: 9 }));
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecruitmentCourseTable
            courses={newer}
            includeRemoved={false}
            testIdPrefix="T"
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(box(0), { target: { value: "2" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(2));
    expect(allocationPuts()[1].params.expectedVersion).toBe(9);
  });

  test("a refused edit says why, puts the row as it now is into the lists, and reads everything again", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/recruitmentcourses/all", false], rows);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const current = { ...rows[0], allocation: 9, allocationVersion: 6 };
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(409, {
      message:
        "All the allocations were changed in another tab or window. Reload to see them.",
      reloadAll: true,
      course: current,
    });
    renderTable({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "All the allocations were changed in another tab or window. Reload to see them.",
      ),
    );
    expect(
      queryClient
        .getQueryData(["/api/recruitmentcourses/all", false])
        .find((c) => c.id === 1),
    ).toEqual(current);
    const keys = invalidate.mock.calls.map((c) => c[0].queryKey[0]);
    // The mutation itself invalidates the courses once; the conflict adds one more, and the
    // recruitment.
    expect(
      keys.filter((k) => k === "/api/recruitmentcourses/all"),
    ).toHaveLength(2);
    expect(keys).toContain("/api/admin/recruitments/all");
    // The box shows the stored value again, not what was typed.
    expect(box(0)).toHaveValue(rows[0].allocation);
  });

  test("a refused edit without the row in its answer still reads everything again", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(409, { message: "Changed elsewhere." });
    renderTable();

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Changed elsewhere."),
    );
  });

  test("what was typed after a refused edit is not sent", async () => {
    let first = true;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(async () => {
      if (first) {
        first = false;
        await gate;
        return [409, { message: "Changed elsewhere." }];
      }
      return [200, { ...rows[0] }];
    });
    renderTable();

    fireEvent.change(box(0), { target: { value: "1" } });
    fireEvent.change(box(0), { target: { value: "12" } });
    release();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Changed elsewhere."),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(allocationPuts()).toHaveLength(1);
  });

  test("another kind of failure is a plain toast and does not read everything again", async () => {
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(500);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderTable({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 500",
      ),
    );
    expect(invalidate.mock.calls.map((c) => c[0].queryKey[0])).not.toContain(
      "/api/admin/recruitments/all",
    );
  });

  test("the estimate saves name this tab", async () => {
    vi.useFakeTimers();
    renderTable({ requestHeaders: { "X-Client-Id": "tab-1" } });

    fireEvent.change(screen.getByTestId("T-cell-row-0-enrollmentEstimate"), {
      target: { value: "300" },
    });
    await vi.advanceTimersByTimeAsync(2000);

    const sent = puts("/api/recruitmentcourses/enrollmentEstimate");
    expect(sent).toHaveLength(1);
    expect(sent[0].headers["X-Client-Id"]).toBe("tab-1");
    vi.useRealTimers();
  });

  test("an estimate pending when the table goes away is sent with the tab's name", async () => {
    vi.useFakeTimers();
    const { unmount } = renderTable({
      requestHeaders: { "X-Client-Id": "tab-2" },
    });
    fireEvent.change(screen.getByTestId("T-cell-row-0-enrollmentEstimate"), {
      target: { value: "300" },
    });

    unmount();
    await vi.advanceTimersByTimeAsync(10);

    const sent = puts("/api/recruitmentcourses/enrollmentEstimate");
    expect(sent).toHaveLength(1);
    expect(sent[0].headers["X-Client-Id"]).toBe("tab-2");
    vi.useRealTimers();
  });

  test("the read-only table shows the figures as text and has no Remove button", () => {
    renderTable({ readOnly: true });

    expect(screen.getByTestId("T-cell-row-0-allocation").tagName).toBe("SPAN");
    expect(screen.getByTestId("T-cell-row-0-allocation")).toHaveTextContent(
      "2",
    );
    expect(screen.getByTestId("T-cell-row-0-enrollmentEstimate").tagName).toBe(
      "SPAN",
    );
    expect(
      screen.getByTestId("T-cell-row-0-enrollmentEstimate"),
    ).toHaveTextContent("220");
    expect(screen.queryByTestId("T-cell-row-0-col-removed-button")).toBeNull();
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });

  test("a read-only row without an estimate shows nothing for it", () => {
    const { enrollmentEstimate: _omitted, ...bare } = rows[0];
    renderTable({ readOnly: true, courses: [bare] });

    expect(
      screen.getByTestId("T-cell-row-0-enrollmentEstimate").textContent,
    ).toBe("");
  });

  test("a refused edit with no body at all still says something and reads again", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/recruitmentcourses/all", false], rows);
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(409);
    renderTable({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 409",
      ),
    );
    // The lists are as they were; nothing was put into them.
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", false]),
    ).toEqual(rows);
  });

  test("a refused edit whose answer has no row leaves the lists alone", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/recruitmentcourses/all", false], rows);
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(409, { message: "Changed elsewhere." });
    renderTable({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Changed elsewhere."),
    );
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", false]),
    ).toEqual(rows);
  });

  test("a failure with no answer at all is a plain toast", async () => {
    axiosMock.onPut("/api/recruitmentcourses/allocation").networkError();
    renderTable();

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Error: Network Error"),
    );
  });
});
