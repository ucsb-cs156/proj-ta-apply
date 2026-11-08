import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import HiringTargetPanel from "main/components/Recruitments/HiringTargetPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

// A TA recruitment expecting to hire 10.
const taRecruitment = {
  ...recruitmentsFixtures.threeRecruitments[2],
  id: 7,
  totalHiringTarget: 10,
};
// A ULA recruitment expecting to hire 6.
const ulaRecruitment = {
  ...recruitmentsFixtures.threeRecruitments[1],
  id: 8,
  totalHiringTarget: 6,
};

function renderPanel(
  recruitment = taRecruitment,
  allocatedSoFar = 4,
  readOnly = false,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <HiringTargetPanel
        recruitment={recruitment}
        allocatedSoFar={allocatedSoFar}
        testIdPrefix="Panel"
        readOnly={readOnly}
      />
    </QueryClientProvider>,
  );
}

const puts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/admin/recruitments/totalHiringTarget",
  );

/** The label and the number of one row of the table (issue #320). */
const rowText = (id) => [
  screen.getByTestId(`Panel-${id}-label`).textContent,
  screen.getByTestId(`Panel-${id}-value`).textContent,
];

describe("HiringTargetPanel tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut("/api/admin/recruitments/totalHiringTarget").reply(200, {});
  });

  test("labels the box by the recruitment's type and shows the stored value", () => {
    renderPanel();

    const box = screen.getByLabelText(
      "Total number of TAs expected to be hired:",
    );
    expect(box).toBe(screen.getByTestId("Panel-totalHiringTarget"));
    expect(box).toHaveValue(10);
    expect(box).toHaveAttribute("type", "number");
    expect(box).toHaveAttribute("min", "1");
    expect(box).toHaveAttribute("step", "1");
    expect(box.style.width).toBe("6em");
    expect(box).toHaveClass("form-control-sm");
    // The box is a block, pushed to the right edge of the numbers column.
    expect(box).toHaveClass("ms-auto");
    expect(screen.getByTestId("Panel")).toHaveClass("mb-3");
    const label = document.querySelector(
      'label[for="Panel-totalHiringTarget"]',
    );
    expect(label.textContent).toBe("Total number of TAs expected to be hired:");
    expect(label).toHaveClass("mb-0");
    // The label is in the first cell of the row, the box in the second.
    expect(
      screen.getByTestId("Panel-totalHiringTarget-label").contains(label),
    ).toBe(true);
    expect(
      screen.getByTestId("Panel-totalHiringTarget-value").contains(box),
    ).toBe(true);
  });

  test("has a default test id prefix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HiringTargetPanel recruitment={taRecruitment} allocatedSoFar={0} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("HiringTargetPanel")).toBeInTheDocument();
    expect(
      screen.getByTestId("HiringTargetPanel-totalHiringTarget"),
    ).toHaveValue(10);
    expect(
      screen.getByTestId("HiringTargetPanel-allocated-value"),
    ).toHaveTextContent(/^0$/);
  });

  test("says ULAs for a ULA recruitment", () => {
    renderPanel(ulaRecruitment, 2);

    expect(
      screen.getByLabelText("Total number of ULAs expected to be hired:"),
    ).toHaveValue(6);
    expect(rowText("left")).toEqual(["ULA allocations left to assign:", "4"]);
  });

  test("a recruitment without a target yet counts as expecting one", () => {
    const { totalHiringTarget: _omitted, ...legacy } = taRecruitment;
    renderPanel(legacy, 0);

    expect(screen.getByTestId("Panel-totalHiringTarget")).toHaveValue(1);
    expect(rowText("left")).toEqual(["TA allocations left to assign:", "1"]);
  });

  test("the allocated and left counts add up to the target", () => {
    renderPanel(taRecruitment, 4);

    expect(rowText("allocated")).toEqual(["Allocated so far:", "4"]);
    expect(rowText("left")).toEqual(["TA allocations left to assign:", "6"]);
    expect(screen.queryByTestId("Panel-over")).not.toBeInTheDocument();
  });

  test("exactly allocated shows zero left and no warning", () => {
    renderPanel(taRecruitment, 10);

    expect(rowText("left")).toEqual(["TA allocations left to assign:", "0"]);
    expect(screen.queryByTestId("Panel-over")).not.toBeInTheDocument();
  });

  test("over-allocation shows a negative number and the warning, under the table", () => {
    renderPanel(taRecruitment, 13);

    expect(rowText("left")).toEqual(["TA allocations left to assign:", "-3"]);
    const warning = screen.getByTestId("Panel-over");
    expect(warning).toHaveTextContent(
      "Please either increase the hiring target, or reduce the allocations for one or more courses.",
    );
    expect(warning).toHaveClass("text-danger");
    expect(
      screen.getByTestId("Panel-table").compareDocumentPosition(warning) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId("Panel-table").contains(warning)).toBe(false);
  });

  test("a valid number is saved as soon as it is typed, and the recruitments are re-read", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderPanel(taRecruitment, 4, false, queryClient);
    const box = screen.getByTestId("Panel-totalHiringTarget");

    await userEvent.clear(box);
    await userEvent.type(box, "12");

    // "1" was valid on its own, then "12".
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts().map((r) => r.params)).toEqual([
      { id: 7, totalHiringTarget: 1 },
      { id: 7, totalHiringTarget: 12 },
    ]);
    expect(puts()[0].method).toBe("put");
    expect(box).toHaveValue(12);
    expect(box).not.toHaveClass("is-invalid");
    // Each save re-reads the recruitment list, which carries the stored target.
    await waitFor(() =>
      expect(invalidate.mock.calls.map((c) => c[0].queryKey)).toEqual([
        ["/api/admin/recruitments/all"],
        ["/api/admin/recruitments/all"],
      ]),
    );
  });

  test("an invalid value is never sent, is flagged, and reverts on blur", async () => {
    renderPanel();
    const box = screen.getByTestId("Panel-totalHiringTarget");

    await userEvent.clear(box);
    expect(box).toHaveValue(null);
    expect(box).toHaveClass("is-invalid");
    await userEvent.type(box, "0");
    expect(box).toHaveValue(0);
    expect(box).toHaveClass("is-invalid");
    expect(puts()).toHaveLength(0);

    await userEvent.tab();

    expect(box).toHaveValue(10);
    expect(box).not.toHaveClass("is-invalid");
    expect(puts()).toHaveLength(0);
  });

  test("a value the backend refuses is reported and reverts on blur", async () => {
    axiosMock
      .onPut("/api/admin/recruitments/totalHiringTarget")
      .reply(400, { message: "totalHiringTarget must be at least 1" });
    renderPanel();
    const box = screen.getByTestId("Panel-totalHiringTarget");

    await userEvent.clear(box);
    await userEvent.type(box, "5");

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/400/);
    expect(box).toHaveValue(5);
    await userEvent.tab();
    expect(box).toHaveValue(10);
  });

  test("read-only (the view-only Courses page) shows the target as a number, with the totals", () => {
    renderPanel(taRecruitment, 4, true);

    // No box, so nothing carries the box's test id; the row and its cells do.
    expect(screen.queryByTestId("Panel-totalHiringTarget")).toBeNull();
    expect(screen.getByTestId("Panel-totalHiringTarget-row").tagName).toBe(
      "TR",
    );
    expect(rowText("totalHiringTarget")).toEqual([
      "Total number of TAs expected to be hired:",
      "10",
    ]);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(document.querySelector("label")).toBeNull();
    expect(rowText("allocated")).toEqual(["Allocated so far:", "4"]);
    expect(rowText("left")).toEqual(["TA allocations left to assign:", "6"]);
  });

  // Issue #320: the three lines are a two-column table.
  test("the figures are a small two-column table: labels left, numbers right, no header, not sortable", () => {
    renderPanel(ulaRecruitment, 2, true);

    const table = screen.getByTestId("Panel-table");
    expect(table.tagName).toBe("TABLE");
    expect(table).toHaveClass(
      "table",
      "table-sm",
      "table-borderless",
      "w-auto",
      "mb-2",
      "align-middle",
    );
    expect(table.querySelector("thead")).toBeNull();
    expect(table.querySelector("tfoot")).toBeNull();
    expect(table.querySelectorAll("th")).toHaveLength(0);
    expect(table.querySelectorAll("button, a")).toHaveLength(0);
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows.map((tr) => tr.getAttribute("data-testid"))).toEqual([
      "Panel-totalHiringTarget-row",
      "Panel-allocated-row",
      "Panel-left-row",
    ]);
    rows.forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      expect(cells).toHaveLength(2);
      expect(cells[0]).not.toHaveClass("text-end");
      expect(cells[1]).toHaveClass("text-end");
    });
    expect(
      rows.map((tr) =>
        [...tr.querySelectorAll("td")].map((td) => td.textContent),
      ),
    ).toEqual([
      ["Total number of ULAs expected to be hired:", "6"],
      ["Allocated so far:", "2"],
      ["ULA allocations left to assign:", "4"],
    ]);
  });
});
