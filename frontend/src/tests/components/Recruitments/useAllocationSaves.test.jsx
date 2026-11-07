import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import { useAllocationSaves } from "main/components/Recruitments/useAllocationSaves";
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

/**
 * The smallest table of Allocation boxes: one box per row, wired to the hook exactly as the
 * Combined Allocation table wires its own (issue #358). Until that issue the hook was exercised
 * through the Recruitment Courses table, which no longer has the boxes.
 */
function Boxes({
  courses = rows,
  requestHeaders,
  allocationBulkVersion,
  includeRemoved = false,
}) {
  const { allocationDrafts, onAllocationChange, onAllocationBlur } =
    useAllocationSaves(requestHeaders, allocationBulkVersion, includeRemoved);
  return (
    <>
      {courses.map((course, index) => (
        <input
          key={course.id}
          type="number"
          data-testid={`T-cell-row-${index}-allocation`}
          value={allocationDrafts[course.id] ?? String(course.allocation ?? 0)}
          onChange={(e) => onAllocationChange(course, e.target.value)}
          onBlur={onAllocationBlur}
        />
      ))}
    </>
  );
}

function renderBoxes(props = {}, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Boxes {...props} />
    </QueryClientProvider>,
  );
}

const allocationPuts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/recruitmentcourses/allocation",
  );
const box = (row) => screen.getByTestId(`T-cell-row-${row}-allocation`);

describe("useAllocationSaves: the edit pages' safety net (issues #278, #358)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("a valid allocation is saved at once, with the row's version, the bulk version and the tab's name", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(200, { ...rows[0], allocation: 7, allocationVersion: 5 });
    renderBoxes({
      allocationBulkVersion: 2,
      requestHeaders: { "X-Client-Id": "tab-1" },
    });

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    expect(allocationPuts()[0].method).toBe("put");
    expect(allocationPuts()[0].params).toEqual({
      id: 1,
      allocation: 7,
      expectedVersion: 4,
      expectedBulkVersion: 2,
    });
    expect(allocationPuts()[0].headers["X-Client-Id"]).toBe("tab-1");
    // The box shows what was typed while it has focus.
    expect(box(0)).toHaveValue(7);
  });

  test("an invalid entry is kept in the box but never sent, and leaving the box shows the stored value again", async () => {
    renderBoxes();

    fireEvent.change(box(0), { target: { value: "-1" } });
    expect(box(0)).toHaveValue(-1);
    fireEvent.change(box(0), { target: { value: "" } });
    expect(box(0)).toHaveValue(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(allocationPuts()).toHaveLength(0);

    fireEvent.blur(box(0));

    expect(box(0)).toHaveValue(2);
  });

  test("each row's box is independent", async () => {
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, rows[2]);
    renderBoxes();

    fireEvent.change(box(2), { target: { value: "5" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    expect(allocationPuts()[0].params.id).toBe(3);
    expect(allocationPuts()[0].params.allocation).toBe(5);
    expect(box(0)).toHaveValue(2);
    expect(box(1)).toHaveValue(3);
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
    renderBoxes({ allocationBulkVersion: 0 });

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

  test("an answer without a version leaves the row's own version in use", async () => {
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {
      ...rows[0],
      allocationVersion: undefined,
    });
    renderBoxes();

    fireEvent.change(box(0), { target: { value: "1" } });
    fireEvent.change(box(0), { target: { value: "12" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(2));
    expect(allocationPuts().map((r) => r.params.expectedVersion)).toEqual([
      4, 4,
    ]);
  });

  test("after the saves are done, the next edit uses the version of the row as it was last read", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(200, { ...rows[0], allocationVersion: 5 });
    const queryClient = new QueryClient();
    const { rerender } = renderBoxes({}, queryClient);
    fireEvent.change(box(0), { target: { value: "1" } });
    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    expect(allocationPuts()[0].params.expectedVersion).toBe(4);
    // Let the chain finish.
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Another tab changed the row meanwhile and the page read it again.
    const newer = rows.map((r) => ({ ...r, allocationVersion: 9 }));
    rerender(
      <QueryClientProvider client={queryClient}>
        <Boxes courses={newer} />
      </QueryClientProvider>,
    );
    fireEvent.change(box(0), { target: { value: "2" } });

    await waitFor(() => expect(allocationPuts()).toHaveLength(2));
    expect(allocationPuts()[1].params.expectedVersion).toBe(9);
  });

  test("a saved row goes straight into every cached course list, and the lists are read again", async () => {
    const saved = { ...rows[0], allocation: 9, allocationVersion: 5 };
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, saved);
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/recruitmentcourses/all", false], rows);
    queryClient.setQueryData(
      ["/api/recruitmentcourses/all", true],
      recruitmentCoursesFixtures.fourCourses,
    );
    queryClient.setQueryData(["/api/admin/recruitments/all"], [{ id: 1 }]);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderBoxes({}, queryClient);

    fireEvent.change(box(0), { target: { value: "9" } });

    await waitFor(() =>
      expect(
        queryClient.getQueryData(["/api/recruitmentcourses/all", false])[0],
      ).toEqual(saved),
    );
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", true])[0],
    ).toEqual(saved);
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", true])[3],
    ).toEqual(recruitmentCoursesFixtures.fourCourses[3]);
    expect(queryClient.getQueryData(["/api/admin/recruitments/all"])).toEqual([
      { id: 1 },
    ]);
    await waitFor(() =>
      expect(invalidate.mock.calls.map((c) => c[0].queryKey[0])).toContain(
        "/api/recruitmentcourses/all",
      ),
    );
    // Only a refused edit re-reads the recruitments.
    expect(invalidate.mock.calls.map((c) => c[0].queryKey[0])).not.toContain(
      "/api/admin/recruitments/all",
    );
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
    renderBoxes({}, queryClient);

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

  test("a refused edit whose answer has no row leaves the lists alone", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/recruitmentcourses/all", false], rows);
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(409, { message: "Changed elsewhere." });
    renderBoxes({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Changed elsewhere."),
    );
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", false]),
    ).toEqual(rows);
  });

  test("a refused edit with no body at all still says something and reads again", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["/api/recruitmentcourses/all", false], rows);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(409);
    renderBoxes({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 409",
      ),
    );
    expect(
      queryClient.getQueryData(["/api/recruitmentcourses/all", false]),
    ).toEqual(rows);
    expect(invalidate.mock.calls.map((c) => c[0].queryKey[0])).toContain(
      "/api/admin/recruitments/all",
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
    renderBoxes();

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
    renderBoxes({}, queryClient);

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 500",
      ),
    );
    expect(invalidate.mock.calls.map((c) => c[0].queryKey[0])).not.toContain(
      "/api/admin/recruitments/all",
    );
    // The draft is kept: the box still shows what was typed.
    expect(box(0)).toHaveValue(7);
  });

  test("a failure with no answer at all is a plain toast", async () => {
    axiosMock.onPut("/api/recruitmentcourses/allocation").networkError();
    renderBoxes();

    fireEvent.change(box(0), { target: { value: "7" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Error: Network Error"),
    );
  });
});
