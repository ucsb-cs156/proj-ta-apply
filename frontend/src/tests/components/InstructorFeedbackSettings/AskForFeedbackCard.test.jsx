import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import AskForFeedbackCard, {
  ASK_FOR_FEEDBACK_LABEL,
} from "main/components/InstructorFeedbackSettings/AskForFeedbackCard";
import instructorFeedbackSettingsFixtures from "fixtures/instructorFeedbackSettingsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const { v1, v2, v3, history, historyNotAsking } =
  instructorFeedbackSettingsFixtures;
const HISTORY_URL = "/api/admin/instructorFeedbackSettings/all";
const SAVE_URL = "/api/admin/instructorFeedbackSettings";

const axiosMock = new AxiosMockAdapter(axios);

let queryClient;

function renderCard(props = { testIdPrefix: "Ask" }) {
  queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <AskForFeedbackCard {...props} />
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}

/** The checkbox, once the history has arrived and it can be clicked. */
const loadedCheckbox = async () => {
  const checkbox = screen.getByLabelText(ASK_FOR_FEEDBACK_LABEL);
  await waitFor(() => expect(checkbox).toBeEnabled());
  return checkbox;
};

describe("AskForFeedbackCard (issue #430)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(HISTORY_URL).reply(200, history);
  });

  test("the label is the one the issue gives", () => {
    expect(ASK_FOR_FEEDBACK_LABEL).toBe(
      "Ask faculty for feedback on TA/ULA allocations after both have been released to instructors",
    );
  });

  test("a card headed Asking for feedback, with the checkbox, disabled until the history arrives", async () => {
    renderCard();

    expect(screen.getByTestId("Ask")).toHaveClass("card", "mb-4");
    expect(
      screen.getByRole("heading", { level: 2, name: "Asking for feedback" }),
    ).toHaveClass("h5", "mb-0");
    const checkbox = screen.getByLabelText(ASK_FOR_FEEDBACK_LABEL);
    expect(checkbox).toHaveAttribute("type", "checkbox");
    expect(checkbox).toHaveAttribute("id", "Ask-checkbox");
    expect(checkbox).toBeDisabled();
    expect(screen.queryByTestId("Ask-last-change")).toBeNull();

    expect(await loadedCheckbox()).toBeChecked();
    expect(screen.getByText(/While this is checked/)).toHaveTextContent(
      "While this is checked, each course on an instructor's home page has a section for feedback on its allocation: a note saying which allocations it waits for, then, once they are released, the feedback form and the notes on TA/ULA tradeoffs. While it is unchecked, that section is hidden and feedback is not accepted; feedback already given is kept, and returns with the form when this is checked again.",
    );
  });

  test("on since the app was installed, when no admin has changed it", async () => {
    renderCard();
    await loadedCheckbox();

    expect(screen.getByTestId("Ask-last-change")).toHaveTextContent(
      "On since the app was installed (version 1, 11/9/2026, 8:00:00 AM).",
    );
    expect(screen.getByTestId("Ask-last-change")).toHaveClass(
      "text-muted",
      "small",
    );
  });

  test("off, with who turned it off and when", async () => {
    axiosMock.onGet(HISTORY_URL).reply(200, historyNotAsking);
    renderCard();

    const checkbox = await loadedCheckbox();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByTestId("Ask-last-change")).toHaveTextContent(
      "Off since other-admin@ucsb.edu saved version 3, 11/11/2026, 9:15:00 AM.",
    );
  });

  test("the change shown is the one that set the value, not a later save of the notes", async () => {
    const v4 = { ...v3, id: 4, editorEmail: "notes@ucsb.edu", notesText: "x" };
    const v5 = {
      ...v4,
      id: 5,
      askForFeedback: true,
      editorEmail: "on@ucsb.edu",
    };
    const v6 = { ...v5, id: 6, editorEmail: "notes@ucsb.edu", notesText: "y" };
    axiosMock.onGet(HISTORY_URL).reply(200, [v6, v5, v4, v3, v2, v1]);
    renderCard();

    expect(await loadedCheckbox()).toBeChecked();
    expect(screen.getByTestId("Ask-last-change")).toHaveTextContent(
      "On since on@ucsb.edu saved version 5,",
    );
  });

  test("with no version at all it is checked, as the server counts it, and says nothing more", async () => {
    axiosMock.onGet(HISTORY_URL).reply(200, []);
    renderCard();

    expect(await loadedCheckbox()).toBeChecked();
    expect(screen.queryByTestId("Ask-last-change")).toBeNull();
  });

  test("unchecking saves only the checkbox, toasts and refreshes the history", async () => {
    axiosMock.onPost(SAVE_URL).reply(200, { ...v3, id: 7 });
    const invalidateQueriesSpy = renderCard();
    const checkbox = await loadedCheckbox();
    // After the save, the history has the new version, and the card shows it.
    axiosMock.onGet(HISTORY_URL).reply(200, historyNotAsking);

    await userEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.getByTestId("Ask-last-change")).toHaveTextContent(
      "Off since other-admin@ucsb.edu saved version 3,",
    );
    expect(axiosMock.history.post).toHaveLength(1);
    expect(JSON.parse(axiosMock.history.post[0].data)).toEqual({
      askForFeedback: false,
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Saved version 7: faculty are no longer asked for feedback on their TA/ULA allocations",
      ),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [HISTORY_URL],
    });
  });

  test("checking saves only the checkbox and toasts", async () => {
    axiosMock.onGet(HISTORY_URL).reply(200, historyNotAsking);
    axiosMock
      .onPost(SAVE_URL)
      .reply(200, { ...v3, id: 8, askForFeedback: true });
    renderCard();
    const checkbox = await loadedCheckbox();

    await userEvent.click(checkbox);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Saved version 8: faculty are now asked for feedback on their TA/ULA allocations",
      ),
    );
    expect(JSON.parse(axiosMock.history.post[0].data)).toEqual({
      askForFeedback: true,
    });
  });

  test("the checkbox is disabled while a save is on its way", async () => {
    let answer;
    axiosMock.onPost(SAVE_URL).reply(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    renderCard();
    const checkbox = await loadedCheckbox();

    await userEvent.click(checkbox);

    await waitFor(() => expect(checkbox).toBeDisabled());
    answer([200, { ...v3, id: 9 }]);
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
  });

  test("a failed save toasts the error and no success", async () => {
    axiosMock.onPost(SAVE_URL).reply(500);
    renderCard();
    const checkbox = await loadedCheckbox();

    await userEvent.click(checkbox);

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error: Request failed with status code 500",
      ),
    );
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test("the default test id prefix is the component's name", async () => {
    renderCard({});
    expect(screen.getByTestId("AskForFeedbackCard")).toBeInTheDocument();
    expect(screen.getByLabelText(ASK_FOR_FEEDBACK_LABEL)).toHaveAttribute(
      "id",
      "AskForFeedbackCard-checkbox",
    );
  });
});
