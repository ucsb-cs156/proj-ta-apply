import { render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import SoftOfferNoticeEditorCard from "main/components/Notices/SoftOfferNoticeEditorCard";
import softOfferNoticeFixtures from "fixtures/softOfferNoticeFixtures";
import quartersFixtures from "fixtures/quartersFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

// The real editor is CodeMirror, which cannot be typed into under jsdom (see NoticeEditorCard's
// tests): a textarea that honours the same value/onChange contract drives the card.
vi.mock("react-simplemde-editor", () => ({
  default: ({ value, onChange }) => (
    <textarea
      data-testid="mde"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");
const axiosMock = new AxiosMockAdapter(axios);
const HISTORY = "/api/admin/softOfferNotices/all";
const SAVE = "/api/admin/softOfferNotices";

const historyGets = () =>
  axiosMock.history.get.filter((r) => r.url === HISTORY);

function renderCard(props = { testIdPrefix: "Card" }) {
  const queryClient = new QueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SoftOfferNoticeEditorCard {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return invalidateQueriesSpy;
}

describe("SoftOfferNoticeEditorCard tests (issue #484)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    useBackendSpy.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(HISTORY).reply(200, softOfferNoticeFixtures.history);
    axiosMock.onGet("/api/admin/quarters/all").reply(200, []);
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
    // 2026-02-10 is in Winter 2026, so the preview defaults to Spring 2026 (S26).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 1, 10, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("is a card headed Soft Offer Notices that explains the text and the two choices", async () => {
    renderCard();

    expect(screen.getByTestId("Card")).toHaveClass("card");
    expect(
      screen.getByRole("heading", { name: "Soft Offer Notices" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Card-explanation")).toHaveTextContent(
      "When the optional “Release Soft Offers” feature is used, this text is shown to ULA applicants who have been assigned to a course. The applicant is asked to choose either:",
    );
    expect(
      within(screen.getByTestId("Card-choices"))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "( ) Please proceed with a formal offer; I am likely to accept.",
      "( ) I would like to decline this offer.",
    ]);
    const markdown = screen.getByTestId("Card-markdown-link");
    expect(markdown).toHaveTextContent("Markdown");
    expect(markdown).toHaveAttribute("href", "/help/admins#markdown");
    expect(markdown).toHaveAttribute("target", "_blank");
    expect(markdown).toHaveAttribute("rel", "noreferrer");
    expect(markdown.parentElement).toHaveTextContent(
      "Written in Markdown; the preview on the right is what applicants see. Each save is kept as a new version, so a response can always show the exact text its applicant read.",
    );
    const hint = screen.getByTestId("Card-fields-hint");
    expect(hint).toHaveTextContent(
      "Write ${quarter} or ${primaryConsiderationDate} and each applicant sees their recruitment's quarter (e.g. Winter 2026) or primary consideration date (e.g. January 20, 2026) in its place; the various dates of that quarter, such as ${firstDayOfClasses}, can be inserted the same way. The preview fills them in for the quarter chosen above it. All the fields, with examples.",
    );
    const fields = within(hint).getByRole("link", {
      name: "All the fields, with examples",
    });
    expect(fields).toHaveAttribute("href", "/help/notice-fields");
    expect(fields).toHaveAttribute("target", "_blank");
    expect(fields).toHaveAttribute("rel", "noreferrer");
  });

  test("loads the history and shows the current version in the editor, every version newest first", async () => {
    renderCard();

    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        softOfferNoticeFixtures.v2.content,
      ),
    );
    expect(historyGets()).toHaveLength(1);
    expect(historyGets()[0].params).toBeUndefined();
    // Keyed by the URL alone, which a save invalidates.
    expect(useBackendSpy).toHaveBeenCalledWith(
      [HISTORY],
      expect.objectContaining({ url: HISTORY }),
      [],
    );
    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      "Version 2, saved 3/2/2026, 10:30:00 AM",
    );
    expect(
      screen.getByTestId("Card-preview").querySelector("h1"),
    ).toHaveTextContent("Congratulations");
    const rows = screen
      .getByTestId("Card-history")
      .querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("2");
    expect(rows[1]).toHaveTextContent("1");
    expect(screen.getByTestId("Card-save-button")).toBeDisabled();
  });

  test("with no versions yet the editor is empty and says what a soft offer then shows", async () => {
    axiosMock.onGet(HISTORY).reply(200, []);
    renderCard();

    await waitFor(() => expect(historyGets()).toHaveLength(1));
    expect(screen.getByTestId("mde")).toHaveValue("");
    expect(screen.getByTestId("Card-current")).toHaveTextContent(
      "No version saved yet: a soft offer shows the course details and the question without a notice.",
    );
    expect(screen.getByTestId("Card-preview-empty")).toBeInTheDocument();
  });

  test("tolerates a non-array history response", async () => {
    axiosMock.onGet(HISTORY).reply(200, { nope: true });
    renderCard();

    await waitFor(() => expect(historyGets()).toHaveLength(1));
    expect(screen.getByTestId("mde")).toHaveValue("");
  });

  test("saving posts the trimmed text as a new version, toasts, and refreshes the history", async () => {
    axiosMock.onPost(SAVE).reply(200, { ...softOfferNoticeFixtures.v2, id: 3 });
    const invalidateQueriesSpy = renderCard();
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        softOfferNoticeFixtures.v2.content,
      ),
    );

    const editor = screen.getByTestId("mde");
    await userEvent.clear(editor);
    await userEvent.type(editor, "  # New text  ");
    expect(screen.getByTestId("Card-save-button")).toBeEnabled();
    await userEvent.click(screen.getByTestId("Card-save-button"));

    await waitFor(() => expect(axiosMock.history.post).toHaveLength(1));
    expect(axiosMock.history.post[0].url).toBe(SAVE);
    expect(axiosMock.history.post[0].params).toBeUndefined();
    expect(JSON.parse(axiosMock.history.post[0].data)).toEqual({
      content: "# New text",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Saved version 3 of the soft offer notices",
      ),
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: [HISTORY],
    });
    // The draft is dropped: the editor shows the (refetched) current version again.
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        softOfferNoticeFixtures.v2.content,
      ),
    );
  });

  test("a refused save keeps the typed text", async () => {
    axiosMock
      .onPost(SAVE)
      .reply(400, { message: "The notice text cannot be blank" });
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId("mde")).toHaveValue(
        softOfferNoticeFixtures.v2.content,
      ),
    );

    const editor = screen.getByTestId("mde");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Kept");
    await userEvent.click(screen.getByTestId("Card-save-button"));

    await waitFor(() => expect(axiosMock.history.post).toHaveLength(1));
    expect(editor).toHaveValue("Kept");
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.stringMatching(/^Saved version/),
    );
  });

  test("the preview quarter box asks for the calendar and recruitments, and fills the fields for the ULA recruitment of the chosen quarter", async () => {
    axiosMock
      .onGet("/api/admin/quarters/all")
      .reply(200, quartersFixtures.threeNewestFirst);
    // A ULA recruitment for S26, the default preview quarter, and a TA one that must not be used.
    axiosMock.onGet("/api/admin/recruitments/all").reply(200, [
      { ...recruitmentsFixtures.threeRecruitments[0], quarter: "20262" },
      {
        ...recruitmentsFixtures.threeRecruitments[1],
        quarter: "20262",
        primaryConsiderationDate: "2026-04-01",
      },
    ]);
    axiosMock.onGet(HISTORY).reply(200, [
      {
        ...softOfferNoticeFixtures.v1,
        content: "For ${quarter}, apply by ${primaryConsiderationDate}.",
      },
    ]);
    renderCard();

    const box = await screen.findByLabelText("Preview for quarter:");
    expect(box).toBe(screen.getByTestId("Card-preview-quarter"));
    expect(box).toHaveValue("20262");
    await waitFor(() =>
      expect(
        axiosMock.history.get.find((r) => r.url === "/api/admin/quarters/all")
          .params,
      ).toEqual({ direction: "desc" }),
    );
    // S26 is not on file, so it heads the list; the three on file follow.
    await waitFor(() => expect(box.options).toHaveLength(4));
    const preview = screen.getByTestId("Card-preview");
    await waitFor(() =>
      expect(preview).toHaveTextContent(
        "For Spring 2026, apply by April 1, 2026.",
      ),
    );
    expect(screen.queryByTestId("Card-preview-no-recruitment")).toBeNull();
    expect(screen.getByTestId("Card-preview-no-calendar")).toHaveTextContent(
      "The quarter calendar for S26 is not on file",
    );

    // F21 (20214): on file, but no ULA recruitment.
    await userEvent.selectOptions(box, "20214");
    await waitFor(() =>
      expect(preview).toHaveTextContent(
        "For Fall 2021, apply by ${primaryConsiderationDate}.",
      ),
    );
    expect(screen.getByTestId("Card-preview-no-recruitment")).toHaveTextContent(
      "No ULA recruitment for F21 yet, so ${primaryConsiderationDate} is shown as written.",
    );
    expect(screen.queryByTestId("Card-preview-no-calendar")).toBeNull();
  });

  test("uses SoftOfferNoticeEditorCard as the default test id prefix", async () => {
    renderCard({});

    expect(screen.getByTestId("SoftOfferNoticeEditorCard")).toHaveClass("card");
    expect(
      screen.getByTestId("SoftOfferNoticeEditorCard-preview-quarter"),
    ).toBeInTheDocument();
    await waitFor(() => expect(historyGets()).toHaveLength(1));
  });
});
