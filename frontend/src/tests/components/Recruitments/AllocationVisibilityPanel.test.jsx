import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/api/admin/recruitments/allocationsVisibleToFaculty";
const RELEASE_ALL_URL = "/api/recruitmentcourses/allocationReleased/all";

const hidden = {
  ...recruitmentsFixtures.threeRecruitments[2],
  id: 7,
  allocationsVisibleToFaculty: false,
};
const shown = { ...hidden, allocationsVisibleToFaculty: true };

function renderPanel(recruitment, props = {}) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AllocationVisibilityPanel recruitment={recruitment} {...props} />
    </QueryClientProvider>,
  );
}

const puts = (url = URL) => axiosMock.history.put.filter((r) => r.url === url);

describe("AllocationVisibilityPanel tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut(URL).reply(200, {});
    axiosMock.onPut(RELEASE_ALL_URL).reply(200, []);
  });

  test("the panel has a heading, the release advice and both controls, with the default test id", () => {
    renderPanel(hidden);

    const panel = screen.getByTestId("AllocationVisibilityPanel");
    expect(panel).toHaveClass("mb-3");
    expect(
      screen.getByRole("heading", { level: 2, name: "Faculty visibility" }),
    ).toHaveClass("h5");
    expect(
      screen.getByTestId("AllocationVisibilityPanel-advice"),
    ).toHaveTextContent(
      "Release a course's allocation to its instructor when the number is mostly final; you can still change it afterwards.",
    );
    const releaseAll = screen.getByTestId(
      "AllocationVisibilityPanel-release-all",
    );
    expect(releaseAll).toHaveTextContent(
      "Release all allocations to their instructors",
    );
    expect(releaseAll).toHaveClass("btn-outline-primary", "btn-sm");
    const withdrawAll = screen.getByTestId(
      "AllocationVisibilityPanel-withdraw-all",
    );
    expect(withdrawAll).toHaveTextContent("Withdraw all");
    expect(withdrawAll).toHaveClass("btn-outline-secondary", "btn-sm");
    // The advice and the per-course buttons come before the global switch.
    expect(
      releaseAll.compareDocumentPosition(
        screen.getByTestId("AllocationVisibilityPanel-toggle"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("while all allocations are hidden it says so and offers to show them all", () => {
    renderPanel(hidden);

    expect(
      screen.getByTestId("AllocationVisibilityPanel-message"),
    ).toHaveTextContent(
      "All courses' allocations are hidden from faculty; each instructor sees only their own released courses.",
    );
    const button = screen.getByTestId("AllocationVisibilityPanel-toggle");
    expect(button).toHaveTextContent("Show All Allocations to All Faculty");
    expect(
      screen.getByRole("button", {
        name: "Show All Allocations to All Faculty",
      }),
    ).toBe(button);
    expect(button).toHaveClass("btn-outline-primary", "btn-sm");
  });

  test("a missing flag counts as hidden", () => {
    const { allocationsVisibleToFaculty, ...withoutFlag } = hidden;
    expect(allocationsVisibleToFaculty).toBe(false);
    renderPanel(withoutFlag, { testIdPrefix: "P" });

    expect(screen.getByTestId("P-message")).toHaveTextContent(
      "are hidden from faculty",
    );
    expect(screen.getByTestId("P-toggle")).toHaveTextContent(
      "Show All Allocations to All Faculty",
    );
  });

  test("while shown it says so and offers to hide", () => {
    renderPanel(shown, { testIdPrefix: "P" });

    expect(screen.getByTestId("P-message")).toHaveTextContent(
      "All courses' allocations are visible to every faculty member.",
    );
    const button = screen.getByTestId("P-toggle");
    expect(button).toHaveTextContent("Hide All Allocations");
    expect(button).toHaveClass("btn-outline-secondary", "btn-sm");
  });

  test("clicking Show sends visible=true for this recruitment and toasts", async () => {
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-toggle"));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ id: 7, visible: true });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "All allocations are now visible to every faculty member.",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test("clicking Hide sends visible=false and toasts", async () => {
    renderPanel(shown, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-toggle"));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ id: 7, visible: false });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "All allocations are now hidden; instructors see only their released courses.",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test("a failed save toasts the error and not the success message", async () => {
    axiosMock
      .onPut(URL)
      .reply(404, { message: "Recruitment with id 7 not found" });
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-toggle"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).not.toHaveBeenCalledWith(
      "All allocations are now visible to every faculty member.",
    );
  });

  // ---- issue #224: release or withdraw every course at once ----

  test("Release all sends released=true for this recruitment and toasts", async () => {
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-release-all"));

    await waitFor(() => expect(puts(RELEASE_ALL_URL)).toHaveLength(1));
    expect(puts(RELEASE_ALL_URL)[0].params).toEqual({
      recruitmentId: 7,
      released: true,
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Every course's allocation is now released to its instructor.",
      ),
    );
    expect(puts()).toHaveLength(0);
  });

  test("Withdraw all sends released=false and toasts", async () => {
    renderPanel(shown, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-withdraw-all"));

    await waitFor(() => expect(puts(RELEASE_ALL_URL)).toHaveLength(1));
    expect(puts(RELEASE_ALL_URL)[0].params).toEqual({
      recruitmentId: 7,
      released: false,
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Every course's allocation is now withdrawn from its instructor.",
      ),
    );
  });

  test("both release buttons are disabled while a release is saving", async () => {
    let release;
    axiosMock
      .onPut(RELEASE_ALL_URL)
      .reply(
        () => new Promise((resolve) => (release = () => resolve([200, []]))),
      );
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-release-all"));

    await waitFor(() =>
      expect(screen.getByTestId("P-release-all")).toBeDisabled(),
    );
    expect(screen.getByTestId("P-withdraw-all")).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByTestId("P-release-all")).not.toBeDisabled(),
    );
    expect(screen.getByTestId("P-withdraw-all")).not.toBeDisabled();
  });

  test("a failed release toasts the error only", async () => {
    axiosMock
      .onPut(RELEASE_ALL_URL)
      .reply(404, { message: "Recruitment with id 7 not found" });
    renderPanel(hidden, { testIdPrefix: "P" });

    await userEvent.click(screen.getByTestId("P-withdraw-all"));

    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast).not.toHaveBeenCalledWith(
      "Every course's allocation is now withdrawn from its instructor.",
    );
  });
});
