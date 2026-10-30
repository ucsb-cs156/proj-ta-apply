import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import NoticeEditorCard from "main/components/Notices/NoticeEditorCard";
import noticesFixtures from "fixtures/noticesFixtures";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

// The real editor is CodeMirror, which cannot be typed into under jsdom. A textarea that honours
// the same value/onChange contract lets these tests drive the card; the editor's own options are
// checked by the story and the integration test.
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

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");

const axiosMock = new AxiosMockAdapter(axios);

function renderCard(type = "TA") {
  const queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NoticeEditorCard type={type} testIdPrefix="Card" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}

describe("NoticeEditorCard tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    useBackendSpy.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/admin/notices/all")
      .reply(200, noticesFixtures.taHistory);
  });

  test("loads the history for its type and shows the current version in the editor", async () => {
    renderCard("TA");

    expect(screen.getByTestId("Card")).toHaveClass("card");
    expect(
      screen.getByRole("heading", { name: "Notices, Terms and Conditions" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        noticesFixtures.taV2.content,
      ),
    );
    expect(axiosMock.history.get[0].url).toBe("/api/admin/notices/all");
    expect(axiosMock.history.get[0].params).toEqual({ type: "TA" });
    expect(useBackendSpy).toHaveBeenCalledWith(
      ["/api/admin/notices/all", "TA"],
      { method: "GET", url: "/api/admin/notices/all", params: { type: "TA" } },
      [],
    );
    expect(screen.getByTestId("Card-editor")).toContainElement(
      screen.getByTestId("mde"),
    );

    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      `Current: Version 2, saved ${new Date("2026-02-03T04:05:06").toLocaleString()}`,
    );
    // The preview renders the Markdown.
    expect(
      screen.getByTestId("Card-preview").querySelector("h1"),
    ).toHaveTextContent("TA Terms");
    expect(screen.queryByTestId("Card-preview-empty")).toBeNull();
    // Nothing changed yet, so nothing to save.
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
  });

  test("configures the editor without spell check or status bar and with a fixed toolbar", async () => {
    renderCard("TA");
    await screen.findByTestId("mde");

    expect(JSON.parse(screen.getByTestId("mde").dataset.options)).toEqual({
      spellChecker: false,
      status: false,
      toolbar: [
        "bold",
        "italic",
        "heading",
        "|",
        "quote",
        "unordered-list",
        "ordered-list",
        "|",
        "link",
        "table",
        "|",
        "undo",
        "redo",
      ],
      minHeight: "200px",
    });
  });

  /** Issue #150: the fields are explained beside the editor, with a link to the help page. */
  test("explains the two fields beside the editor and links to the help page", async () => {
    renderCard();
    const hint = await screen.findByTestId("Card-fields-hint");
    expect(hint).toHaveTextContent(
      "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place; the various dates of that quarter, such as ${firstDayOfClasses}, can be inserted the same way. The preview shows them as written. All the fields, with examples.",
    );
    expect(
      within(hint).getByRole("link", { name: "All the fields, with examples" }),
    ).toHaveAttribute("href", "/help/notice-fields");
  });

  test("the preview renders GitHub-flavoured Markdown", async () => {
    axiosMock
      .onGet("/api/admin/notices/all")
      .reply(200, [noticesFixtures.taV1]);
    renderCard("TA");

    await waitFor(() =>
      expect(
        screen.getByTestId("Card-preview").querySelector("del"),
      ).toHaveTextContent("Readers exempt."),
    );
  });

  test("trailing whitespace is not a change worth saving", async () => {
    renderCard("TA");
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        noticesFixtures.taV2.content,
      ),
    );

    await userEvent.type(screen.getByTestId("mde"), "   ");
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();

    // Wiping the text down to whitespace is a change, but not one that can be saved.
    await userEvent.clear(screen.getByTestId("mde"));
    await userEvent.type(screen.getByTestId("mde"), "  ");
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
    expect(screen.getByTestId("Card-preview-empty")).toBeInTheDocument();
  });

  test("lists every version newest first", async () => {
    renderCard("TA");

    const row0 = await screen.findByTestId("Card-history-row-0");
    expect(row0).toHaveTextContent("2");
    expect(row0).toHaveTextContent(
      new Date("2026-02-03T04:05:06").toLocaleString(),
    );
    expect(row0).toHaveTextContent(
      `${noticesFixtures.taV2.content.length} characters`,
    );
    expect(screen.getByTestId("Card-history-row-1")).toHaveTextContent("1");
    expect(
      [...screen.getByTestId("Card-history").querySelectorAll("thead th")].map(
        (th) => th.textContent,
      ),
    ).toEqual(["Version", "Saved", "Length"]);
  });

  test("with no versions yet the editor is empty and says so", async () => {
    axiosMock.onGet("/api/admin/notices/all").reply(200, []);
    renderCard("ULA");

    await waitFor(() =>
      expect(axiosMock.history.get[0].params).toEqual({ type: "ULA" }),
    );
    expect(screen.getByTestId("mde")).toHaveValue("");
    expect(screen.getByTestId("Card-preview-empty")).toHaveTextContent(
      "Nothing written yet.",
    );
    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      "No version saved yet: applicants are not shown a notice.",
    );
    expect(screen.queryByTestId("Card-history")).toBeNull();
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
  });

  test("tolerates a non-array history response", async () => {
    axiosMock.onGet("/api/admin/notices/all").reply(200, { nope: true });
    renderCard("ULA");

    await waitFor(() => expect(axiosMock.history.get.length).toBe(1));
    expect(screen.getByTestId("Card-preview-empty")).toBeInTheDocument();
  });

  test("typing updates the preview and enables Save; blank or unchanged text does not", async () => {
    axiosMock.onGet("/api/admin/notices/all").reply(200, []);
    renderCard("TA");
    await waitFor(() => expect(axiosMock.history.get.length).toBe(1));

    const editor = screen.getByTestId("mde");
    await userEvent.type(editor, "   ");
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
    // Whitespace is nothing, in the preview too.
    expect(screen.getByTestId("Card-preview-empty")).toBeInTheDocument();

    await userEvent.clear(editor);
    await userEvent.type(editor, "# Hello");
    expect(
      screen.getByTestId("Card-preview").querySelector("h1"),
    ).toHaveTextContent("Hello");
    expect(screen.getByTestId("Card-save-button")).toBeEnabled();
  });

  test("retyping exactly the current text leaves Save disabled", async () => {
    renderCard("TA");
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        noticesFixtures.taV2.content,
      ),
    );

    await userEvent.type(screen.getByTestId("mde"), "!");
    expect(screen.getByTestId("Card-save-button")).toBeEnabled();
    await userEvent.type(screen.getByTestId("mde"), "{backspace}");
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
  });

  test("saving posts the trimmed text as a new version for the type, then refreshes", async () => {
    axiosMock
      .onPost("/api/admin/notices")
      .reply(200, { ...noticesFixtures.taV2, id: 3, content: "# New terms" });
    const invalidateQueriesSpy = renderCard("TA");
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        noticesFixtures.taV2.content,
      ),
    );

    await userEvent.clear(screen.getByTestId("mde"));
    await userEvent.type(screen.getByTestId("mde"), "  # New terms  ");
    await userEvent.click(screen.getByTestId("Card-save-button"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    const request = axiosMock.history.post[0];
    expect(request.url).toBe("/api/admin/notices");
    expect(request.params).toEqual({ type: "TA" });
    expect(JSON.parse(request.data)).toEqual({ content: "# New terms" });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Saved version 3 of the TA notices",
      ),
    );
    await waitFor(() =>
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["/api/admin/notices/all"],
      }),
    );
    // The draft is dropped: the editor shows the (refetched) current version again.
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        noticesFixtures.taV2.content,
      ),
    );
  });

  test("a refused save keeps the typed text", async () => {
    axiosMock
      .onPost("/api/admin/notices")
      .reply(400, { message: "The notice text cannot be blank" });
    axiosMock.onGet("/api/admin/notices/all").reply(200, []);
    renderCard("ULA");
    await waitFor(() => expect(axiosMock.history.get.length).toBe(1));

    await userEvent.type(screen.getByTestId("mde"), "Draft");
    await userEvent.click(screen.getByTestId("Card-save-button"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.stringContaining("Saved version"),
    );
    expect(screen.getByTestId("mde")).toHaveValue("Draft");
  });

  test("uses NoticeEditorCard as the default test id prefix", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <NoticeEditorCard type="TA" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByTestId("NoticeEditorCard-save-button"),
    ).toBeInTheDocument();
  });
});
