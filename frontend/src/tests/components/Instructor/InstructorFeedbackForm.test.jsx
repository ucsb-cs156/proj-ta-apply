import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import InstructorFeedbackForm from "main/components/Instructor/InstructorFeedbackForm";
import { groupByQuarter } from "main/utils/instructorQuarters";
import {
  AT_LEAST_ONE_MESSAGE,
  COMMENTS_LIMIT_MESSAGE,
  COMMENTS_SAVE_DELAY_MS,
} from "main/utils/instructorFeedback";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import instructorFeedbackFixtures from "fixtures/instructorFeedbackFixtures";
import instructorFeedbackSettingsFixtures from "fixtures/instructorFeedbackSettingsFixtures";
import quartersFixtures from "fixtures/quartersFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const { bothReleased } = instructorRecruitmentsFixtures.quarters;
const { filledIn, costs, costsNotSet } = instructorFeedbackFixtures;

// W26 has both recruitments; its course 2 is CMPSC 156 (0100), in both.
const w26 = groupByQuarter(bothReleased).find((q) => q.quarter === "20261");
const course2 = w26.courses.find((c) => c.id === 2);
const taOnly = { ...w26, ula: undefined };
const ulaOnly = { ...w26, ta: undefined };

const P = "F";
const axiosMock = new AxiosMockAdapter(axios);

const puts = () => axiosMock.history.put;
const putBody = (i) => JSON.parse(puts()[i].data);

// The quarter calendar's row for W26 (issue #429: the notes can carry its dates).
const w26Calendar = {
  ...quartersFixtures.f21,
  quarter: "20261",
  qyy: "W26",
  name: "WINTER 2026",
  firstDayOfClasses: "2026-01-05T00:00:00",
};

let queryClient;

/** Once the notes in force have arrived and been drawn, whatever they were. */
const settingsFetched = async () => {
  await waitFor(() =>
    expect(
      queryClient.getQueryState(["/api/instructor/feedback/settings"])
        ?.dataUpdateCount,
    ).toBeGreaterThan(0),
  );
  await act(async () => {});
};

function renderForm({
  quarter = w26,
  rows = [],
  costsReply = costs,
  settingsReply = [instructorFeedbackSettingsFixtures.v1],
  calendarReply = [200, w26Calendar],
} = {}) {
  axiosMock.onGet("/api/instructor/feedback").reply(200, rows);
  axiosMock
    .onGet("/api/instructor/feedback/costs", { params: { quarter: "20261" } })
    .reply(200, costsReply);
  axiosMock
    .onGet("/api/instructor/feedback/settings")
    .reply(200, settingsReply);
  axiosMock
    .onGet("/api/quarters/one", { params: { yyyyq: "20261" } })
    .reply(...calendarReply);
  queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <InstructorFeedbackForm
        quarter={quarter}
        course={course2}
        testIdPrefix={P}
      />
    </QueryClientProvider>,
  );
}

/** The server's answer to a save: the row, stamped at the given time. */
const answer = (lastUpdated) => [200, { ...filledIn, lastUpdated }];

