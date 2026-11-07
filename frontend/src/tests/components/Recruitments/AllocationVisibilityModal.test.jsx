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

  test("offers two states as radio buttons, each a sentence, and the note (issue #366)", () => {
    renderModal();

    expect(screen.getByText("Allocation Visibility")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Who may see the allocations of this recruitment's courses?",
      ),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toBe(screen.getByTestId("M-ADMINS_ONLY"));
    expect(radios[1]).toBe(screen.getByTestId("M-OWN_COURSES"));
    expect(
      screen.getByTestId("M-ADMINS_ONLY").closest("div"),
    ).toHaveTextContent("Admins only. No faculty member sees any allocation.");
    expect(
      screen.getByLabelText(
        "Admins only. No faculty member sees any allocation.",
      ),
    ).toBe(screen.getByTestId("M-ADMINS_ONLY"));
    expect(
      screen.getByLabelText(
        "Each faculty member sees the allocations only for the courses they teach.",
      ),
    ).toBe(screen.getByTestId("M-OWN_COURSES"));
    expect(screen.getByTestId("M-note")).toHaveTextContent(
      "You can still change allocations afterwards; faculty see changes immediately.",
    );
    expect(screen.getByTestId("M-cancel")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("M-save")).toHaveTextContent("Save");
  });

  test("the third backend state, all courses, is nowhere in the dialog (issue #366)", () => {
    renderModal();
    expect(screen.queryByTestId("M-ALL_COURSES")).toBeNull();
    expect(screen.queryByText(/all courses/i)).toBeNull();
    expect(screen.queryByText(/all its courses/i)).toBeNull();
    expect(screen.queryByText(/Faculty see their own courses/)).toBeNull();
    expect(
      screen.queryByText(/This is what Release Allocations to Faculty means/),
    ).toBeNull();
    expect(screen.getByTestId("M").querySelector("strong")).toBeNull();
  });

  test.each([
    ["ADMINS_ONLY", "OWN_COURSES"],
    ["OWN_COURSES", "ADMINS_ONLY"],
  ])("starts on the recruitment's current state, %s", (current, other) => {
    renderModal({ ...base, allocationVisibility: current });
    expect(screen.getByTestId(`M-${current}`)).toBeChecked();
    expect(screen.getByTestId(`M-${other}`)).not.toBeChecked();
  });

  test("a recruitment with no setting yet starts on admins only", () => {
    const { allocationVisibility: _omitted, ...without } = base;
    renderModal(without);
    expect(screen.getByTestId("M-ADMINS_ONLY")).toBeChecked();
    expect(screen.getByTestId("M-OWN_COURSES")).not.toBeChecked();
  });

  test("the radios form one group", () => {
    renderModal();
    ["ADMINS_ONLY", "OWN_COURSES"].forEach((value) => {
      const radio = screen.getByTestId(`M-${value}`);
      expect(radio).toHaveAttribute("id", `M-${value}`);
      expect(radio).toHaveAttribute("name", "M-visibility");
      expect(radio).toHaveAttribute("type", "radio");
    });
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

    await userEvent.click(screen.getByTestId("M-ADMINS_ONLY"));
    expect(screen.getByTestId("M-ADMINS_ONLY")).toBeChecked();
    rerender(element(false));
    await waitFor(() => expect(screen.queryByTestId("M")).toBeNull());
    rerender(element(true));

    expect(await screen.findByTestId("M-OWN_COURSES")).toBeChecked();
    expect(screen.getByTestId("M-ADMINS_ONLY")).not.toBeChecked();
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
    ["ADMINS_ONLY", "Admins only"],
  ])(
    "choosing %s and saving sends the PUT, toasts, re-reads and closes",
    async (choice, name) => {
      const start = choice === "ADMINS_ONLY" ? "OWN_COURSES" : "ADMINS_ONLY";
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
      // Issue #250: what faculty see on the home page changes with the visibility.
      for (const key of [
        "/api/instructor/recruitments",
        "/api/recruitments/applicable",
        "/api/applications/mine",
      ]) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] });
      }
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

    await userEvent.click(screen.getByTestId("M-OWN_COURSES"));
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
