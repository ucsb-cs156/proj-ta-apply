import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import NoticeEditorCard from "main/components/Notices/NoticeEditorCard";
import noticesFixtures from "fixtures/noticesFixtures";
import quartersFixtures from "fixtures/quartersFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
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

const historyGets = () =>
  axiosMock.history.get.filter((r) => r.url === "/api/admin/notices/all");

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
    axiosMock.onGet("/api/admin/quarters/all").reply(200, []);
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    // 2026-02-10 is in Winter 2026, so the preview defaults to Spring 2026 (S26).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 1, 10, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
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
      "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place; the various dates of that quarter, such as ${firstDayOfClasses}, can be inserted the same way. The preview fills them in for the quarter chosen above it. All the fields, with examples.",
    );
    const fields = within(hint).getByRole("link", {
      name: "All the fields, with examples",
    });
    expect(fields).toHaveAttribute("href", "/help/notice-fields");
    // Issue #192: in a new tab, so the admin does not lose their place.
    expect(fields).toHaveAttribute("target", "_blank");
    expect(fields).toHaveAttribute("rel", "noreferrer");
    const markdown = screen.getByTestId("Card-markdown-link");
    expect(markdown).toHaveTextContent("Markdown");
    expect(markdown).toHaveAttribute("href", "/help/admins#markdown");
    expect(markdown).toHaveAttribute("target", "_blank");
    expect(markdown).toHaveAttribute("rel", "noreferrer");
    expect(markdown.parentElement).toHaveTextContent(
      "Written in Markdown; the preview on the right is what applicants see.",
    );
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

    await waitFor(() => expect(historyGets()).toHaveLength(1));
    expect(screen.getByTestId("Card-preview-empty")).toBeInTheDocument();
  });

  test("typing updates the preview and enables Save; blank or unchanged text does not", async () => {
    axiosMock.onGet("/api/admin/notices/all").reply(200, []);
    renderCard("TA");
    await waitFor(() => expect(historyGets()).toHaveLength(1));

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
    await waitFor(() => expect(historyGets()).toHaveLength(1));

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

  // ---- Issue #192: the preview quarter and unknown fields ----

  // The quarter calendar with rows for W26 and S26, the quarters of the recruitment fixtures.
  const quartersWithRecruitments = () => {
    axiosMock
      .onGet("/api/admin/quarters/all")
      .reply(200, [
        { ...quartersFixtures.f21, quarter: "20262", qyy: "S26" },
        { ...quartersFixtures.f21, quarter: "20261", qyy: "W26" },
        quartersFixtures.f21,
      ]);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, recruitmentsFixtures.threeRecruitments);
  };

  test("the quarter box defaults to the quarter after today's, and asks for the calendar and recruitments", async () => {
    renderCard("TA");

    const box = await screen.findByLabelText("Preview for quarter:");
    expect(box).toBe(screen.getByTestId("Card-preview-quarter"));
    expect(box.id).toBe("Card-preview-quarter");
    expect(box).toHaveValue("20262");
    expect(box).toHaveClass("form-select-sm");
    expect(box.style.width).toBe("8em");
    // Nothing on file: the chosen quarter is the only option, and both notes show.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/quarters/all",
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.get.find((r) => r.url === "/api/admin/quarters/all")
        .params,
    ).toEqual({ direction: "desc" });
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/admin/recruitments/all",
      ),
    ).toHaveLength(1);
    expect([...box.options].map((o) => [o.value, o.textContent])).toEqual([
      ["20262", "S26"],
    ]);
    expect(screen.getByTestId("Card-preview-no-calendar")).toHaveTextContent(
      "The quarter calendar for S26 is not on file (see Admin → Quarters), so its dates are shown as written.",
    );
    expect(screen.getByTestId("Card-preview-no-recruitment")).toHaveTextContent(
      "No TA recruitment for S26 yet, so ${primaryConsiderationDate} is shown as written.",
    );
  });

  test("the default quarter follows the date: a September day previews for the Winter after", () => {
    vi.setSystemTime(new Date(2026, 8, 15));
    renderCard("ULA");
    expect(screen.getByTestId("Card-preview-quarter")).toHaveValue("20271");
  });

  test("lists the quarters on file, keeping the chosen one when it is not among them", async () => {
    axiosMock
      .onGet("/api/admin/quarters/all")
      .reply(200, quartersFixtures.threeNewestFirst);
    renderCard("TA");

    const box = screen.getByTestId("Card-preview-quarter");
    await waitFor(() => expect(box.options).toHaveLength(4));
    expect([...box.options].map((o) => o.textContent)).toEqual([
      "S26",
      "S22",
      "W22",
      "F21",
    ]);
    expect(box).toHaveValue("20262");

    // Choosing a quarter that is on file drops the extra option and the note.
    await userEvent.selectOptions(box, "20214");
    expect(box).toHaveValue("20214");
    expect([...box.options].map((o) => o.textContent)).toEqual([
      "S22",
      "W22",
      "F21",
    ]);
    expect(screen.queryByTestId("Card-preview-no-calendar")).toBeNull();
  });

  test("the preview fills the quarter, its calendar dates and the recruitment's deadline for the chosen quarter", async () => {
    quartersWithRecruitments();
    axiosMock.onGet("/api/admin/notices/all").reply(200, [
      {
        ...noticesFixtures.taV1,
        content:
          "Apply by ${primaryConsiderationDate} for ${quarter} (${qyy}); classes start ${firstDayOfClasses}.",
      },
    ]);
    renderCard("TA");
    const preview = screen.getByTestId("Card-preview");

    // S26 (20262): the TA recruitment 3 has that quarter, and the calendar has a row for it.
    await waitFor(() =>
      expect(preview).toHaveTextContent(
        "Apply by April 15, 2026 for Spring 2026 (S26); classes start October 1, 2021.",
      ),
    );
    expect(screen.queryByTestId("Card-preview-no-recruitment")).toBeNull();
    expect(screen.queryByTestId("Card-preview-no-calendar")).toBeNull();
    // Known fields without a value are not red and raise no message.
    expect(preview.querySelector(".text-danger")).toBeNull();
    expect(screen.queryByTestId(/Card-unknown-field-/)).toBeNull();

    // F21 (20214): a calendar row but no recruitment.
    await userEvent.selectOptions(
      screen.getByTestId("Card-preview-quarter"),
      "20214",
    );
    expect(preview).toHaveTextContent(
      "Apply by ${primaryConsiderationDate} for Fall 2021 (F21); classes start October 1, 2021.",
    );
    expect(screen.getByTestId("Card-preview-no-recruitment")).toHaveTextContent(
      "No TA recruitment for F21 yet",
    );
    expect(screen.queryByTestId("Card-preview-no-calendar")).toBeNull();
  });

  test("the recruitment used for the deadline is the one of this card's type", async () => {
    quartersWithRecruitments();
    axiosMock
      .onGet("/api/admin/notices/all")
      .reply(200, [
        { ...noticesFixtures.taV1, content: "By ${primaryConsiderationDate}." },
      ]);
    renderCard("ULA");
    const box = screen.getByTestId("Card-preview-quarter");

    // W26 has both a TA (id 1) and a ULA (id 2) recruitment; the ULA card uses the ULA one.
    await waitFor(() => expect(box.options.length).toBeGreaterThan(1));
    await userEvent.selectOptions(box, "20261");
    await waitFor(() =>
      expect(screen.getByTestId("Card-preview")).toHaveTextContent(
        "By January 20, 2026.",
      ),
    );
    // S26 has only a TA recruitment, so the ULA card shows the field as written.
    await userEvent.selectOptions(box, "20262");
    expect(screen.getByTestId("Card-preview")).toHaveTextContent(
      "By ${primaryConsiderationDate}.",
    );
    expect(screen.getByTestId("Card-preview-no-recruitment")).toHaveTextContent(
      "No ULA recruitment for S26 yet",
    );
  });

  test("an unknown field is shown in red in the preview, with a message linking to the documentation", async () => {
    axiosMock.onGet("/api/admin/notices/all").reply(200, [
      {
        ...noticesFixtures.taV1,
        content:
          "Due ${deadline} in ${quarter}. Also ${deadline} and [a real link](https://example.com).",
      },
    ]);
    renderCard("TA");
    const preview = screen.getByTestId("Card-preview");

    await waitFor(() =>
      expect(preview).toHaveTextContent(
        "Due ${deadline} in Spring 2026. Also ${deadline} and a real link.",
      ),
    );
    const red = [...preview.querySelectorAll("span.text-danger")];
    expect(red.map((span) => span.textContent)).toEqual([
      "${deadline}",
      "${deadline}",
    ]);
    red.forEach((span) => expect(span).toHaveClass("fw-bold"));
    // The marker never reaches the DOM as a link, and ordinary links still render as links.
    expect(preview.querySelector('a[title="unknown-notice-field"]')).toBeNull();
    expect(
      within(preview).getByRole("link", { name: "a real link" }),
    ).toHaveAttribute("href", "https://example.com");

    const message = screen.getByTestId("Card-unknown-field-deadline");
    expect(message).toHaveTextContent("Unknown ${deadline}; see documentation");
    expect(message).toHaveClass("text-danger");
    const link = within(message).getByRole("link", { name: "documentation" });
    expect(link).toHaveAttribute("href", "/help/notice-fields");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link).toHaveClass("text-danger");
    expect(screen.getAllByTestId(/^Card-unknown-field-/)).toHaveLength(1);
  });

  test("typing an unknown field adds its message at once; fixing it removes it", async () => {
    renderCard("TA");
    const editor = await screen.findByTestId("mde");
    await waitFor(() =>
      expect(editor).toHaveValue(noticesFixtures.taV2.content),
    );

    await userEvent.clear(editor);
    await userEvent.paste("See ${Quarter}.");
    expect(screen.getByTestId("Card-unknown-field-Quarter")).toHaveTextContent(
      "Unknown ${Quarter}; see documentation",
    );
    expect(
      screen.getByTestId("Card-preview").querySelector("span.text-danger"),
    ).toHaveTextContent("${Quarter}");

    await userEvent.clear(editor);
    await userEvent.paste("See ${quarter}.");
    expect(screen.queryByTestId(/^Card-unknown-field-/)).toBeNull();
    expect(screen.getByTestId("Card-preview")).toHaveTextContent(
      "See Spring 2026.",
    );
    expect(
      screen.getByTestId("Card-preview").querySelector(".text-danger"),
    ).toBeNull();
  });
});
