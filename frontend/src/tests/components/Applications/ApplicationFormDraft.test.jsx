import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplicationForm, {
  DRAFT_SAVE_DELAY_MS,
} from "main/components/Applications/ApplicationForm";
import noticesFixtures from "fixtures/noticesFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";

// The form asks the backend for a chosen course's section times; none are needed here.
const axiosMock = new AxiosMockAdapter(axios);

const courses = ["CMPSC     8", "CMPSC   156"];
const majors = ["Computer Engineering", "Computer Science"];
const topics = ["Java", "Python"];
const interests = ["Grading", "Tutoring"];

/** Renders a form that saves a draft (issue #270); returns what it calls and how to leave it. */
function renderDraftForm({
  type = "TA",
  onDraftChange = vi.fn(),
  onSaveDraft = vi.fn(),
  submitAction = vi.fn(),
  initialContents = undefined,
  notice = undefined,
  withHandlers = true,
  submitDisabled = undefined,
} = {}) {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicationForm
          type={type}
          courses={courses}
          majors={majors}
          topics={topics}
          interests={interests}
          notice={notice}
          initialContents={initialContents}
          submitAction={submitAction}
          onDraftChange={withHandlers ? onDraftChange : undefined}
          onSaveDraft={withHandlers ? onSaveDraft : undefined}
          submitDisabled={submitDisabled}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onDraftChange, onSaveDraft, submitAction, ...view };
}

const type = (testId, value) =>
  fireEvent.change(screen.getByTestId(`ApplicationForm-${testId}`), {
    target: { value },
  });
