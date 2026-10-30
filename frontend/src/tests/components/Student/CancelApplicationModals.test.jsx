import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import CancelApplicationModals, {
  REASON_PROMPT,
} from "main/components/Student/CancelApplicationModals";

function renderModals({ show = true } = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <CancelApplicationModals
      show={show}
      recruitmentName="TA positions, W26"
      onConfirm={onConfirm}
      onClose={onClose}
      testIdPrefix="C"
    />,
  );
  return { onConfirm, onClose };
}

describe("CancelApplicationModals tests", () => {
  test("starts with the are-you-sure step, naming the recruitment", () => {
    renderModals();

    expect(screen.getByTestId("C-step1")).toHaveTextContent(
      "Cancel my application: TA positions, W26",
    );
    expect(screen.getByTestId("C-step1-body")).toHaveTextContent(
      "Are you sure? This cannot be undone.",
    );
    expect(screen.getByTestId("C-step1-no")).toHaveTextContent(
      "No, do not cancel my application",
    );
    expect(screen.getByTestId("C-step1-yes")).toHaveTextContent("Yes, Cancel");
    expect(screen.queryByTestId("C-step2")).toBeNull();
    expect(document.querySelector(".modal-dialog")).toHaveClass(
      "modal-dialog-centered",
    );
  });

  test("No on the first step closes without confirming", async () => {
    const { onConfirm, onClose } = renderModals();

    await userEvent.click(screen.getByTestId("C-step1-no"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("Yes, Cancel leads to the reason step, which needs a reason before confirming", async () => {
    const { onConfirm, onClose } = renderModals();

    await userEvent.click(screen.getByTestId("C-step1-yes"));

    await waitFor(() => expect(screen.queryByTestId("C-step1")).toBeNull());
    expect(screen.getByTestId("C-step2")).toHaveTextContent(
      "Cancel my application: TA positions, W26",
    );
    expect(screen.getByTestId("C-step2-body")).toHaveTextContent(REASON_PROMPT);
    expect(REASON_PROMPT).toBe(
      'Your application is not cancelled yet. Please provide a brief explanation of your reason for cancelling your application (e.g. "found other employment", "taking a quarter off from school", etc.) and press "Yes, Cancel my Application".',
    );
    expect(screen.getByTestId("C-step2-no")).toHaveTextContent(
      "No, don't cancel my application",
    );
    const yes = screen.getByTestId("C-step2-yes");
    expect(yes).toHaveTextContent("Yes, Cancel my Application");
    expect(yes).toBeDisabled();
    expect(screen.getByLabelText("Reason for cancelling")).toBe(
      screen.getByTestId("C-reason"),
    );
    expect(
      screen
        .getByTestId("C-step2")
        .closest(".modal")
        .querySelector(".modal-dialog") ?? screen.getByTestId("C-step2"),
    ).toHaveClass("modal-dialog-centered");

    // Spaces alone are no reason.
    await userEvent.type(screen.getByTestId("C-reason"), "   ");
    expect(yes).toBeDisabled();
    await userEvent.type(
      screen.getByTestId("C-reason"),
      "Found other employment ",
    );
    expect(yes).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(yes);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("Found other employment");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("No on the second step closes without confirming", async () => {
    const { onConfirm, onClose } = renderModals();

    await userEvent.click(screen.getByTestId("C-step1-yes"));
    await userEvent.click(await screen.findByTestId("C-step2-no"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test("the close cross on either step closes", async () => {
    const { onClose } = renderModals();

    await userEvent.click(
      within(screen.getByTestId("C-step1")).getByLabelText("Close"),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByTestId("C-step1-yes"));
    // The first modal may still be fading out, so look inside the second.
    await userEvent.click(
      within(await screen.findByTestId("C-step2")).getByLabelText("Close"),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("shows nothing when not shown, and uses the default prefix", () => {
    renderModals({ show: false });
    expect(screen.queryByTestId("C-step1")).toBeNull();
    expect(screen.queryByTestId("C-step2")).toBeNull();

    render(
      <CancelApplicationModals
        show
        recruitmentName="ULA positions, W26"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByTestId("CancelApplicationModals-step1"),
    ).toBeInTheDocument();
  });
});
