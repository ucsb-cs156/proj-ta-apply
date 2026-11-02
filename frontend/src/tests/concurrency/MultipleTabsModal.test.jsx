import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MultipleTabsModal, {
  ENTER_IGNORED_MS,
} from "main/concurrency/MultipleTabsModal";

const RISK =
  "Please know that this is risky; we recommend closing all but one of these.";
const you = { label: "me@example.org (Me)", samePerson: true };
const phill = { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false };

function modal(props = {}) {
  return (
    <MultipleTabsModal
      others={[phill]}
      newest={true}
      arrivedAt={1000}
      noun="application"
      onLeave={() => {}}
      {...props}
    />
  );
}

const leaveButton = () =>
  screen.getByRole("button", { name: "Leave this page" });
const waitButton = () =>
  screen.getByRole("button", {
    name: "Wait for the other tabs or windows to close, then resume here",
  });
const continueButton = () =>
  screen.getByRole("button", { name: "Continue anyway" });
const dialog = () => screen.queryByRole("dialog");

describe("MultipleTabsModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("ENTER_IGNORED_MS is one second", () => {
    expect(ENTER_IGNORED_MS).toBe(1000);
  });

  test("shows nothing to a tab that is not the newest", () => {
    render(modal({ newest: false }));
    expect(dialog()).toBeNull();
  });

  test("shows nothing when no one else is there", () => {
    render(modal({ others: [] }));
    expect(dialog()).toBeNull();
  });

  test("asks the newest tab, in a dialog labelled by its title, with the composed sentence", () => {
    render(modal({ others: [you, phill] }));

    const box = screen.getByRole("dialog", {
      name: "This application is open in more than one place",
    });
    expect(box).toBeInTheDocument();
    expect(screen.getByTestId("MultipleTabsModal-message")).toHaveTextContent(
      `You and phtcon@ucsb.edu (Phill Conrad) are also editing this application in other windows or tabs. ${RISK}`,
    );
    expect(leaveButton()).toBeInTheDocument();
    expect(waitButton()).toBeInTheDocument();
    expect(continueButton()).toBeInTheDocument();
  });

  test("names what is open twice", () => {
    render(modal({ noun: "budget" }));
    expect(
      screen.getByRole("dialog", {
        name: "This budget is open in more than one place",
      }),
    ).toBeInTheDocument();
  });

  test("the test ids can be given", () => {
    render(modal({ testId: "Mine" }));
    expect(screen.getByTestId("Mine-message")).toBeInTheDocument();
    expect(screen.getByTestId("Mine-leave")).toBeInTheDocument();
    expect(screen.getByTestId("Mine-wait")).toBeInTheDocument();
    expect(screen.getByTestId("Mine-continue")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("Mine-wait"));
    expect(screen.getByTestId("Mine-waiting")).toBeInTheDocument();
  });

  test("a long name wraps instead of widening the modal", () => {
    render(modal({ others: [{ label: "x".repeat(300), samePerson: false }] }));
    expect(
      screen.getByTestId("MultipleTabsModal-message").parentElement,
    ).toHaveStyle({ overflowWrap: "anywhere" });
  });

  test("no button has the focus, so typing cannot choose one", () => {
    render(modal());

    const focused = document.activeElement;
    expect(focused?.tagName).not.toBe("BUTTON");
    expect(screen.getByRole("dialog").contains(focused)).toBe(true);
  });

  test("Leave this page calls onLeave, and nothing else changes", () => {
    const onLeave = vi.fn();
    render(modal({ onLeave }));

    fireEvent.click(leaveButton());

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(dialog()).not.toBeNull();
  });

  test("Continue anyway closes it", () => {
    const onLeave = vi.fn();
    render(modal({ onLeave }));

    fireEvent.click(continueButton());

    expect(dialog()).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
  });

  test("after Continue anyway it does not come back with each heartbeat, or when more people join", () => {
    const { rerender } = render(modal());
    fireEvent.click(continueButton());

    rerender(modal({ others: [phill] }));
    rerender(modal({ others: [you, phill] }));
    rerender(modal({ others: [phill], newest: false }));
    rerender(modal({ others: [phill], newest: true }));

    expect(dialog()).toBeNull();
  });

  test("it comes back when this tab arrives afresh", () => {
    const { rerender } = render(modal());
    fireEvent.click(continueButton());
    expect(dialog()).toBeNull();

    rerender(modal({ arrivedAt: 2000 }));

    expect(dialog()).not.toBeNull();
  });

  test("Wait keeps the modal up, says so, and cannot be chosen again", () => {
    const onLeave = vi.fn();
    render(modal({ onLeave }));
    expect(screen.queryByTestId("MultipleTabsModal-waiting")).toBeNull();
    expect(waitButton()).toBeEnabled();

    fireEvent.click(waitButton());

    expect(dialog()).not.toBeNull();
    expect(screen.getByTestId("MultipleTabsModal-waiting")).toBe(
      screen.getByRole("status"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for the other tabs or windows to close.",
    );
    expect(waitButton()).toBeDisabled();
    // The other two choices are still there to take.
    expect(leaveButton()).toBeEnabled();
    expect(continueButton()).toBeEnabled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  test("while waiting, the modal closes by itself when no one else is left", () => {
    const { rerender } = render(modal());
    fireEvent.click(waitButton());

    rerender(modal({ others: [phill] }));
    expect(dialog()).not.toBeNull();
    rerender(modal({ others: [] }));

    expect(dialog()).toBeNull();
  });

  test("while waiting, the modal is released if another tab arrives after this one", () => {
    const { rerender } = render(modal());
    fireEvent.click(waitButton());

    rerender(modal({ newest: false }));

    expect(dialog()).toBeNull();
  });

  test("while waiting, Continue anyway still closes it", () => {
    render(modal());
    fireEvent.click(waitButton());

    fireEvent.click(continueButton());

    expect(dialog()).toBeNull();
  });

  test("Escape does nothing: the question must be answered", () => {
    render(modal());

    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });

    expect(dialog()).not.toBeNull();
  });

  test("clicking outside it does nothing", () => {
    const { baseElement } = render(modal());
    const backdrop = baseElement.querySelector(".modal");

    fireEvent.click(backdrop);
    fireEvent.mouseDown(backdrop);
    fireEvent.mouseUp(backdrop);

    expect(dialog()).not.toBeNull();
  });

  test("Enter is ignored for the first second", () => {
    render(modal());

    // fireEvent says false when the event's default was prevented.
    expect(fireEvent.keyDown(leaveButton(), { key: "Enter" })).toBe(false);
    act(() => {
      vi.advanceTimersByTime(ENTER_IGNORED_MS - 1);
    });
    expect(fireEvent.keyDown(leaveButton(), { key: "Enter" })).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fireEvent.keyDown(leaveButton(), { key: "Enter" })).toBe(true);
  });

  test("other keys are never ignored", () => {
    render(modal());
    expect(fireEvent.keyDown(leaveButton(), { key: "a" })).toBe(true);
    expect(fireEvent.keyDown(leaveButton(), { key: " " })).toBe(true);
  });

  test("the second starts again each time the modal appears", () => {
    const { rerender } = render(modal());
    act(() => {
      vi.advanceTimersByTime(ENTER_IGNORED_MS);
    });
    expect(fireEvent.keyDown(leaveButton(), { key: "Enter" })).toBe(true);

    rerender(modal({ newest: false }));
    rerender(modal({ newest: true }));

    expect(fireEvent.keyDown(leaveButton(), { key: "Enter" })).toBe(false);
  });
});