const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("ApplicationForm drafts", () => {
  beforeEach(() => {
    axiosMock.reset();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("the delay is a few seconds", () => {
    expect(DRAFT_SAVE_DELAY_MS).toBe(3000);
  });

  test("a form that saves no draft has no Save Draft button and saves nothing", () => {
    const { onDraftChange, onSaveDraft, unmount } = renderDraftForm({
      withHandlers: false,
    });

    expect(screen.queryByTestId("ApplicationForm-saveDraft")).toBeNull();
    type("comments", "Hello");
    advance(10000);
    unmount();
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  test("Save Draft sits beside Submit and does not submit", () => {
    const { onSaveDraft, submitAction } = renderDraftForm();

    const button = screen.getByTestId("ApplicationForm-saveDraft");
    expect(button).toHaveTextContent("Save Draft");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("btn-outline-secondary");
    expect(button.parentElement).toBe(
      screen.getByTestId("ApplicationForm-submit").parentElement,
    );

    fireEvent.click(button);
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(submitAction).not.toHaveBeenCalled();
    // None of the required-answer warnings appear: nothing is being submitted.
    expect(screen.queryByTestId("ApplicationForm-missing")).toBeNull();
  });

  test("the first quarter box goes into the draft, and a ticked draft comes back ticked (issue #292)", () => {
    const { onSaveDraft } = renderDraftForm();
    type("gpaMajor", "3.5");

    fireEvent.click(screen.getByTestId("ApplicationForm-firstQuarter"));
    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));

    const sent = onSaveDraft.mock.calls[0][0];
    expect(sent.firstQuarter).toBe(true);
    expect(sent.gpaMajor).toBeNull();
    expect(sent.gpaOverall).toBeNull();
  });

  test("a draft that has the box ticked restores it ticked (issue #292)", () => {
    renderDraftForm({ initialContents: { firstQuarter: true } });

    expect(screen.getByTestId("ApplicationForm-firstQuarter")).toBeChecked();
    expect(screen.getByTestId("ApplicationForm-gpaMajor")).toBeDisabled();
  });

  test("Save Draft sends everything entered so far, complete or not", () => {
    const { onSaveDraft } = renderDraftForm();
    type("firstName", "Ada");
    type("gpaMajor", "3.5");
    type("comments", "Half way");
    fireEvent.change(screen.getByTestId("ApplicationForm-major"), {
      target: { value: "Computer Science" },
    });
    fireEvent.click(screen.getByTestId("ApplicationForm-topic-Java-4"));

    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));

    const sent = onSaveDraft.mock.calls[0][0];
    expect(sent.firstName).toBe("Ada");
    expect(sent.lastName).toBe("");
    expect(sent.gpaMajor).toBe(3.5);
    expect(sent.gpaOverall).toBeNull();
    expect(sent.comments).toBe("Half way");
    expect(sent.major).toBe("Computer Science");
    expect(sent.topicProficiencies).toEqual({ Java: 4 });
    expect(sent.priorCoursework).toEqual([]);
    // A TA form has no I-9 box.
    expect(sent.i9Appointment).toBeNull();
    expect(sent.noticeVersionId).toBeNull();
  });

  test("nothing is saved until something changes", () => {
    const { onDraftChange } = renderDraftForm();

    advance(60000);

    expect(onDraftChange).not.toHaveBeenCalled();
  });

  test("a change is saved after the delay and not before", () => {
    const { onDraftChange } = renderDraftForm();

    type("comments", "Hello");
    advance(DRAFT_SAVE_DELAY_MS - 1);
    expect(onDraftChange).not.toHaveBeenCalled();
    advance(1);

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange.mock.calls[0][0].comments).toBe("Hello");
    // And once only, however long the form stays open.
    advance(60000);
    expect(onDraftChange).toHaveBeenCalledTimes(1);
  });

  test("typing that goes on is saved every few seconds, not only when it stops", () => {
    const { onDraftChange } = renderDraftForm();

    for (let second = 1; second <= 7; second++) {
      type("comments", `Hello ${second}`);
      advance(1000);
    }

    expect(onDraftChange).toHaveBeenCalledTimes(2);
    // Each save has the newest text at the time.
    expect(onDraftChange.mock.calls[0][0].comments).toBe("Hello 3");
    expect(onDraftChange.mock.calls[1][0].comments).toBe("Hello 6");
  });

  test("a change that is changed back before it is sent saves nothing", () => {
    const { onDraftChange } = renderDraftForm();

    type("comments", "Hello");
    type("comments", "");
    advance(60000);

    expect(onDraftChange).not.toHaveBeenCalled();
  });

  test("a change back to what was last sent, after a save, saves nothing", () => {
    const { onDraftChange } = renderDraftForm();
    type("comments", "A");
    advance(DRAFT_SAVE_DELAY_MS);
    expect(onDraftChange).toHaveBeenCalledTimes(1);

    type("comments", "B");
    type("comments", "A");
    advance(60000);

    expect(onDraftChange).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "the major",
      () =>
        fireEvent.change(screen.getByTestId("ApplicationForm-major"), {
          target: { value: "Computer Engineering" },
        }),
      (sent) => expect(sent.major).toBe("Computer Engineering"),
    ],
    [
      "a topic rating",
      () =>
        fireEvent.click(screen.getByTestId("ApplicationForm-topic-Python-2")),
      (sent) => expect(sent.topicProficiencies).toEqual({ Python: 2 }),
    ],
  ])("%s is saved too", async (_name, change, check) => {
    const { onDraftChange } = renderDraftForm();

    await change();
    advance(DRAFT_SAVE_DELAY_MS);

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    check(onDraftChange.mock.calls[0][0]);
  });

  test("a prior course is saved too", async () => {
    vi.useRealTimers();
    const { onDraftChange, unmount } = renderDraftForm();

    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-add-button"),
    );
    await userEvent.type(
      screen.getByTestId("ApplicationForm-coursework-modal-courseNumber"),
      "CMPSC 16",
    );
    await userEvent.click(
      screen.getByTestId("ApplicationForm-coursework-modal-save"),
    );
    expect(onDraftChange).not.toHaveBeenCalled();
    // Leaving sends what the timer has not yet.
    unmount();

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(
      onDraftChange.mock.calls[0][0].priorCoursework.map((c) => c.courseNumber),
    ).toEqual(["CMPSC 16"]);
  });

  test("the agreement is saved only once it has been ticked", () => {
    const notice = noticesFixtures.taV1;
    const { onDraftChange } = renderDraftForm({ notice });

    type("comments", "Hello");
    advance(DRAFT_SAVE_DELAY_MS);
    expect(onDraftChange.mock.calls[0][0].noticeVersionId).toBeNull();

    fireEvent.click(screen.getByTestId("ApplicationForm-notice-agree"));
    advance(DRAFT_SAVE_DELAY_MS);

    expect(onDraftChange).toHaveBeenCalledTimes(2);
    expect(onDraftChange.mock.calls[1][0].noticeVersionId).toBe(notice.id);
  });

  test("an agreement saved earlier comes back ticked and is kept", () => {
    const notice = noticesFixtures.taV1;
    const { onSaveDraft } = renderDraftForm({
      notice,
      initialContents: {
        ...draftApplicationsFixtures.savedUlaDraft,
        noticeVersionId: notice.id,
      },
    });

    expect(screen.getByTestId("ApplicationForm-notice-agree")).toBeChecked();
    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));

    expect(onSaveDraft.mock.calls[0][0].noticeVersionId).toBe(notice.id);
  });

  test("leaving the form sends what is waiting, once", () => {
    const { onDraftChange, unmount } = renderDraftForm();

    type("comments", "Before I go");
    unmount();

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange.mock.calls[0][0].comments).toBe("Before I go");
    // The timer was stopped with it.
    advance(60000);
    expect(onDraftChange).toHaveBeenCalledTimes(1);
  });

  test("leaving the form with nothing waiting sends nothing", () => {
    const { onDraftChange, unmount } = renderDraftForm();
    type("comments", "A");
    advance(DRAFT_SAVE_DELAY_MS);
    expect(onDraftChange).toHaveBeenCalledTimes(1);

    unmount();

    expect(onDraftChange).toHaveBeenCalledTimes(1);
  });

  test("a form that only has Save Draft is not hurt by changes waiting to be saved", () => {
    const { onSaveDraft, unmount } = renderDraftForm({
      onDraftChange: null,
    });
    type("comments", "Typed");

    advance(DRAFT_SAVE_DELAY_MS);
    unmount();

    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  test("an Other major is saved without the spaces around it", () => {
    const { onSaveDraft } = renderDraftForm();
    fireEvent.change(screen.getByTestId("ApplicationForm-major"), {
      target: { value: "__OTHER__" },
    });
    fireEvent.change(screen.getByTestId("ApplicationForm-otherMajor"), {
      target: { value: "  Geography  " },
    });

    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));

    expect(onSaveDraft.mock.calls[0][0].major).toBe("Geography");
  });

  test("Save Draft takes what is waiting with it", () => {
    const { onDraftChange, onSaveDraft, unmount } = renderDraftForm();
    type("comments", "Typed");

    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));
    advance(60000);
    unmount();

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onSaveDraft.mock.calls[0][0].comments).toBe("Typed");
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  test("a ULA form keeps its I-9 answer in the draft", () => {
    const { onSaveDraft } = renderDraftForm({ type: "ULA" });
    fireEvent.click(screen.getByTestId("ApplicationForm-i9Appointment"));

    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));

    expect(onSaveDraft.mock.calls[0][0].i9Appointment).toBe(true);
  });

  test("submitting still asks for the required answers", async () => {
    vi.useRealTimers();
    const { submitAction } = renderDraftForm();

    fireEvent.click(screen.getByTestId("ApplicationForm-submit"));

    expect(
      await screen.findByTestId("ApplicationForm-missing"),
    ).toBeInTheDocument();
    expect(submitAction).not.toHaveBeenCalled();
  });
  /** Issue #281: the form stays on screen after its recruitment closed, but cannot be sent. */
  test("the buttons are on unless the form is told its recruitment has closed", () => {
    renderDraftForm();
    expect(screen.getByTestId("ApplicationForm-submit")).toBeEnabled();
    expect(screen.getByTestId("ApplicationForm-saveDraft")).toBeEnabled();
  });

  test("a form told its recruitment has closed turns off submit and Save Draft but keeps the answers", () => {
    const { submitAction, onSaveDraft } = renderDraftForm({
      submitDisabled: true,
    });
    type("comments", "Kept as typed");

    expect(screen.getByTestId("ApplicationForm-submit")).toBeDisabled();
    expect(screen.getByTestId("ApplicationForm-saveDraft")).toBeDisabled();
    fireEvent.click(screen.getByTestId("ApplicationForm-saveDraft"));
    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(submitAction).not.toHaveBeenCalled();
    expect(screen.getByTestId("ApplicationForm-comments")).toHaveValue(
      "Kept as typed",
    );
  });
});