describe("InstructorFeedbackForm (issue #425)", () => {
  beforeEach(() => {
    axiosMock.reset();
    mockToast.mockClear();
  });

  test("an empty form: the heading, the four boxes and the text area, and nothing saved yet", async () => {
    renderForm();

    expect(screen.getByTestId(`${P}-form`)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Please provide feedback on your allocation of TAs/ULAs",
      }),
    ).toHaveClass("h6");
    expect(
      screen.getByText("Please select all that apply, but at least one:"),
    ).toHaveClass("mb-1");
    expect(
      screen.getByLabelText("The allocation seems reasonable to me"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("I would prefer a different number of TAs"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("I would prefer a different number of ULAs"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("I have other concerns, listed below:"),
    ).not.toBeChecked();
    expect(screen.getByTestId(`${P}-allocReasonable`)).toHaveAttribute(
      "type",
      "checkbox",
    );
    // The counts appear only while their box is checked.
    expect(screen.queryByTestId(`${P}-numTAsPreferred`)).toBeNull();
    expect(screen.queryByTestId(`${P}-numULAsPreferred`)).toBeNull();
    expect(screen.queryByText("Number of TAs preferred:")).toBeNull();
    expect(screen.getByTestId(`${P}-differentTACount-line`)).toHaveClass(
      "d-flex",
      "align-items-center",
      "flex-wrap",
      "gap-3",
    );
    // At least one box is asked for.
    const atLeastOne = screen.getByTestId(`${P}-at-least-one`);
    expect(atLeastOne.textContent).toBe(AT_LEAST_ONE_MESSAGE);
    expect(atLeastOne).toHaveClass("text-danger", "small");
    const comments = screen.getByTestId(`${P}-comments`);
    expect(comments.tagName).toBe("TEXTAREA");
    expect(comments).toHaveAttribute("maxLength", "2048");
    expect(comments).toHaveAttribute("rows", "4");
    expect(comments).toHaveClass("mt-2");
    expect(comments).toHaveValue("");
    expect(screen.getByLabelText("Comments")).toBe(comments);
    expect(screen.queryByTestId(`${P}-comments-limit`)).toBeNull();
    const lastSaved = screen.getByTestId(`${P}-last-saved`);
    expect(lastSaved.textContent).toBe("Last saved: never");
    expect(lastSaved).toHaveClass("mt-2", "text-muted", "small");
    await waitFor(() =>
      expect(axiosMock.history.get.map((r) => r.url)).toContain(
        "/api/instructor/feedback",
      ),
    );
    expect(puts()).toHaveLength(0);
  });

  test("the stored row is shown: boxes, counts, comments and when it was saved", async () => {
    renderForm({ rows: [filledIn] });

    await waitFor(() =>
      expect(
        screen.getByLabelText("I would prefer a different number of TAs"),
      ).toBeChecked(),
    );
    expect(
      screen.getByLabelText("I would prefer a different number of ULAs"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("I have other concerns, listed below:"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("The allocation seems reasonable to me"),
    ).not.toBeChecked();
    expect(screen.getByTestId(`${P}-numTAsPreferred`)).toHaveValue("3");
    expect(screen.getByTestId(`${P}-numULAsPreferred`)).toHaveValue("2");
    expect(screen.getByText("Number of TAs preferred:")).toBeInTheDocument();
    expect(screen.getByText("Number of ULAs preferred:")).toBeInTheDocument();
    // A narrow box on the same line as its label.
    const box = screen.getByTestId(`${P}-numTAsPreferred`);
    expect(box.closest(".input-group").style.width).toBe("5em");
    expect(box.closest(".mb-2")).toHaveClass("d-flex", "align-items-center");
    expect(screen.getByTestId(`${P}-comments`)).toHaveValue(filledIn.comments);
    expect(screen.queryByTestId(`${P}-at-least-one`)).toBeNull();
    expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
      "Last saved: 11/8/2026, 2:05:30 PM",
    );
  });

  test("a row for another course or another quarter is not this one", async () => {
    // The same course in another quarter, then another course in this quarter, then this one.
    renderForm({
      rows: [
        { ...filledIn, quarter: "20262" },
        { ...filledIn, recruitmentCourseId: 3 },
        {
          ...filledIn,
          allocReasonable: true,
          differentTACount: false,
          lastUpdated: "2026-11-08T09:00:00",
        },
      ],
    });

    await waitFor(() =>
      expect(
        screen.getByLabelText("The allocation seems reasonable to me"),
      ).toBeChecked(),
    );
    expect(
      screen.getByLabelText("I would prefer a different number of TAs"),
    ).not.toBeChecked();
    expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
      "Last saved: 11/8/2026, 9:00:00 AM",
    );
  });

  test("a box is saved when clicked, and Last saved shows the server's time", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    await userEvent.click(
      screen.getByLabelText("The allocation seems reasonable to me"),
    );

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({ recruitmentCourseId: 2 });
    expect(putBody(0)).toEqual({ allocReasonable: true });
    expect(
      screen.getByLabelText("The allocation seems reasonable to me"),
    ).toBeChecked();
    expect(screen.queryByTestId(`${P}-at-least-one`)).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
        "Last saved: 11/8/2026, 3:00:00 PM",
      ),
    );

    await userEvent.click(
      screen.getByLabelText("I have other concerns, listed below:"),
    );
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(putBody(1)).toEqual({ otherConcerns: true });

    // Unchecking is saved too, and with no box checked the message is back.
    await userEvent.click(
      screen.getByLabelText("The allocation seems reasonable to me"),
    );
    await userEvent.click(
      screen.getByLabelText("I have other concerns, listed below:"),
    );
    await waitFor(() => expect(puts()).toHaveLength(4));
    expect(putBody(2)).toEqual({ allocReasonable: false });
    expect(putBody(3)).toEqual({ otherConcerns: false });
    expect(screen.getByTestId(`${P}-at-least-one`)).toBeInTheDocument();
  });

  test("checking the TA box shows its count, which is saved as it is typed", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    await userEvent.click(
      screen.getByLabelText("I would prefer a different number of TAs"),
    );
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(putBody(0)).toEqual({ differentTACount: true });
    expect(screen.queryByTestId(`${P}-at-least-one`)).toBeNull();

    const count = screen.getByTestId(`${P}-numTAsPreferred`);
    expect(count).toHaveValue("");
    expect(screen.getByLabelText("Number of TAs preferred:")).toBe(count);
    await userEvent.type(count, "12");
    await waitFor(() => expect(puts()).toHaveLength(3));
    expect(putBody(1)).toEqual({ numTAsPreferred: 1 });
    expect(putBody(2)).toEqual({ numTAsPreferred: 12 });

    // Not a whole number: flagged, not sent.
    await userEvent.type(count, "x");
    expect(count).toHaveClass("is-invalid");
    expect(screen.getByTestId(`${P}-numTAsPreferred-invalid`).textContent).toBe(
      "A whole number, 0 or more",
    );
    expect(puts()).toHaveLength(3);

    // Emptied: saved as null.
    await userEvent.clear(count);
    await waitFor(() => expect(puts()).toHaveLength(4));
    expect(putBody(3)).toEqual({ numTAsPreferred: null });
    await userEvent.type(count, "4");
    await waitFor(() => expect(puts()).toHaveLength(5));
    fireEvent.blur(count);
    expect(count).toHaveValue("4");

    // Unchecked: the count goes away, and only the box is saved; the count is kept.
    await userEvent.click(
      screen.getByLabelText("I would prefer a different number of TAs"),
    );
    await waitFor(() => expect(puts()).toHaveLength(6));
    expect(putBody(5)).toEqual({ differentTACount: false });
    expect(screen.queryByTestId(`${P}-numTAsPreferred`)).toBeNull();
    await userEvent.click(
      screen.getByLabelText("I would prefer a different number of TAs"),
    );
    expect(screen.getByTestId(`${P}-numTAsPreferred`)).toHaveValue("4");
  });

  test("checking the ULA box shows its count, saved the same way", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    await userEvent.click(
      screen.getByLabelText("I would prefer a different number of ULAs"),
    );
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(putBody(0)).toEqual({ differentULACount: true });
    expect(screen.queryByTestId(`${P}-numTAsPreferred`)).toBeNull();
    const count = screen.getByTestId(`${P}-numULAsPreferred`);
    expect(screen.getByLabelText("Number of ULAs preferred:")).toBe(count);
    await userEvent.type(count, "0");
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(putBody(1)).toEqual({ numULAsPreferred: 0 });
  });

  test("a TA-only quarter has no ULA line, and a ULA-only quarter no TA line", () => {
    renderForm({ quarter: taOnly });
    expect(
      screen.getByTestId(`${P}-differentTACount-line`),
    ).toBeInTheDocument();
    expect(screen.queryByTestId(`${P}-differentULACount-line`)).toBeNull();
    expect(
      screen.queryByLabelText("I would prefer a different number of ULAs"),
    ).toBeNull();
  });

  test("a ULA-only quarter has no TA line", () => {
    renderForm({ quarter: ulaOnly });
    expect(screen.queryByTestId(`${P}-differentTACount-line`)).toBeNull();
    expect(
      screen.getByTestId(`${P}-differentULACount-line`),
    ).toBeInTheDocument();
  });

  test("the comments are saved once the typing stops, not on every keystroke", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    const comments = screen.getByTestId(`${P}-comments`);
    await userEvent.type(comments, "Hello");
    expect(comments).toHaveValue("Hello");
    expect(puts()).toHaveLength(0);

    await waitFor(() => expect(puts()).toHaveLength(1), {
      timeout: COMMENTS_SAVE_DELAY_MS * 3,
    });
    expect(putBody(0)).toEqual({ comments: "Hello" });
    await waitFor(() =>
      expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
        "Last saved: 11/8/2026, 3:00:00 PM",
      ),
    );
    // Leaving the box with nothing waiting sends nothing more.
    fireEvent.blur(comments);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(puts()).toHaveLength(1);
  });

  test("leaving the comments sends what is waiting at once, and only once", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    const comments = screen.getByTestId(`${P}-comments`);
    await userEvent.type(comments, "Hi");
    fireEvent.blur(comments);
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(putBody(0)).toEqual({ comments: "Hi" });
    // The timer was stopped: nothing more after the delay.
    await new Promise((resolve) =>
      setTimeout(resolve, COMMENTS_SAVE_DELAY_MS + 200),
    );
    expect(puts()).toHaveLength(1);
  });

  test("emptied comments are saved as empty", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm({ rows: [filledIn] });

    const comments = screen.getByTestId(`${P}-comments`);
    await waitFor(() => expect(comments).toHaveValue(filledIn.comments));
    await userEvent.clear(comments);
    fireEvent.blur(comments);
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(putBody(0)).toEqual({ comments: "" });
    expect(comments).toHaveValue("");
  });

  test("going away sends comments that are still waiting", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    const { unmount } = renderForm();

    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByTestId(`${P}-comments`), {
        target: { value: "Bye" },
      });
      unmount();
      // Not by the timer: it never fires.
      vi.clearAllTimers();
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(putBody(0)).toEqual({ comments: "Bye" });
  });

  test("each keystroke starts the wait again", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();
    const comments = screen.getByTestId(`${P}-comments`);

    vi.useFakeTimers();
    try {
      fireEvent.change(comments, { target: { value: "He" } });
      vi.advanceTimersByTime(COMMENTS_SAVE_DELAY_MS - 250);
      fireEvent.change(comments, { target: { value: "Hel" } });
      // Longer than the wait since the first keystroke, shorter than since the last.
      vi.advanceTimersByTime(COMMENTS_SAVE_DELAY_MS - 250);
      fireEvent.change(comments, { target: { value: "Hello" } });
      vi.advanceTimersByTime(COMMENTS_SAVE_DELAY_MS - 1);
      expect(puts()).toHaveLength(0);
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => expect(puts()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(puts()).toHaveLength(1);
    expect(putBody(0)).toEqual({ comments: "Hello" });
  });

  test("the comments stop at 2048 characters and say so", async () => {
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    const comments = screen.getByTestId(`${P}-comments`);
    fireEvent.change(comments, { target: { value: "x".repeat(2047) } });
    expect(screen.queryByTestId(`${P}-comments-limit`)).toBeNull();

    // A paste past the limit is cut at the limit, and that is what is saved.
    fireEvent.change(comments, { target: { value: "y".repeat(2050) } });
    expect(comments.value).toHaveLength(2048);
    const limit = screen.getByTestId(`${P}-comments-limit`);
    expect(limit.textContent).toBe(COMMENTS_LIMIT_MESSAGE);
    expect(limit).toHaveClass("text-danger", "small");
    fireEvent.blur(comments);
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(putBody(0).comments).toBe("y".repeat(2048));
  });

  test("saves go one after another, so the last one typed is the last one stored", async () => {
    let first = true;
    axiosMock.onPut("/api/instructor/feedback").reply(
      () =>
        new Promise((resolve) => {
          // The first save is slow; the second must still wait for it.
          const slow = first;
          first = false;
          setTimeout(
            () =>
              resolve(
                answer(slow ? "2026-11-08T15:00:00" : "2026-11-08T15:00:09"),
              ),
            slow ? 100 : 0,
          );
        }),
    );
    renderForm();

    await userEvent.click(
      screen.getByLabelText("The allocation seems reasonable to me"),
    );
    await userEvent.click(
      screen.getByLabelText("I have other concerns, listed below:"),
    );
    expect(puts()).toHaveLength(1);
    await waitFor(() => expect(puts()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
        "Last saved: 11/8/2026, 3:00:09 PM",
      ),
    );
  });

  test("a failed save is toasted, and the next one is still sent", async () => {
    axiosMock.onPut("/api/instructor/feedback").replyOnce(500);
    axiosMock
      .onPut("/api/instructor/feedback")
      .reply(...answer("2026-11-08T15:00:00"));
    renderForm();

    await userEvent.click(
      screen.getByLabelText("The allocation seems reasonable to me"),
    );
    await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
    expect(mockToast.mock.calls[0][0]).toMatch(/500/);
    expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
      "Last saved: never",
    );

    await userEvent.click(
      screen.getByLabelText("I have other concerns, listed below:"),
    );
    await waitFor(() =>
      expect(screen.getByTestId(`${P}-last-saved`).textContent).toBe(
        "Last saved: 11/8/2026, 3:00:00 PM",
      ),
    );
  });

  test("a refused save (403) is logged, not toasted", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    axiosMock.onPut("/api/instructor/feedback").reply(403);
    renderForm();

    await userEvent.click(
      screen.getByLabelText("The allocation seems reasonable to me"),
    );
    await waitFor(() =>
      expect(log).toHaveBeenCalledWith(
        "Saving the allocation feedback failed",
        expect.anything(),
      ),
    );
    expect(mockToast).not.toHaveBeenCalled();
    log.mockRestore();
  });

  // ---- the notes (issues #425 and #429) ----

  test("the notes are closed until opened, below the form, and say what they said before issue #429", async () => {
    renderForm();

    const notes = await screen.findByTestId(`${P}-notes`);
    expect(notes.tagName).toBe("DETAILS");
    expect(notes).not.toHaveAttribute("open");
    expect(notes).toHaveClass("mt-3");
    expect(screen.getByTestId(`${P}-notes-summary`).textContent).toBe(
      "Notes on TA/ULA tradeoffs",
    );
    // Below the form.
    expect(screen.getByTestId(`${P}-form`).lastElementChild).toBe(notes);
    const text = screen.getByTestId(`${P}-notes-text`);
    expect(text).toHaveClass("mt-2");
    await waitFor(() =>
      expect(text.querySelector("p").textContent).toBe(
        "Note that the current estimated cost of a TA is $12,000.00 while the estimated cost of a ULA is $2,000.00. This means that on a cost basis, the ratio of TA to ULA is 1:6.0.",
      ),
    );
    expect([...text.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "Note that the current estimated cost of a TA is $12,000.00 while the estimated cost of a ULA is $2,000.00. This means that on a cost basis, the ratio of TA to ULA is 1:6.0.",
      "On the other hand, TAs work 20 hours per week, while ULAs work 10 hours per week.",
      "We are not always in a position to trade off TAs for ULAs in precisely the way each faculty member would prefer; there are constraints other than faculty preferences that we must satisfy. That being said, we will do our best to take your preferences into consideration.",
    ]);
    const costRequest = axiosMock.history.get.find(
      (r) => r.url === "/api/instructor/feedback/costs",
    );
    expect(costRequest.params).toEqual({ quarter: "20261" });
    const calendarRequest = axiosMock.history.get.find(
      (r) => r.url === "/api/quarters/one",
    );
    expect(calendarRequest.params).toEqual({ yyyyq: "20261" });

    await userEvent.click(screen.getByTestId(`${P}-notes-summary`));
    expect(notes).toHaveAttribute("open");
  });

  test("the newest notes are rendered as Markdown with the quarter, its dates and its costs filled in", async () => {
    renderForm({ settingsReply: [instructorFeedbackSettingsFixtures.v2] });

    const text = await screen.findByTestId(`${P}-notes-text`);
    await waitFor(() =>
      expect(text.querySelector("h2")).toHaveTextContent(
        "Tradeoffs for Winter 2026",
      ),
    );
    await waitFor(() =>
      expect(
        [...text.querySelectorAll("li")].map((li) => li.textContent),
      ).toEqual([
        "A TA costs $12,000.00",
        "A ULA costs $2,000.00",
        "So the ratio is 1:6.0",
      ]),
    );
    await waitFor(() =>
      expect(text.querySelector("p")).toHaveTextContent(
        "Classes begin January 5, 2026.",
      ),
    );
  });

  test("a quarter not on file leaves its dates as written", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    renderForm({
      settingsReply: [instructorFeedbackSettingsFixtures.v2],
      calendarReply: [404],
    });

    const text = await screen.findByTestId(`${P}-notes-text`);
    await waitFor(() =>
      expect(text.querySelector("li")).toHaveTextContent(
        "A TA costs $12,000.00",
      ),
    );
    expect(text.querySelector("h2")).toHaveTextContent(
      "Tradeoffs for Winter 2026",
    );
    expect(text.querySelector("p")).toHaveTextContent(
      "Classes begin ${firstDayOfClasses}.",
    );
    // A quarter not on file is answered quietly.
    expect(mockToast).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test("a cost not yet entered reads not yet set, and so does the ratio", async () => {
    renderForm({
      costsReply: costsNotSet,
      settingsReply: [instructorFeedbackSettingsFixtures.v2],
    });

    const text = await screen.findByTestId(`${P}-notes-text`);
    await waitFor(() =>
      expect(
        [...text.querySelectorAll("li")].map((li) => li.textContent),
      ).toEqual([
        "A TA costs $12,000.00",
        "A ULA costs not yet set",
        "So the ratio is not yet set",
      ]),
    );
  });

  test("before the costs arrive, they read not yet set", async () => {
    axiosMock
      .onGet("/api/instructor/feedback/costs")
      .reply(() => new Promise(() => {}));
    renderForm({ settingsReply: [instructorFeedbackSettingsFixtures.v2] });

    const text = await screen.findByTestId(`${P}-notes-text`);
    expect(
      [...text.querySelectorAll("li")].map((li) => li.textContent),
    ).toEqual([
      "A TA costs not yet set",
      "A ULA costs not yet set",
      "So the ratio is not yet set",
    ]);
  });

  test("the notes are GitHub-flavoured Markdown: tables and strikethrough render", async () => {
    renderForm({
      settingsReply: [
        {
          ...instructorFeedbackSettingsFixtures.v2,
          notesText:
            "| Role | Cost |\n| --- | --- |\n| TA | ${estimatedCostPerTA} |\n\n~~Old note~~",
        },
      ],
    });

    const text = await screen.findByTestId(`${P}-notes-text`);
    await waitFor(() =>
      expect(text.querySelector("table td:last-child")).toHaveTextContent(
        "$12,000.00",
      ),
    );
    expect(text.querySelector("del")).toHaveTextContent("Old note");
  });

  test("with no notes there is no notes section", async () => {
    renderForm({ settingsReply: [] });

    await settingsFetched();
    expect(screen.queryByTestId(`${P}-notes`)).toBeNull();
    expect(screen.getByTestId(`${P}-form`).lastElementChild).toBe(
      screen.getByTestId(`${P}-last-saved`),
    );
  });

  test("an answer that is not a list shows no notes", async () => {
    renderForm({ settingsReply: { notesText: "Not a list" } });

    await settingsFetched();
    expect(screen.queryByTestId(`${P}-notes`)).toBeNull();
  });
});
