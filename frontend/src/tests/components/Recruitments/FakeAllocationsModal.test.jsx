import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FakeAllocationsModal from "main/components/Recruitments/FakeAllocationsModal";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderModal(courseCount = 4, onHide = vi.fn()) {
  return renderModalFor([{ recruitmentId: 7, courseCount }], onHide);
}

/** Issue #358: the Combined Allocation page's modal fakes several recruitments at once. */
function renderModalFor(recruitments, onHide = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <FakeAllocationsModal
        recruitments={recruitments}
        onHide={onHide}
        testIdPrefix="Fake"
      />
    </QueryClientProvider>,
  );
  return { onHide, invalidate };
}

const BOTH = [
  { recruitmentId: 5, courseCount: 4, type: "TA" },
  { recruitmentId: 6, courseCount: 2, type: "ULA" },
];

const posts = () =>
  axiosMock.history.post.filter(
    (r) => r.url === "/api/admin/developer/fakeAllocations",
  );

describe("FakeAllocationsModal tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPost("/api/admin/developer/fakeAllocations").reply(200, []);
  });

  test("opens with one position per course, the maximum enrollment, and the visibility box ticked", () => {
    renderModal(4);

    expect(
      screen.getByText("Fake Hiring Targets and Allocations", {
        selector: ".modal-title",
      }),
    ).toBeInTheDocument();
    const target = screen.getByLabelText("Hiring target");
    expect(target).toBe(screen.getByTestId("Fake-target-7"));
    expect(target).toHaveValue(4);
    expect(target).toHaveAttribute("min", "1");
    expect(target).toHaveAttribute("max", "12");
    expect(target).toHaveAttribute("step", "1");
    expect(target.style.width).toBe("7em");
    expect(target).not.toHaveClass("is-invalid");
    expect(
      screen.getByLabelText("Use the schedule's maximum enrollment"),
    ).toBeChecked();
    expect(screen.getByLabelText("Use current enrollment")).not.toBeChecked();
    expect(
      screen.getByLabelText("Keep the estimates already entered"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText(
        "Let each faculty member see the allocations for their own courses",
      ),
    ).toBeChecked();
    // Ids, names and test ids the radios and the checkbox are found by.
    expect(screen.getByTestId("Fake-estimates")).toContainElement(
      screen.getByTestId("Fake-estimates-MAX"),
    );
    for (const value of ["MAX", "ACTUAL", "KEEP"]) {
      const radio = screen.getByTestId(`Fake-estimates-${value}`);
      expect(radio).toHaveAttribute("name", "Fake-estimates");
      expect(radio).toHaveAttribute("id", `Fake-estimates-${value}`);
    }
    expect(screen.getByTestId("Fake-visibility")).toBe(
      screen.getByLabelText(
        "Let each faculty member see the allocations for their own courses",
      ),
    );
    expect(screen.getByTestId("Fake-fake")).toHaveTextContent(
      "Fake Targets and Allocations",
    );
    expect(screen.getByTestId("Fake-fake")).not.toBeDisabled();
    expect(screen.getByTestId("Fake-cancel")).toHaveTextContent("Cancel");
  });

  test("the default target is at least one even with no courses, and then nothing can be faked", () => {
    renderModal(0);

    expect(screen.getByTestId("Fake-target-7")).toHaveValue(1);
    expect(screen.getByTestId("Fake-target-7")).toHaveClass("is-invalid");
    expect(screen.getByTestId("Fake-fake")).toBeDisabled();
  });

  test("a target outside one to three per course is flagged and cannot be sent", async () => {
    renderModal(4);
    const target = screen.getByTestId("Fake-target-7");

    await userEvent.clear(target);
    await userEvent.type(target, "13");
    expect(target).toHaveClass("is-invalid");
    expect(
      screen.getByText("Enter a whole number from 1 to 12 (three per course)."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Fake-fake")).toBeDisabled();

    await userEvent.clear(target);
    await userEvent.type(target, "12");
    expect(target).not.toHaveClass("is-invalid");
    expect(screen.getByTestId("Fake-fake")).not.toBeDisabled();

    await userEvent.clear(target);
    expect(target).toHaveClass("is-invalid");
    expect(screen.getByTestId("Fake-fake")).toBeDisabled();
    expect(posts()).toHaveLength(0);
  });

  test("Fake Targets and Allocations posts the defaults, toasts, refetches and closes", async () => {
    const { onHide, invalidate } = renderModal(4);

    await userEvent.click(screen.getByTestId("Fake-fake"));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].params).toEqual({
      recruitmentId: 7,
      hiringTarget: 4,
      estimates: "MAX",
      setVisibility: true,
    });
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      "Faked a hiring target of 4 and allocated it across the courses.",
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/recruitmentcourses/all"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/admin/recruitments/all"],
    });
    // Issue #358: the budget summary carries the hiring targets.
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["/api/admin/budget"],
    });
  });

  test("two recruitments get a box each, named by type and sized to its own courses (issue #358)", async () => {
    renderModalFor(BOTH);

    const ta = screen.getByLabelText("TA hiring target");
    const ula = screen.getByLabelText("ULA hiring target");
    expect(ta).toBe(screen.getByTestId("Fake-target-5"));
    expect(ula).toBe(screen.getByTestId("Fake-target-6"));
    expect(ta).toHaveValue(4);
    expect(ta).toHaveAttribute("max", "12");
    expect(ula).toHaveValue(2);
    expect(ula).toHaveAttribute("max", "6");
    expect(screen.queryByLabelText("Hiring target")).toBeNull();

    // Each box is judged against its own recruitment's courses.
    await userEvent.clear(ula);
    await userEvent.type(ula, "7");
    expect(ula).toHaveClass("is-invalid");
    expect(ta).not.toHaveClass("is-invalid");
    expect(
      screen.getByText("Enter a whole number from 1 to 6 (three per course)."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Fake-fake")).toBeDisabled();
    await userEvent.clear(ula);
    await userEvent.type(ula, "6");
    expect(ula).not.toHaveClass("is-invalid");
    expect(screen.getByTestId("Fake-fake")).toBeEnabled();
  });

  test("one click posts once per recruitment, each with its own target, and says what was faked (issue #358)", async () => {
    const { onHide } = renderModalFor(BOTH);

    await userEvent.clear(screen.getByTestId("Fake-target-5"));
    await userEvent.type(screen.getByTestId("Fake-target-5"), "9");
    await userEvent.click(screen.getByLabelText("Use current enrollment"));
    await userEvent.click(screen.getByTestId("Fake-fake"));

    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts().map((r) => r.params)).toEqual([
      {
        recruitmentId: 5,
        hiringTarget: 9,
        estimates: "ACTUAL",
        setVisibility: true,
      },
      {
        recruitmentId: 6,
        hiringTarget: 2,
        estimates: "ACTUAL",
        setVisibility: true,
      },
    ]);
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
    expect(mockToast).toHaveBeenCalledWith(
      "Faked hiring targets of 9 (TA) and 2 (ULA) and allocated them across the courses.",
    );
  });

  test("a refusal for one recruitment is reported once and the modal stays open (issue #358)", async () => {
    axiosMock
      .onPost("/api/admin/developer/fakeAllocations")
      .reply((config) =>
        config.params.recruitmentId === 6
          ? [400, { message: "Developer mode is off" }]
          : [200, []],
      );
    const { onHide } = renderModalFor(BOTH);

    await userEvent.click(screen.getByTestId("Fake-fake"));

    await waitFor(() => expect(posts()).toHaveLength(2));
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast.mock.calls[0][0]).toBe(
      "Could not fake the allocations: Developer mode is off",
    );
    expect(onHide).not.toHaveBeenCalled();
  });

  test("the chosen target, estimate source and visibility are what is sent", async () => {
    renderModal(4);

    await userEvent.clear(screen.getByTestId("Fake-target-7"));
    await userEvent.type(screen.getByTestId("Fake-target-7"), "9");
    await userEvent.click(screen.getByLabelText("Use current enrollment"));
    expect(screen.getByLabelText("Use current enrollment")).toBeChecked();
    expect(
      screen.getByLabelText("Use the schedule's maximum enrollment"),
    ).not.toBeChecked();
    await userEvent.click(
      screen.getByLabelText(
        "Let each faculty member see the allocations for their own courses",
      ),
    );
    await userEvent.click(screen.getByTestId("Fake-fake"));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].params).toEqual({
      recruitmentId: 7,
      hiringTarget: 9,
      estimates: "ACTUAL",
      setVisibility: false,
    });

    await userEvent.click(
      screen.getByLabelText("Keep the estimates already entered"),
    );
    await userEvent.click(screen.getByTestId("Fake-fake"));
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()[1].params.estimates).toBe("KEEP");
  });

  test("a refusal is toasted with the backend's reason and the modal stays open", async () => {
    axiosMock
      .onPost("/api/admin/developer/fakeAllocations")
      .reply(400, { message: "hiringTarget must be between 1 and 12" });
    const { onHide, invalidate } = renderModal(4);

    await userEvent.click(screen.getByTestId("Fake-fake"));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toBe(
      "Could not fake the allocations: hiringTarget must be between 1 and 12",
    );
    expect(onHide).not.toHaveBeenCalled();
    // Whatever was done before the refusal is on the page now.
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(screen.getByTestId("Fake-fake")).not.toBeDisabled();
  });

  test("Cancel and the close control send nothing", async () => {
    const { onHide } = renderModal(4);

    await userEvent.click(screen.getByTestId("Fake-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onHide).toHaveBeenCalledTimes(2);
    expect(posts()).toHaveLength(0);
  });

  test("has a default test id prefix", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FakeAllocationsModal
          recruitments={[{ recruitmentId: 7, courseCount: 2 }]}
          onHide={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId("FakeAllocationsModal-modal"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("FakeAllocationsModal-target-7")).toHaveValue(2);
  });
});
