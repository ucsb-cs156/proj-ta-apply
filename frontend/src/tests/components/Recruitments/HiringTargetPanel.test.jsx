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

function renderPanel(recruitment = taRecruitment, allocatedSoFar = 4) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <HiringTargetPanel
        recruitment={recruitment}
        allocatedSoFar={allocatedSoFar}
        testIdPrefix="Panel"
      />
    </QueryClientProvider>,
  );
}

const puts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/admin/recruitments/totalHiringTarget",
  );

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
    expect(screen.getByTestId("Panel")).toHaveClass("mb-3");
    // The space after the colon keeps the label off the box.
    expect(
      document.querySelector('label[for="Panel-totalHiringTarget"]')
        .textContent,
    ).toBe("Total number of TAs expected to be hired: ");
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
  });

  test("says ULAs for a ULA recruitment", () => {
    renderPanel(ulaRecruitment, 2);

    expect(
      screen.getByLabelText("Total number of ULAs expected to be hired:"),
    ).toHaveValue(6);
    expect(screen.getByTestId("Panel-left")).toHaveTextContent(
      "ULA allocations left to assign: 4",
    );
  });

  test("a recruitment without a target yet counts as expecting one", () => {
    const { totalHiringTarget: _omitted, ...legacy } = taRecruitment;
    renderPanel(legacy, 0);

    expect(screen.getByTestId("Panel-totalHiringTarget")).toHaveValue(1);
    expect(screen.getByTestId("Panel-left")).toHaveTextContent(
      "TA allocations left to assign: 1",
    );
  });

  test("the allocated and left counts add up to the target", () => {
    renderPanel(taRecruitment, 4);

    expect(screen.getByTestId("Panel-allocated")).toHaveTextContent(
      "Allocated so far: 4",
    );
    expect(screen.getByTestId("Panel-left")).toHaveTextContent(
      "TA allocations left to assign: 6",
    );
    expect(screen.queryByTestId("Panel-over")).not.toBeInTheDocument();
  });

  test("exactly allocated shows zero left and no warning", () => {
    renderPanel(taRecruitment, 10);

    expect(screen.getByTestId("Panel-left")).toHaveTextContent(
      "TA allocations left to assign: 0",
    );
    expect(screen.queryByTestId("Panel-over")).not.toBeInTheDocument();
  });

  test("over-allocation shows a negative number and the warning", () => {
    renderPanel(taRecruitment, 13);

    expect(screen.getByTestId("Panel-left")).toHaveTextContent(
      "TA allocations left to assign: -3",
    );
    const warning = screen.getByTestId("Panel-over");
    expect(warning).toHaveTextContent(
      "Please either increase the hiring target, or reduce the allocations for one or more courses.",
    );
    expect(warning).toHaveClass("text-danger");
  });

  test("a valid number is saved as soon as it is typed", async () => {
    renderPanel();
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
});
