import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ChangeSoftOfferDeadlineModal from "main/components/Recruitments/ChangeSoftOfferDeadlineModal";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/api/admin/recruitments/softOffers";
const released = recruitmentsFixtures.releasedUla;

function renderModal(props = {}) {
  const onHide = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <ChangeSoftOfferDeadlineModal
        recruitment={released}
        show
        onHide={onHide}
        testIdPrefix="D"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onHide, invalidateQueriesSpy };
}

describe("ChangeSoftOfferDeadlineModal tests (issue #487)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 6:30 pm on Nov 24, 2026 in California.
    vi.setSystemTime(new Date("2026-11-25T02:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("opens on the current deadline, with the explanation and Save Deadline", () => {
    renderModal();

    expect(screen.getByTestId("D-modal")).toBeInTheDocument();
    expect(
      screen.getByText("Change Deadline", { selector: ".modal-title" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("D-explanation")).toHaveTextContent(
      "Applicants are asked to answer their soft offer by this deadline; answers given after it are still accepted and marked late. The change is recorded in the recruitment's change history.",
    );
    const input = screen.getByLabelText("Soft offer deadline");
    expect(input).toBe(screen.getByTestId("D-deadline-input"));
    expect(input.id).toBe("D-deadline");
    expect(input).toHaveAttribute("type", "datetime-local");
    expect(input).toHaveValue("2025-10-25T17:00");
    expect(screen.getByTestId("D-confirm")).toHaveTextContent("Save Deadline");
    expect(screen.getByTestId("D-cancel")).toHaveTextContent("Cancel");
    expect(screen.queryByTestId("D-refusal")).toBeNull();
  });

  test("with no deadline on file the box starts empty", () => {
    renderModal({ recruitment: { ...released, softOfferDeadline: null } });
    expect(screen.getByTestId("D-deadline-input")).toHaveValue("");
  });

  test("Cancel hides it without saving", async () => {
    const { onHide } = renderModal();
    await userEvent.click(screen.getByTestId("D-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("a deadline that is not in the future is refused in the modal", async () => {
    renderModal();
    const input = screen.getByTestId("D-deadline-input");

    // The stored deadline (2025) is in the past as the clock stands.
    await userEvent.click(screen.getByTestId("D-confirm"));

    expect(screen.getByTestId("D-deadline-error")).toHaveTextContent(
      "Enter a deadline in the future.",
    );
    expect(input).toHaveClass("is-invalid");
    expect(axiosMock.history.put).toHaveLength(0);
    fireEvent.change(input, { target: { value: "2026-12-01T17:00" } });
    expect(screen.getByTestId("D-deadline-error")).toHaveTextContent("");
    expect(input).not.toHaveClass("is-invalid");
  });

  test("Save Deadline puts the id and the deadline, toasts, re-reads the recruitments and results, and hides", async () => {
    axiosMock.onPut(URL).reply(200, released);
    const { onHide, invalidateQueriesSpy } = renderModal();

    fireEvent.change(screen.getByTestId("D-deadline-input"), {
      target: { value: "2026-12-01T12:15" },
    });
    await userEvent.click(screen.getByTestId("D-confirm"));

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(URL);
    expect(axiosMock.history.put[0].params).toEqual({
      id: 5,
      deadline: "2026-12-01T12:15",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Soft offer deadline changed."),
    );
    expect(onHide).toHaveBeenCalledTimes(1);
    for (const key of [
      "/api/admin/recruitments/all",
      "/api/admin/softOffers",
    ]) {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [key] });
    }
  });

  test("a refusal stays in the modal, and the next try clears it while under way", async () => {
    let release;
    axiosMock
      .onPut(URL)
      .replyOnce(400, { message: "Soft offers are a ULA feature." })
      .onPut(URL)
      .reply(
        () =>
          new Promise((resolve) => {
            release = () => resolve([200, released]);
          }),
      );
    const { onHide } = renderModal();
    fireEvent.change(screen.getByTestId("D-deadline-input"), {
      target: { value: "2026-12-01T12:15" },
    });

    await userEvent.click(screen.getByTestId("D-confirm"));
    expect(await screen.findByTestId("D-refusal")).toHaveTextContent(
      "Soft offers are a ULA feature.",
    );
    expect(screen.getByTestId("D-refusal")).toHaveClass("alert-danger");
    expect(onHide).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("D-confirm"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(2));
    expect(screen.queryByTestId("D-refusal")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("D-confirm")).toBeDisabled());
    release();
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
  });

  test("uses ChangeSoftOfferDeadlineModal as the default test id prefix", () => {
    renderModal({ testIdPrefix: undefined });
    expect(
      screen.getByTestId("ChangeSoftOfferDeadlineModal-modal"),
    ).toBeInTheDocument();
  });
});
