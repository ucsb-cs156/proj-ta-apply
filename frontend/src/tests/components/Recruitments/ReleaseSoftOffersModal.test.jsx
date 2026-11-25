import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ReleaseSoftOffersModal from "main/components/Recruitments/ReleaseSoftOffersModal";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferNoticeFixtures from "fixtures/softOfferNoticeFixtures";
import { STEPS_QUERY_KEY } from "main/utils/recruitmentSteps";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);
const URL = "/api/admin/recruitments/softOffers";
const NOTICES = "/api/softOfferNotices/current";
const ula = recruitmentsFixtures.publishedUla;

function renderModal(props = {}) {
  const onHide = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <ReleaseSoftOffersModal
        recruitment={ula}
        show
        onHide={onHide}
        testIdPrefix="R"
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onHide, invalidateQueriesSpy };
}

describe("ReleaseSoftOffersModal tests (issue #485)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(NOTICES).reply(200, [softOfferNoticeFixtures.v2]);
    // 6:30 pm on Nov 24, 2026 in California.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-25T02:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("explains, proposes 5 pm five days from today, and has no warnings when all is in order", async () => {
    renderModal();

    expect(screen.getByTestId("R-modal")).toBeInTheDocument();
    expect(
      screen.getByText("Release Soft Offers: F25 ULA", {
        selector: ".modal-title",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("R-explanation")).toHaveTextContent(
      'Clicking "Release Soft Offers" will make soft offers available to students when they log in to the portal, and begin collecting their decisions. Please choose a date/time as a deadline for soft offers. More about this action',
    );
    const help = screen.getByTestId("R-help");
    expect(help).toHaveAttribute("href", "/help/admins#soft-offers");
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noreferrer");
    const input = screen.getByLabelText("Soft offer deadline");
    expect(input).toBe(screen.getByTestId("R-deadline-input"));
    expect(input.id).toBe("R-deadline");
    expect(input).toHaveAttribute("type", "datetime-local");
    expect(input).toHaveValue("2026-11-29T17:00");
    expect(screen.getByTestId("R-confirm")).toHaveTextContent(
      "Release Soft Offers",
    );
    expect(screen.getByTestId("R-confirm")).toHaveClass("btn-warning");
    expect(screen.getByTestId("R-cancel")).toHaveTextContent("Cancel");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === NOTICES),
      ).toHaveLength(1),
    );
    expect(screen.queryByTestId("R-warning-notice")).toBeNull();
    expect(screen.queryByTestId("R-warning-tentative")).toBeNull();
    expect(screen.queryByTestId("R-refusal")).toBeNull();
  });

  test("warns in red when no Soft Offer Notices text has been saved", async () => {
    axiosMock.onGet(NOTICES).reply(200, []);
    renderModal();

    const warning = await screen.findByTestId("R-warning-notice");
    expect(warning).toHaveTextContent(
      "No Soft Offer Notices text has been saved (Admin → ULA App Settings), so students will see the course details and the question but no notice text.",
    );
    expect(warning).toHaveClass("text-danger", "fw-bold");
    expect(warning).toHaveAttribute("role", "alert");
    expect(screen.queryByTestId("R-warning-tentative")).toBeNull();
  });

  test("no notice warning while the notices have not loaded or come back malformed", async () => {
    axiosMock.onGet(NOTICES).reply(200, { nope: true });
    renderModal();

    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === NOTICES),
      ).toHaveLength(1),
    );
    expect(screen.queryByTestId("R-warning-notice")).toBeNull();
  });

  test.each([
    ["applications are open", { applicationStatus: "OPEN" }],
    ["faculty ranking is open", { reviewStatus: "Open" }],
  ])("warns that hiring decisions are tentative when %s", (_name, change) => {
    renderModal({ recruitment: { ...ula, ...change } });

    const warning = screen.getByTestId("R-warning-tentative");
    expect(warning).toHaveTextContent(
      "Hiring decisions are tentative: applications or faculty ranking have been reopened.",
    );
    expect(warning).toHaveClass("text-danger");
  });

  test("Cancel and the close button hide it without releasing", async () => {
    const { onHide } = renderModal();

    await userEvent.click(screen.getByTestId("R-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByLabelText("Close"));
    expect(onHide).toHaveBeenCalledTimes(2);
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("a deadline that is not in the future is refused in the modal and nothing is sent", async () => {
    renderModal();
    const input = screen.getByTestId("R-deadline-input");

    fireEvent.change(input, { target: { value: "2026-11-24T18:30" } });
    await userEvent.click(screen.getByTestId("R-confirm"));

    expect(screen.getByTestId("R-deadline-error")).toHaveTextContent(
      "Enter a deadline in the future.",
    );
    expect(input).toHaveClass("is-invalid");
    expect(axiosMock.history.put).toHaveLength(0);

    // Typing again clears the message.
    fireEvent.change(input, { target: { value: "2026-11-24T18:31" } });
    expect(screen.getByTestId("R-deadline-error")).toHaveTextContent("");
    expect(input).not.toHaveClass("is-invalid");
  });

  test("Release Soft Offers puts the id and the deadline, toasts, re-reads the recruitments and steps, and hides", async () => {
    axiosMock.onPut(URL).reply(200, recruitmentsFixtures.releasedUla);
    const { onHide, invalidateQueriesSpy } = renderModal();

    fireEvent.change(screen.getByTestId("R-deadline-input"), {
      target: { value: "2026-12-01T12:15" },
    });
    await userEvent.click(screen.getByTestId("R-confirm"));

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(URL);
    expect(axiosMock.history.put[0].params).toEqual({
      id: 5,
      deadline: "2026-12-01T12:15",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Soft offers released."),
    );
    expect(onHide).toHaveBeenCalledTimes(1);
    for (const key of [
      "/api/admin/recruitments/all",
      STEPS_QUERY_KEY,
      "/api/recruitments/applicable",
    ]) {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: [key] });
    }
    expect(screen.queryByTestId("R-refusal")).toBeNull();
  });

  test("the default deadline is sent when it is left as proposed", async () => {
    axiosMock.onPut(URL).reply(200, recruitmentsFixtures.releasedUla);
    renderModal();

    await userEvent.click(screen.getByTestId("R-confirm"));

    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].params).toEqual({
      id: 5,
      deadline: "2026-11-29T17:00",
    });
  });

  test("a refusal from the backend stays in the modal, and the next try clears it while it is under way", async () => {
    let release;
    axiosMock
      .onPut(URL)
      .replyOnce(400, {
        message: "Release hiring decisions before releasing soft offers.",
      })
      .onPut(URL)
      .reply(
        () =>
          new Promise((resolve) => {
            release = () => resolve([200, recruitmentsFixtures.releasedUla]);
          }),
      );
    const { onHide } = renderModal();

    await userEvent.click(screen.getByTestId("R-confirm"));

    expect(await screen.findByTestId("R-refusal")).toHaveTextContent(
      "Release hiring decisions before releasing soft offers.",
    );
    expect(screen.getByTestId("R-refusal")).toHaveClass("alert-danger");
    expect(onHide).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalledWith("Soft offers released.");

    // The next try drops the old refusal at once, before the answer comes.
    await userEvent.click(screen.getByTestId("R-confirm"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(2));
    expect(screen.queryByTestId("R-refusal")).toBeNull();
    release();
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
  });

  test("the button is disabled while the release is pending", async () => {
    let release;
    axiosMock.onPut(URL).reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, recruitmentsFixtures.releasedUla]);
        }),
    );
    renderModal();

    await userEvent.click(screen.getByTestId("R-confirm"));
    await waitFor(() => expect(screen.getByTestId("R-confirm")).toBeDisabled());
    release();
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
  });

  test("uses ReleaseSoftOffersModal as the default test id prefix", () => {
    renderModal({ testIdPrefix: undefined });
    expect(
      screen.getByTestId("ReleaseSoftOffersModal-modal"),
    ).toBeInTheDocument();
  });
});
