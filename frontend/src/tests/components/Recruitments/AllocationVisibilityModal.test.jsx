import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AllocationVisibilityModal from "main/components/Recruitments/AllocationVisibilityModal";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/api/admin/recruitments/allocationVisibility";

const base = { ...recruitmentsFixtures.threeRecruitments[2], id: 7 };

function renderModal(recruitment = base, props = {}) {
  const onHide = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <AllocationVisibilityModal
        recruitment={recruitment}
        show={true}
        onHide={onHide}
        testIdPrefix="M"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onHide, invalidate };
}

const puts = () => axiosMock.history.put.filter((r) => r.url === URL);

describe("AllocationVisibilityModal tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut(URL).reply(200, {});
  });

  test("offers the three states as radio buttons, each with its explanation, and the note", () => {
    renderModal();

    expect(screen.getByText("Allocation Visibility")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Who may see the allocations of this recruitment's courses?",
      ),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(
      screen.getByTestId("M-ADMINS_ONLY").closest("div"),
    ).toHaveTextContent("Admins only. No faculty member sees any allocation.");
    expect(
      screen.getByTestId("M-OWN_COURSES").closest("div"),
    ).toHaveTextContent(
      "Faculty see their own courses. Each faculty member sees the allocations for the courses they teach. This is what Release Allocations to Faculty means.",
    );
    expect(
      screen.getByTestId("M-ALL_COURSES").closest("div"),
    ).toHaveTextContent(
      "Faculty see all courses. Every faculty member teaching in this recruitment sees the allocations of all its courses.",
    );
    expect(screen.getByTestId("M-note")).toHaveTextContent(
      "You can still change allocations afterwards; faculty see changes immediately.",
    );
    expect(screen.getByTestId("M-cancel")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("M-save")).toHaveTextContent("Save");
  });

  test("starts on the recruitment's current state", () => {
    renderModal({ ...base, allocationVisibility: "OWN_COURSES" });
    expect(screen.getByTestId("M-ADMINS_ONLY")).not.toBeChecked();
    expect(screen.getByTestId("M-OWN_COURSES")).toBeChecked();
    expect(screen.getByTestId("M-ALL_COURSES")).not.toBeChecked();
  });

  test("a recruitment with no setting yet starts on admins only", () => {
    const { allocationVisibility: _omitted, ...without } = base;
    renderModal(without);
    expect(screen.getByTestId("M-ADMINS_ONLY")).toBeChecked();
  });

  test("the radios form one group and each is labelled by its own explanation", () => {
    renderModal();
    ["ADMINS_ONLY", "OWN_COURSES", "ALL_COURSES"].forEach((value) => {
      const radio = screen.getByTestId(`M-${value}`);
      expect(radio).toHaveAttribute("id", `M-${value}`);
      expect(radio).toHaveAttribute("name", "M-visibility");
      expect(radio).toHaveAttribute("type", "radio");
    });
    expect(screen.getByLabelText(/^Faculty see all courses\./)).toBe(
      screen.getByTestId("M-ALL_COURSES"),
    );
  });

  test("reopening the modal starts again from the saved state, not from an abandoned choice", async () => {
    const client = new QueryClient();
    const element = (show) => (
      <QueryClientProvider client={client}>
        <AllocationVisibilityModal
          recruitment={{ ...base, allocationVisibility: "OWN_COURSES" }}
          show={show}
          onHide={() => {}}
          testIdPrefix="M"
        />
      </QueryClientProvider>
    );
    const { rerender } = render(element(true));

    await userEvent.click(screen.getByTestId("M-ALL_COURSES"));
    expect(screen.getByTestId("M-ALL_COURSES")).toBeChecked();
    rerender(element(false));
    await waitFor(() => expect(screen.queryByTestId("M")).toBeNull());
    rerender(element(true));

    expect(await screen.findByTestId("M-OWN_COURSES")).toBeChecked();
    expect(screen.getByTestId("M-ALL_COURSES")).not.toBeChecked();
  });

  test("has a default test id prefix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AllocationVisibilityModal
          recruitment={base}
          show={true}
          onHide={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("AllocationVisibilityModal")).toBeInTheDocument();
    expect(
      screen.getByTestId("AllocationVisibilityModal-save"),
    ).toBeInTheDocument();
  });

  test.each([
    ["OWN_COURSES", "Faculty see their own courses"],
    ["ALL_COURSES", "Faculty see all courses"],
    ["ADMINS_ONLY", "Admins only"],
  ])(
    "choosing %s and saving sends the PUT, toasts, re-reads and closes",
    async (choice, name) => {
      const start = choice === "ADMINS_ONLY" ? "ALL_COURSES" : "ADMINS_ONLY";
      const { onHide, invalidate } = renderModal({
        ...base,
        allocationVisibility: start,
      });

      await userEvent.click(screen.getByTestId(`M-${choice}`));
      expect(screen.getByTestId(`M-${choice}`)).toBeChecked();
      await userEvent.click(screen.getByTestId("M-save"));

      await waitFor(() => expect(puts()).toHaveLength(1));
      expect(puts()[0].method).toBe("put");
      expect(puts()[0].params).toEqual({ id: 7, visibility: choice });
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          `Allocation visibility is now: ${name}.`,
        ),
      );
      await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["/api/admin/recruitments/all"],
      });
    },
  );

  test("Save without changing the choice sends the current state", async () => {
    renderModal({ ...base, allocationVisibility: "OWN_COURSES" });
    await userEvent.click(screen.getByTestId("M-save"));
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ id: 7, visibility: "OWN_COURSES" });
  });

  test("Cancel and the close control send nothing and close", async () => {
    const { onHide } = renderModal();

    await userEvent.click(screen.getByTestId("M-ALL_COURSES"));
    await userEvent.click(screen.getByTestId("M-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onHide).toHaveBeenCalledTimes(2);
    expect(puts()).toHaveLength(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("Save is disabled while the request is pending, and a refused request keeps the modal open", async () => {
    let release;
    axiosMock.onPut(URL).reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([400, { message: "no" }]);
        }),
    );
    const { onHide } = renderModal();

    await userEvent.click(screen.getByTestId("M-OWN_COURSES"));
    await userEvent.click(screen.getByTestId("M-save"));
    await waitFor(() => expect(screen.getByTestId("M-save")).toBeDisabled());
    release();
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/400/);
    expect(screen.getByTestId("M-save")).not.toBeDisabled();
    expect(onHide).not.toHaveBeenCalled();
  });
});
