import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import FeedbackNotesEditorCard from "main/components/InstructorFeedbackSettings/FeedbackNotesEditorCard";
import instructorFeedbackSettingsFixtures from "fixtures/instructorFeedbackSettingsFixtures";
import quartersFixtures from "fixtures/quartersFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

// As in the NoticeEditorCard tests: CodeMirror cannot be typed into under jsdom.
vi.mock("react-simplemde-editor", () => ({
  default: ({ value, onChange, options }) => (
    <textarea
      data-testid="mde"
      data-options={JSON.stringify(options)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const { v1, v2, history } = instructorFeedbackSettingsFixtures;
const HISTORY_URL = "/api/admin/instructorFeedbackSettings/all";
const COSTS_URL = "/api/admin/instructorFeedbackSettings/costs";

const axiosMock = new AxiosMockAdapter(axios);
const gets = (url) => axiosMock.history.get.filter((r) => r.url === url);

const w26Calendar = {
  ...quartersFixtures.f21,
  quarter: "20261",
  qyy: "W26",
  name: "WINTER 2026",
  firstDayOfClasses: "2026-01-05T00:00:00",
};

let queryClient;

/** Once the query's answer has arrived and been drawn, whatever it was. */
const fetched = async (key) => {
  await waitFor(() =>
    expect(queryClient.getQueryState(key)?.dataUpdateCount).toBeGreaterThan(0),
  );
  await act(async () => {});
};

function renderCard(props = { testIdPrefix: "Card" }) {
  queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <FeedbackNotesEditorCard {...props} />
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}

/** The editor once the history has arrived and shows the current version. */
const editorWith = async (text) => {
  const editor = await screen.findByTestId("mde");
  await waitFor(() => expect(editor).toHaveValue(text));
  return editor;
};

describe("FeedbackNotesEditorCard (issue #429)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(HISTORY_URL).reply(200, history);
    // Newest first, as the Budget page's list of quarters is.
    axiosMock.onGet("/api/admin/budget/quarters").reply(200, [
      { quarter: "20261", hasTa: true, hasUla: true },
      { quarter: "20214", hasTa: true, hasUla: false },
    ]);
    axiosMock
      .onGet("/api/quarters/one", { params: { yyyyq: "20261" } })
      .reply(200, w26Calendar);
    axiosMock
      .onGet("/api/quarters/one", { params: { yyyyq: "20214" } })
      .reply(200, quartersFixtures.f21);
    axiosMock.onGet(COSTS_URL, { params: { quarter: "20261" } }).reply(200, {
      quarter: "20261",
      estimatedCostPerTA: 12000,
      estimatedCostPerULA: 2000,
    });
    axiosMock.onGet(COSTS_URL, { params: { quarter: "20214" } }).reply(200, {
      quarter: "20214",
      estimatedCostPerTA: 9000,
      estimatedCostPerULA: null,
    });
  });

  test("shows the current version in the editor, and every version with who saved it", async () => {
    renderCard();

    expect(screen.getByTestId("Card")).toHaveClass("card", "mb-4");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Notes on TA/ULA tradeoffs",
      }),
    ).toHaveClass("h5", "mb-0");
    await editorWith(v2.notesText);
    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      "Current: Version 2, saved 11/10/2026, 2:30:05 PM",
    );
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();

    const table = screen.getByTestId("Card-history");
    expect(
      [...table.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual(["Version", "Saved", "Editor", "Length"]);
    expect(
      [...screen.getByTestId("Card-history-row-0").querySelectorAll("td")].map(
        (td) => td.textContent,
      ),
    ).toEqual([
      "2",
      "11/10/2026, 2:30:05 PM",
      "admin@ucsb.edu",
      `${v2.notesText.length} characters`,
    ]);
    // The version the app was installed with has no editor.
    expect(
      [...screen.getByTestId("Card-history-row-1").querySelectorAll("td")].map(
        (td) => td.textContent,
      ),
    ).toEqual([
      "1",
      "11/9/2026, 8:00:00 AM",
      "(installed with the app)",
      `${v1.notesText.length} characters`,
    ]);
  });

  test("explains where the notes are shown, and links to Markdown and the fields help", async () => {
    renderCard();

    const markdown = screen.getByTestId("Card-markdown-link");
    expect(markdown).toHaveAttribute("href", "/help/admins#markdown");
    expect(markdown).toHaveAttribute("target", "_blank");
    expect(markdown).toHaveAttribute("rel", "noreferrer");
    expect(markdown.parentElement).toHaveTextContent(
      "Shown to every instructor under the feedback form on their course's allocation, on their home page, in a section they open themselves. Written in Markdown; the preview on the right is what instructors see. Each save is kept as a new version; instructors always see the newest.",
    );
    expect(markdown.parentElement).toHaveClass("text-muted", "small");
    const hint = screen.getByTestId("Card-fields-hint");
    expect(hint).toHaveTextContent(
      "Write ${estimatedCostPerTA}, ${estimatedCostPerULA} or ${taToUlaCostRatio} and each instructor sees",
    );
    expect(hint.textContent).toMatch(
      /chosen above it\. All the fields, with examples\.$/,
    );
    expect(hint).toHaveClass("text-muted", "small");
    const fields = within(hint).getByRole("link", {
      name: "All the fields, with examples",
    });
    expect(fields).toHaveAttribute("href", "/help/instructor-feedback-fields");
    expect(fields).toHaveAttribute("target", "_blank");
    expect(fields).toHaveAttribute("rel", "noreferrer");
  });

  test("the preview is filled in for the newest quarter with a recruitment: its name, dates and costs", async () => {
    renderCard();
    await editorWith(v2.notesText);

    const box = screen.getByLabelText("Preview for quarter:");
    expect(box).toBe(screen.getByTestId("Card-preview-quarter"));
    expect(box.id).toBe("Card-preview-quarter");
    expect(box).toHaveValue("20261");
    expect(box).toHaveClass("form-select-sm");
    expect(box.style.width).toBe("8em");
    expect([...box.options].map((o) => [o.value, o.textContent])).toEqual([
      ["20261", "W26"],
      ["20214", "F21"],
    ]);
    const preview = screen.getByTestId("Card-preview");
    await waitFor(() =>
      expect(preview.querySelector("h2")).toHaveTextContent(
        "Tradeoffs for Winter 2026",
      ),
    );
    await waitFor(() =>
      expect(
        [...preview.querySelectorAll("li")].map((li) => li.textContent),
      ).toEqual([
        "A TA costs $12,000.00",
        "A ULA costs $2,000.00",
        "So the ratio is 1:6.0",
      ]),
    );
    await waitFor(() =>
      expect(preview.querySelector("p")).toHaveTextContent(
        "Classes begin January 5, 2026.",
      ),
    );
    expect(gets(COSTS_URL)[0].params).toEqual({ quarter: "20261" });
    expect(screen.queryByTestId(/Card-unknown-field-/)).toBeNull();
    expect(screen.queryByTestId("Card-preview-no-quarter")).toBeNull();
  });

  test("choosing another quarter fills the preview with that quarter's values", async () => {
    renderCard();
    await editorWith(v2.notesText);
    const preview = screen.getByTestId("Card-preview");
    await waitFor(() =>
      expect(preview.querySelector("li")).toHaveTextContent(
        "A TA costs $12,000.00",
      ),
    );

    await userEvent.selectOptions(
      screen.getByTestId("Card-preview-quarter"),
      "20214",
    );

    expect(screen.getByTestId("Card-preview-quarter")).toHaveValue("20214");
    await waitFor(() =>
      expect(
        [...preview.querySelectorAll("li")].map((li) => li.textContent),
      ).toEqual([
        "A TA costs $9,000.00",
        "A ULA costs not yet set",
        "So the ratio is not yet set",
      ]),
    );
    expect(preview.querySelector("h2")).toHaveTextContent(
      "Tradeoffs for Fall 2021",
    );
    await waitFor(() =>
      expect(preview.querySelector("p")).toHaveTextContent(
        "Classes begin October 1, 2021.",
      ),
    );
  });

  test("with no quarter to preview, the fields are shown as written and no costs are asked for", async () => {
    axiosMock.onGet("/api/admin/budget/quarters").reply(200, []);
    renderCard();
    await editorWith(v2.notesText);
    await fetched(["/api/admin/budget/quarters"]);

    expect(screen.getByTestId("Card-preview-no-quarter")).toHaveTextContent(
      "No quarter has a recruitment yet, so the fields are shown as written.",
    );
    expect(screen.getByTestId("Card-preview-no-quarter")).toHaveClass(
      "text-muted",
      "small",
    );
    expect(screen.queryByTestId("Card-preview-quarter")).toBeNull();
    const preview = screen.getByTestId("Card-preview");
    expect(preview.querySelector("h2")).toHaveTextContent(
      "Tradeoffs for ${quarter}",
    );
    expect(preview.querySelector("li")).toHaveTextContent(
      "A TA costs ${estimatedCostPerTA}",
    );
    expect(gets(COSTS_URL)).toHaveLength(0);
    expect(gets("/api/quarters/one")).toHaveLength(0);
  });

  test("a list of quarters that is not a list is no quarters", async () => {
    axiosMock.onGet("/api/admin/budget/quarters").reply(200, { nope: true });
    renderCard();
    await editorWith(v2.notesText);
    await fetched(["/api/admin/budget/quarters"]);

    expect(screen.getByTestId("Card-preview-no-quarter")).toBeInTheDocument();
  });

  test("a failed costs request is reported", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    axiosMock.onGet(COSTS_URL, { params: { quarter: "20261" } }).reply(500);
    renderCard();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/admin/instructorFeedbackSettings/costs",
      ),
    );
  });

  test("the recruitment's deadline is not a field of the notes: it is flagged, with a link to these fields", async () => {
    axiosMock.onGet(HISTORY_URL).reply(200, [
      {
        ...v2,
        notesText: "Apply by ${primaryConsiderationDate} in ${quarter}.",
      },
    ]);
    renderCard();
    const preview = screen.getByTestId("Card-preview");

    await waitFor(() =>
      expect(preview).toHaveTextContent(
        "Apply by ${primaryConsiderationDate} in Winter 2026.",
      ),
    );
    expect(preview.querySelector("span.text-danger")).toHaveTextContent(
      "${primaryConsiderationDate}",
    );
    const message = screen.getByTestId(
      "Card-unknown-field-primaryConsiderationDate",
    );
    expect(message).toHaveTextContent(
      "Unknown ${primaryConsiderationDate}; see documentation",
    );
    expect(
      within(message).getByRole("link", { name: "documentation" }),
    ).toHaveAttribute("href", "/help/instructor-feedback-fields");
  });

  test("saving posts the trimmed notes as a new version, then refreshes the history", async () => {
    axiosMock
      .onPost("/api/admin/instructorFeedbackSettings")
      .reply(200, { ...v2, id: 3, notesText: "New notes" });
    const invalidateQueriesSpy = renderCard();
    const editor = await editorWith(v2.notesText);

    await userEvent.clear(editor);
    await userEvent.type(editor, "  New notes  ");
    expect(screen.getByTestId("Card-save-button")).toBeEnabled();
    await userEvent.click(screen.getByTestId("Card-save-button"));

    await waitFor(() => expect(axiosMock.history.post).toHaveLength(1));
    const request = axiosMock.history.post[0];
    expect(request.url).toBe("/api/admin/instructorFeedbackSettings");
    expect(request.params).toBeUndefined();
    expect(JSON.parse(request.data)).toEqual({ notesText: "New notes" });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Saved version 3 of the notes on TA/ULA tradeoffs",
      ),
    );
    await waitFor(() =>
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: [HISTORY_URL],
      }),
    );
    // The draft is dropped: the editor shows the (refetched) current version again.
    await waitFor(() => expect(editor).toHaveValue(v2.notesText));
  });

  test("a refused save keeps the typed text", async () => {
    axiosMock
      .onPost("/api/admin/instructorFeedbackSettings")
      .reply(400, { message: "The notes cannot be blank" });
    renderCard();
    const editor = await editorWith(v2.notesText);

    await userEvent.type(editor, "!");
    await userEvent.click(screen.getByTestId("Card-save-button"));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.stringContaining("Saved version"),
    );
    expect(editor).toHaveValue(v2.notesText + "!");
  });

  test("a saved version that ends in whitespace is unchanged until edited", async () => {
    axiosMock
      .onGet(HISTORY_URL)
      .reply(200, [{ ...v2, notesText: "Saved notes  \n" }]);
    renderCard();
    const editor = await editorWith("Saved notes  \n");

    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
    await userEvent.type(editor, "!");
    expect(screen.getByTestId("Card-save-button")).toBeEnabled();
  });

  test("with no versions the editor is empty and says instructors see no notes", async () => {
    axiosMock.onGet(HISTORY_URL).reply(200, []);
    renderCard();
    await fetched([HISTORY_URL]);

    expect(screen.getByTestId("mde")).toHaveValue("");
    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      "No version saved yet: instructors are not shown any notes.",
    );
    expect(screen.queryByTestId("Card-history")).toBeNull();
  });

  test("tolerates a history that is not a list", async () => {
    axiosMock.onGet(HISTORY_URL).reply(200, { nope: true });
    renderCard();

    await fetched([HISTORY_URL]);
    expect(screen.getByTestId("Card-preview-empty")).toBeInTheDocument();
    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      "No version saved yet",
    );
  });

  test("uses FeedbackNotesEditorCard as the default test id prefix", async () => {
    renderCard({});
    expect(
      await screen.findByTestId("FeedbackNotesEditorCard-save-button"),
    ).toBeInTheDocument();
  });
});
