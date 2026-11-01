import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import { DELETE_TOOLTIP } from "main/components/Recruitments/RecruitmentCardLayout";
import { applicationsText } from "main/utils/adminApplications";
import { SORT_KEYS, sortRecruitments } from "main/utils/recruitmentSort";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// Fixture order: S26 TA CLOSED (id 3), W26 ULA OPEN (id 2), W26 TA CLOSED (id 1).
const three = recruitmentsFixtures.threeRecruitments;

// The recruitments on screen, so the mocked steps endpoint can answer for any of them.
let rendered = three;

/** Every step that has a control, so a test can click any of them (issue #233). */
const stepsFor = (recruitment) => ({
  recruitmentId: recruitment.id,
  type: recruitment.type,
  steps: [
    { number: 1, done: true, label: `Created #${recruitment.id}` },
    {
      number: 2,
      done: false,
      label: "Tentative: 2026-01-05",
      action: "openApplications",
    },
    {
      number: 3,
      done: false,
      label: "Hiring Target: 1",
      titleLinks: [
        { text: "Budget", href: "/admin/budget/W26" },
        {
          text: "Allocations",
          href: `/admin/recruitments/${recruitment.id}/courses`,
        },
      ],
    },
    {
      number: 4,
      done: false,
      label: "Prim. Consid: 2026-01-20",
      action: "closeApplications",
    },
    {
      number: 5,
      done: false,
      label: "Not released yet",
      action: "allocationVisibility",
    },
    { number: 6, done: false, label: "Not opened yet", action: "openReviews" },
    {
      number: 7,
      done: false,
      label: "Not closed yet",
      action: "closeReviews",
      secondaryLink: {
        text: "(see rankings)",
        href: `/admin/recruitments/${recruitment.id}/courses`,
      },
    },
    {
      number: 8,
      done: false,
      label: "Still to assign: 1",
      href: `/admin/recruitments/${recruitment.id}/assignments`,
    },
    {
      number: 9,
      done: false,
      label: "Not released yet",
      action: "publishAssignments",
      secondaryLink: {
        text: "(see assignments)",
        href: `/admin/recruitments/${recruitment.id}/courses`,
      },
    },
  ],
});

const stepsUrl = /\/api\/admin\/recruitments\/(\d+)\/steps$/;
const stepsGets = (id) =>
  axiosMock.history.get.filter(
    (r) => r.url === `/api/admin/recruitments/${id}/steps`,
  );

/** The pathname the router is at, for the navigation tests. */
function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderCards(
  recruitments = three,
  onDeleteRequested = vi.fn(),
  applicationCounts = undefined,
) {
  rendered = Array.isArray(recruitments) ? recruitments : [];
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RecruitmentCards
          recruitments={recruitments}
          applicationCounts={applicationCounts}
          onDeleteRequested={onDeleteRequested}
          testIdPrefix="Cards"
        />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onDeleteRequested;
}

/**
 * The clickable title of one step of one card's diagram, once the steps have loaded, expanding
 * the card's panel first if it starts collapsed.
 */
async function stepButton(index, number) {
  const toggle = await screen.findByTestId(`Cards-card-${index}-steps-toggle`);
  if (toggle.getAttribute("aria-expanded") === "false") {
    await userEvent.click(toggle);
  }
  return screen.findByTestId(
    `Cards-card-${index}-steps-steps-step-${number}-action`,
  );
}

/** The quarter and type of each card, top to bottom. */
const order = () =>
  screen
    .getAllByTestId(/^Cards-card-\d+-card$/)
    .map(
      (card) =>
        within(card).getByTestId(/-quarter$/).textContent +
        " " +
        within(card).getByTestId(/-type$/).textContent,
    );

describe("RecruitmentCards tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(stepsUrl).reply((config) => {
      const id = Number(config.url.match(stepsUrl)[1]);
      const recruitment = rendered.find((r) => r.id === id);
      return recruitment === undefined
        ? [404, {}]
        : [200, stepsFor(recruitment)];
    });
    axiosMock.onPut("/api/admin/recruitments/status").reply(200, {});
    axiosMock.onPut("/api/admin/recruitments/reviewStatus").reply(200, {});
    axiosMock
      .onPut("/api/admin/recruitments/facultyRankingDeadline")
      .reply(200, {});
  });

  test("shows one card per recruitment, newest quarter first, TA before ULA", () => {
    renderCards();
    expect(order()).toEqual(["S26 TA", "W26 TA", "W26 ULA"]);
    expect(screen.queryByTestId("Cards-empty")).toBeNull();
  });

  test("a card has both statuses in its header and the dates in its body", () => {
    renderCards();
    // Card 2 is W26 ULA, OPEN (id 2).
    expect(screen.getByTestId("Cards-card-2-quarter")).toHaveTextContent("W26");
    expect(screen.getByTestId("Cards-card-2-type")).toHaveTextContent("ULA");
    const status = screen.getByTestId("Cards-card-2-applicationStatus");
    expect(status).toHaveTextContent("OPEN");
    expect(status).toHaveClass("badge", "bg-success");
    expect(screen.getByTestId("Cards-card-0-applicationStatus")).toHaveClass(
      "bg-secondary",
    );
    expect(
      screen.getByTestId("Cards-card-0-applicationStatus"),
    ).toHaveTextContent("CLOSED");

    expect(
      screen.getByTestId("Cards-card-2-tentativeOpeningDate"),
    ).toHaveTextContent("2026-01-05");
    expect(
      screen.getByTestId("Cards-card-2-primaryConsiderationDate"),
    ).toHaveTextContent("2026-01-20");
    expect(
      screen.getByTestId("Cards-card-2-actualOpeningDate"),
    ).toHaveTextContent("2026-01-07");
    expect(
      screen.getByTestId("Cards-card-2-actualClosingDate").textContent,
    ).toBe("");
    expect(screen.getByTestId("Cards-card-2-reviewStatus")).toHaveTextContent(
      "Faculty Reviews: Open",
    );
    expect(
      screen.getByTestId("Cards-card-2-facultyReviewOpeningDate"),
    ).toHaveTextContent("2026-01-08");
    expect(
      screen.getByTestId("Cards-card-2-facultyRankingDeadline"),
    ).toHaveTextContent("2026-02-15");
    // The labels sit beside the dates.
    const body = screen.getByTestId("Cards-card-2-card").querySelector("dl");
    expect(
      Array.from(body.querySelectorAll("dt")).map((dt) => dt.textContent),
    ).toEqual([
      "Tentative Opening:",
      "Primary Consideration:",
      "Actually Opened:",
      "Actually Closed:",
      "Faculty Reviews Opened:",
      "Faculty Ranking Deadline:",
    ]);
    expect(screen.getByTestId("Cards-card-2-card")).toHaveClass("card", "mb-3");
    // Wide enough for the diagram (issue #233): the full width, not capped at 48rem.
    expect(screen.getByTestId("Cards-card-2-card")).toHaveClass("w-100");
    expect(screen.getByTestId("Cards-card-2-card").style.maxWidth).toBe("");
  });

  test("the Sort by bar has a button per field, with Quarter selected and descending at first", () => {
    renderCards();
    expect(SORT_KEYS.map((k) => k.label)).toEqual([
      "Quarter",
      "Type",
      "Status",
      "Tentative Opening",
      "Primary Consideration",
      "Actually Opened",
      "Actually Closed",
    ]);
    expect(screen.getByText("Sort by")).toBeInTheDocument();
    const bar = screen.getByTestId("Cards-sort-bar");
    expect(bar).toHaveAttribute("aria-labelledby", "Cards-sort-label");
    expect(screen.getByText("Sort by")).toHaveAttribute(
      "id",
      "Cards-sort-label",
    );
    expect(within(bar).getAllByRole("button")).toHaveLength(7);

    const quarter = screen.getByTestId("Cards-sort-quarter");
    expect(quarter).toHaveTextContent("Quarter ▼");
    expect(quarter).toHaveAttribute("aria-pressed", "true");
    expect(quarter).toHaveClass("btn-primary");
    const type = screen.getByTestId("Cards-sort-type");
    expect(type).toHaveTextContent("Type");
    expect(type).not.toHaveTextContent("▲");
    expect(type).not.toHaveTextContent("▼");
    expect(type).toHaveAttribute("aria-pressed", "false");
    expect(type).toHaveClass("btn-outline-primary");
    expect(bar).toHaveClass("btn-group-sm");
  });

  test("clicking a key sorts ascending by it; clicking it again reverses", async () => {
    renderCards();

    await userEvent.click(screen.getByTestId("Cards-sort-quarter"));
    expect(screen.getByTestId("Cards-sort-quarter")).toHaveTextContent(
      "Quarter ▲",
    );
    expect(order()).toEqual(["W26 TA", "W26 ULA", "S26 TA"]);

    await userEvent.click(screen.getByTestId("Cards-sort-type"));
    expect(screen.getByTestId("Cards-sort-type")).toHaveTextContent("Type ▲");
    expect(screen.getByTestId("Cards-sort-quarter")).toHaveTextContent(
      "Quarter",
    );
    expect(screen.getByTestId("Cards-sort-quarter")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // TA cards first (newest quarter first among them), then the ULA one.
    expect(order()).toEqual(["S26 TA", "W26 TA", "W26 ULA"]);

    await userEvent.click(screen.getByTestId("Cards-sort-type"));
    expect(screen.getByTestId("Cards-sort-type")).toHaveTextContent("Type ▼");
    expect(order()).toEqual(["W26 ULA", "S26 TA", "W26 TA"]);

    await userEvent.click(screen.getByTestId("Cards-sort-actualClosingDate"));
    // Ascending: the blank dates first (ties in backend order), then the one real date.
    expect(order()).toEqual(["S26 TA", "W26 ULA", "W26 TA"]);
    await userEvent.click(screen.getByTestId("Cards-sort-actualClosingDate"));
    expect(order()).toEqual(["W26 TA", "S26 TA", "W26 ULA"]);
  });

  test("sortRecruitments orders by the key, blanks first ascending, ties newest quarter then TA first", () => {
    const ids = (list) => list.map((r) => r.id);
    expect(ids(sortRecruitments(three, "quarter", true))).toEqual([3, 1, 2]);
    expect(ids(sortRecruitments(three, "quarter", false))).toEqual([1, 2, 3]);
    expect(ids(sortRecruitments(three, "applicationStatus", false))).toEqual([
      3, 1, 2,
    ]);
    expect(ids(sortRecruitments(three, "applicationStatus", true))).toEqual([
      2, 3, 1,
    ]);
    expect(ids(sortRecruitments(three, "actualOpeningDate", false))).toEqual([
      3, 1, 2,
    ]);
    expect(ids(sortRecruitments(three, "actualOpeningDate", true))).toEqual([
      2, 1, 3,
    ]);
    // The input is left alone.
    expect(ids(three)).toEqual([3, 2, 1]);
  });

  test("Open Applications and Close Applications ask the backend to flip the status", async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RecruitmentCards recruitments={three} testIdPrefix="Cards" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Card 0 is S26 TA, CLOSED (id 3); card 2 is W26 ULA, OPEN (id 2).
    const openButton = await stepButton(0, 2);
    const closeButton = await stepButton(2, 4);

    // Issue #186: the button asks first; nothing is sent until Yes.
    await userEvent.click(openButton);
    const openDialog = await screen.findByRole("dialog");
    expect(screen.getByTestId("Cards-status-modal")).toContainElement(
      screen.getByTestId("Cards-status-modal-yes"),
    );
    expect(openDialog).toHaveTextContent("Open Applications: S26 TA");
    expect(
      screen.getByTestId("Cards-status-modal-explanation"),
    ).toHaveTextContent(
      "Applicants will be able to submit applications for this recruitment, and to edit them until the primary consideration date. The first opening stamps the actual opening date, which is kept even if the recruitment is closed and reopened. More about this action",
    );
    const help = screen.getByTestId("Cards-status-modal-help");
    expect(help).toHaveAttribute(
      "href",
      "/help/admins#open-close-applications",
    );
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noreferrer");
    expect(within(openDialog).getByText("Are you sure?")).toHaveClass(
      "fw-bold",
    );
    expect(axiosMock.history.put).toHaveLength(0);
    const yes = screen.getByTestId("Cards-status-modal-yes");
    expect(yes).toHaveTextContent("Yes, Open Applications Now");
    expect(yes).toHaveClass("btn-success");
    expect(screen.getByTestId("Cards-status-modal-no")).toHaveTextContent(
      "No, don't open applications now",
    );

    await userEvent.click(yes);
    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe("/api/admin/recruitments/status");
    expect(axiosMock.history.put[0].params).toEqual({ id: 3, status: "OPEN" });
    // The list is refreshed from the backend afterwards, and the modal closes.
    await waitFor(() => expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/recruitments/all"],
    });
    // Issue #233: every recruitment's steps are re-read too.
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/recruitments/steps"],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(closeButton);
    const closeDialog = await screen.findByRole("dialog");
    expect(closeDialog).toHaveTextContent("Close Applications: W26 ULA");
    expect(
      screen.getByTestId("Cards-status-modal-explanation"),
    ).toHaveTextContent(
      "Applicants will no longer be able to submit or edit applications for this recruitment. The actual closing date is stamped with today's date. Every application already on file is kept, and the recruitment can be opened again later.",
    );
    const yesClose = screen.getByTestId("Cards-status-modal-yes");
    expect(yesClose).toHaveTextContent("Yes, Close Applications Now");
    expect(yesClose).toHaveClass("btn-warning");
    expect(screen.getByTestId("Cards-status-modal-no")).toHaveTextContent(
      "No, don't close applications now",
    );
    await userEvent.click(yesClose);
    await waitFor(() => expect(axiosMock.history.put.length).toBe(2));
    expect(axiosMock.history.put[1].params).toEqual({
      id: 2,
      status: "CLOSED",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("No, and the modal's close control, change nothing", async () => {
    renderCards();

    await userEvent.click(await stepButton(0, 2));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("Cards-status-modal-no"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(axiosMock.history.put).toHaveLength(0);

    await userEvent.click(await stepButton(2, 2));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("the status modal stays open on failure and disables Yes while pending", async () => {
    let resolveRequest;
    axiosMock.onPut("/api/admin/recruitments/status").reply(
      () =>
        new Promise((resolve) => {
          resolveRequest = () => resolve([200, {}]);
        }),
    );
    renderCards();

    await userEvent.click(await stepButton(0, 2));
    const yes = await screen.findByTestId("Cards-status-modal-yes");
    expect(yes).not.toBeDisabled();
    await userEvent.click(yes);
    await waitFor(() => expect(yes).toBeDisabled());
    resolveRequest();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    axiosMock.onPut("/api/admin/recruitments/status").reply(500, "no");
    await userEvent.click(await stepButton(0, 2));
    await userEvent.click(await screen.findByTestId("Cards-status-modal-yes"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(2));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("Cards-status-modal-yes")).not.toBeDisabled(),
    );
  });

  test("the Open Faculty Reviews modal explains itself, links to help, and asks Yes or No", async () => {
    renderCards();

    await userEvent.click(await stepButton(0, 6));
    const explanation = screen.getByTestId("Cards-faculty-review-explanation");
    expect(explanation).toHaveTextContent(
      "Faculty will be able to see the candidates for their courses and enter rankings until the deadline you give here. The first opening stamps the faculty review opening date, which is kept if reviews are reopened; the deadline can be changed later. The change is recorded in the recruitment's change history. More about this action",
    );
    const help = screen.getByTestId("Cards-faculty-review-help");
    expect(help).toHaveAttribute("href", "/help/admins#faculty-reviews");
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noreferrer");
    // The explanation comes before the deadline box.
    expect(
      explanation.compareDocumentPosition(
        screen.getByTestId("Cards-faculty-ranking-deadline-input"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const save = screen.getByTestId("Cards-faculty-review-save");
    expect(save).toHaveTextContent("Yes, Open Faculty Reviews Now");
    expect(save).toHaveClass("btn-success");
    expect(screen.getByTestId("Cards-faculty-review-cancel")).toHaveTextContent(
      "No, don't open faculty reviews now",
    );
    await userEvent.click(screen.getByTestId("Cards-faculty-review-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Changing the deadline is not a lifecycle change: no explanation, plain buttons.
    await userEvent.click(
      screen.getByTestId("Cards-card-2-edit-faculty-ranking-deadline"),
    );
    expect(
      screen.queryByTestId("Cards-faculty-review-explanation"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("Cards-faculty-review-save")).toHaveTextContent(
      "Save Deadline",
    );
    expect(screen.getByTestId("Cards-faculty-review-save")).toHaveClass(
      "btn-primary",
    );
    expect(screen.getByTestId("Cards-faculty-review-cancel")).toHaveTextContent(
      "Cancel",
    );
  });

  test("the footer has just the Courses and Applications buttons, leading to that recruitment's pages", () => {
    renderCards();
    // Card 2 is id 2.
    const courses = screen.getByTestId("Cards-card-2-courses-button");
    expect(courses).toHaveTextContent("Courses");
    expect(courses).toHaveAttribute("href", "/admin/recruitments/2/courses");
    expect(courses).toHaveClass("btn", "btn-primary");

    const applications = screen.getByTestId("Cards-card-2-applications-button");
    expect(applications).toHaveTextContent("Applications");
    expect(applications).toHaveAttribute(
      "href",
      "/admin/recruitments/2/applications",
    );
    expect(applications).toHaveClass("btn", "btn-info");

    // Everything else the footer once held is reached through the diagram or has moved (#234).
    const footer = screen
      .getByTestId("Cards-card-2-card")
      .querySelector(".card-footer");
    expect(footer).toHaveClass("d-flex", "flex-wrap", "gap-2");
    expect(footer.children).toHaveLength(2);
    expect(footer).not.toContainElement(
      screen.getByTestId("Cards-card-2-delete-button"),
    );
    [
      "status-button",
      "review-status-button",
      "test-button",
      "csv-button",
      "rankings-csv-button",
      "review-button",
      "assignments-button",
      "published-assignments-button",
    ].forEach((suffix) =>
      expect(
        screen.queryByTestId(`Cards-card-2-${suffix}`),
      ).not.toBeInTheDocument(),
    );
  });

  test("opening reviews requires and submits a deadline; canceling does not save", async () => {
    renderCards();

    await userEvent.click(await stepButton(0, 6));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Open Faculty Reviews",
    );
    const dateInput = screen.getByTestId(
      "Cards-faculty-ranking-deadline-input",
    );
    expect(dateInput).toBeRequired();

    const formClosingWithModal = dateInput.closest("form");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    if (formClosingWithModal.isConnected) {
      fireEvent.submit(formClosingWithModal);
    }
    expect(axiosMock.history.put).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(await stepButton(0, 6));
    const reopenedDateInput = screen.getByTestId(
      "Cards-faculty-ranking-deadline-input",
    );
    // The box proposes a deadline (issue #211); clear it to submit nothing.
    await userEvent.clear(reopenedDateInput);
    fireEvent.submit(reopenedDateInput.closest("form"));
    expect(axiosMock.history.put).toHaveLength(0);
    expect(screen.getByText("Enter a valid deadline.")).toBeInTheDocument();

    await userEvent.type(reopenedDateInput, "2026-03-01");
    await userEvent.click(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
    );
    await userEvent.click(screen.getByTestId("Cards-faculty-review-cancel"));
    expect(axiosMock.history.put).toHaveLength(0);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(await stepButton(0, 6));
    await userEvent.clear(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
    );
    await userEvent.type(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
      "2026-03-01",
    );
    await userEvent.click(screen.getByTestId("Cards-faculty-review-save"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/admin/recruitments/reviewStatus",
    );
    expect(axiosMock.history.put[0].params).toEqual({
      id: 3,
      status: "Open",
      facultyRankingDeadline: "2026-03-01",
    });
  });

  test("the deadline box is labelled, flags a missing date until it is fixed, and each mode has its own title", async () => {
    renderCards();
    expect(screen.getByTestId("Cards-cards")).toBeInTheDocument();

    await userEvent.click(await stepButton(0, 6));
    expect(
      screen
        .getByTestId("Cards-faculty-review-modal")
        .querySelector(".modal-title"),
    ).toHaveTextContent(/^Open Faculty Reviews$/);
    const input = screen.getByLabelText("Faculty ranking deadline");
    expect(input).toBe(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
    );
    expect(input).not.toHaveClass("is-invalid");
    expect(screen.getByText("Enter a deadline.")).toBeInTheDocument();

    await userEvent.clear(input);
    fireEvent.submit(input.closest("form"));
    expect(input).toHaveClass("is-invalid");
    expect(screen.getByText("Enter a valid deadline.")).toBeInTheDocument();

    // Typing a date clears the complaint.
    fireEvent.change(input, { target: { value: "2026-03-01" } });
    expect(input).not.toHaveClass("is-invalid");

    fireEvent.change(input, { target: { value: "" } });
    await userEvent.clear(input);
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(input).toHaveClass("is-invalid"));
    await userEvent.click(screen.getByTestId("Cards-faculty-review-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(await stepButton(0, 6));
    expect(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
    ).not.toHaveClass("is-invalid");
    await userEvent.click(screen.getByTestId("Cards-faculty-review-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(
      screen.getByTestId("Cards-card-2-edit-faculty-ranking-deadline"),
    );
    expect(
      screen
        .getByTestId("Cards-faculty-review-modal")
        .querySelector(".modal-title"),
    ).toHaveTextContent(/^Change Faculty Ranking Deadline$/);
  });

  test("admins can close reviews and edit the deadline beside its date", async () => {
    renderCards();

    await userEvent.click(await stepButton(2, 6));
    // Issue #211: closing asks first.
    await userEvent.click(screen.getByTestId("Cards-close-reviews-yes"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/admin/recruitments/reviewStatus",
    );
    expect(axiosMock.history.put[0].params).toEqual({
      id: 2,
      status: "Closed",
    });

    await userEvent.click(
      screen.getByTestId("Cards-card-2-edit-faculty-ranking-deadline"),
    );
    const dateInput = screen.getByTestId(
      "Cards-faculty-ranking-deadline-input",
    );
    expect(dateInput).toHaveValue("2026-02-15");
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, "2026-02-20");
    await userEvent.click(screen.getByTestId("Cards-faculty-review-save"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(2));
    expect(axiosMock.history.put[1].url).toBe(
      "/api/admin/recruitments/facultyRankingDeadline",
    );
    expect(axiosMock.history.put[1].params).toEqual({
      id: 2,
      facultyRankingDeadline: "2026-02-20",
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(
      screen.getByTestId("Cards-card-0-edit-faculty-ranking-deadline"),
    );
    expect(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
    ).toHaveValue("");
    await userEvent.click(screen.getByTestId("Cards-faculty-review-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("the review modal stays open on save failure and disables duplicate saves while pending", async () => {
    let resolveRequest;
    axiosMock.onPut("/api/admin/recruitments/reviewStatus").reply(
      () =>
        new Promise((resolve) => {
          resolveRequest = () => resolve([200, {}]);
        }),
    );
    renderCards();

    await userEvent.click(await stepButton(0, 6));
    fireEvent.change(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
      {
        target: { value: "2026-03-01" },
      },
    );
    const saveButton = screen.getByTestId("Cards-faculty-review-save");
    await userEvent.click(saveButton);
    await waitFor(() => expect(saveButton).toBeDisabled());
    resolveRequest();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    axiosMock
      .onPut("/api/admin/recruitments/reviewStatus")
      .reply(500, "unable to save");
    await userEvent.click(await stepButton(0, 6));
    fireEvent.change(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
      {
        target: { value: "2026-03-02" },
      },
    );
    await userEvent.click(screen.getByTestId("Cards-faculty-review-save"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(2));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  /** Issue #108: the count beside the status badge, and a trash icon at the right. */
  test("the header shows how many applications are on file", () => {
    renderCards(three, vi.fn(), { 2: 15, 1: 1 });

    expect(screen.getByTestId("Cards-card-2-applications")).toHaveTextContent(
      "15 applications",
    );
    expect(screen.getByTestId("Cards-card-1-applications")).toHaveTextContent(
      "1 application",
    );
    // Not in the map: none.
    expect(screen.getByTestId("Cards-card-0-applications")).toHaveTextContent(
      "0 applications",
    );
    expect(applicationsText(0)).toBe("0 applications");
    expect(applicationsText(1)).toBe("1 application");
    expect(applicationsText(2)).toBe("2 applications");
    // The count follows the status badge in the header.
    const header = screen
      .getByTestId("Cards-card-2-card")
      .querySelector(".card-header");
    expect(header).toContainElement(
      screen.getByTestId("Cards-card-2-applications"),
    );
    expect(
      screen
        .getByTestId("Cards-card-2-applicationStatus")
        .compareDocumentPosition(
          screen.getByTestId("Cards-card-2-applications"),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("without counts every card says 0 applications", () => {
    renderCards();
    expect(screen.getByTestId("Cards-card-2-applications")).toHaveTextContent(
      "0 applications",
    );
  });

  test("the trash icon sits at the right of the header with a tooltip", async () => {
    renderCards();

    const button = screen.getByTestId("Cards-card-2-delete-button");
    expect(button).toHaveClass("btn-outline-danger", "btn-sm", "ms-auto");
    expect(button).toHaveAttribute("aria-label", "Delete this Recruitment");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.textContent).toBe("");
    expect(
      screen.getByTestId("Cards-card-2-card").querySelector(".card-header"),
    ).toContainElement(button);
    expect(DELETE_TOOLTIP).toBe("Delete this Recruitment");

    fireEvent.mouseOver(button);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Delete this Recruitment");
    expect(tooltip).toHaveAttribute("id", "Cards-card-2-delete-tooltip");
  });

  /** Delete is confirmed by the page, so the card only reports the request. */
  test("Delete asks the page rather than deleting directly", async () => {
    const onDeleteRequested = renderCards();

    await userEvent.click(screen.getByTestId("Cards-card-1-delete-button"));

    expect(onDeleteRequested).toHaveBeenCalledTimes(1);
    expect(onDeleteRequested.mock.calls[0][0]).toEqual(three[2]);
    expect(axiosMock.history.delete.length).toBe(0);
  });

  test("with no recruitments it says so, and the sort bar is still there", () => {
    renderCards([]);
    expect(screen.getByTestId("Cards-empty")).toHaveTextContent(
      "No recruitments yet.",
    );
    expect(screen.getByTestId("Cards-empty")).toHaveClass("text-muted");
    expect(screen.queryByTestId("Cards-card-0-card")).toBeNull();
    expect(screen.getByTestId("Cards-sort-quarter")).toBeInTheDocument();
  });

  test("tolerates a non-array recruitments prop", () => {
    renderCards(null);
    expect(screen.getByTestId("Cards-empty")).toBeInTheDocument();
  });

  test("the default test id prefix is RecruitmentCards and Delete has a default no-op", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecruitmentCards recruitments={three} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId("RecruitmentCards-card-0-quarter"),
    ).toHaveTextContent("S26");
    await userEvent.click(
      screen.getByTestId("RecruitmentCards-card-0-delete-button"),
    );
    expect(axiosMock.history.delete.length).toBe(0);
  });

  // Issue #180: published assignments.
  test("an unpublished recruitment has no Assignments Published badge or button", () => {
    renderCards();

    expect(
      screen.queryByTestId("Cards-card-0-assignmentsPublished"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("Cards-card-0-published-assignments-button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Assignments Published")).not.toBeInTheDocument();
    expect(screen.queryByText("Published Assignments")).not.toBeInTheDocument();
  });

  test("a published recruitment shows the Assignments Published badge", () => {
    renderCards([
      { ...three[2], assignmentsPublished: true },
      { ...three[1], assignmentsPublished: false },
    ]);

    const badge = screen.getByTestId("Cards-card-0-assignmentsPublished");
    expect(badge).toHaveTextContent("Assignments Published");
    expect(badge).toHaveClass("badge", "bg-info");
    expect(badge.closest(".card-header")).not.toBeNull();
    // Right after the faculty reviews badge, before the application count.
    expect(badge.previousElementSibling).toBe(
      screen.getByTestId("Cards-card-0-reviewStatus"),
    );
    expect(badge.nextElementSibling).toBe(
      screen.getByTestId("Cards-card-0-applications"),
    );

    // The Published Assignments and Assignments buttons left the footer (issue #233): step 9 of
    // the diagram links to the published page instead.
    expect(
      screen.queryByTestId("Cards-card-0-published-assignments-button"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("Cards-card-0-assignments-button"),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByTestId("Cards-card-1-assignmentsPublished"),
    ).not.toBeInTheDocument();
  });

  // ---- Issue #211: closing faculty reviews asks first; the deadline defaults ahead ----

  test("Close Faculty Reviews opens a confirmation that explains, links to help and asks Yes or No", async () => {
    renderCards();
    // Card 2 is the open ULA recruitment (W26) whose deadline, 2026-02-15, has passed.
    await userEvent.click(await stepButton(2, 6));

    const modal = await screen.findByTestId("Cards-close-reviews-modal");
    expect(
      within(modal).getByText("Close Faculty Reviews: W26 ULA"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("Cards-close-reviews-explanation"),
    ).toHaveTextContent(
      "Faculty will no longer be able to enter or change rankings; what they have ranked so far is kept, and so are the review opening date and the deadline. Reviews can be opened again later. The change is recorded in the recruitment's change history. More about this action",
    );
    const help = screen.getByTestId("Cards-close-reviews-help");
    expect(help).toHaveAttribute("href", "/help/admins#faculty-reviews");
    expect(help).toHaveAttribute("target", "_blank");
    expect(help).toHaveAttribute("rel", "noreferrer");
    expect(within(modal).getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByTestId("Cards-close-reviews-no")).toHaveTextContent(
      "No, don't close faculty reviews now",
    );
    const yes = screen.getByTestId("Cards-close-reviews-yes");
    expect(yes).toHaveTextContent("Yes, Close Faculty Reviews Now");
    expect(yes).toHaveClass("btn-warning");
    // The deadline has passed, so there is no early-closing warning.
    expect(
      screen.queryByTestId("Cards-close-reviews-early"),
    ).not.toBeInTheDocument();
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("No, or the close control, closes the confirmation without saving", async () => {
    renderCards();
    await userEvent.click(await stepButton(2, 6));
    await screen.findByTestId("Cards-close-reviews-modal");

    await userEvent.click(screen.getByTestId("Cards-close-reviews-no"));
    await waitFor(() =>
      expect(
        screen.queryByTestId("Cards-close-reviews-modal"),
      ).not.toBeInTheDocument(),
    );
    await userEvent.click(await stepButton(2, 6));
    await screen.findByTestId("Cards-close-reviews-modal");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByTestId("Cards-close-reviews-modal"),
      ).not.toBeInTheDocument(),
    );
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("Yes closes reviews, the modal closes on success, and Yes is disabled while saving", async () => {
    let release;
    axiosMock
      .onPut("/api/admin/recruitments/reviewStatus")
      .reply(
        () => new Promise((resolve) => (release = () => resolve([200, {}]))),
      );
    renderCards();
    await userEvent.click(await stepButton(2, 6));
    await userEvent.click(await screen.findByTestId("Cards-close-reviews-yes"));

    await waitFor(() =>
      expect(screen.getByTestId("Cards-close-reviews-yes")).toBeDisabled(),
    );
    expect(axiosMock.history.put[0].params).toEqual({
      id: 2,
      status: "Closed",
    });
    release();
    await waitFor(() =>
      expect(
        screen.queryByTestId("Cards-close-reviews-modal"),
      ).not.toBeInTheDocument(),
    );
  });

  test("closing before the stated deadline shows a warning that names the deadline", async () => {
    renderCards(
      recruitmentsFixtures.threeRecruitments.map((r) =>
        r.id === 2 ? { ...r, facultyRankingDeadline: "2999-12-31" } : r,
      ),
    );
    await userEvent.click(await stepButton(2, 6));

    const warning = await screen.findByTestId("Cards-close-reviews-early");
    expect(warning).toHaveTextContent(
      "The faculty ranking deadline is 2999-12-31, which has not passed yet. Faculty who have not finished ranking will be cut off before the deadline they were given.",
    );
    expect(warning).toHaveClass("text-danger", "fw-bold");
    expect(warning).toHaveAttribute("role", "alert");
    expect(warning.querySelector("span[aria-hidden='true']")).toHaveTextContent(
      "⚠",
    );
  });

  test("no warning when the recruitment has no deadline on file", async () => {
    renderCards(
      recruitmentsFixtures.threeRecruitments.map((r) =>
        r.id === 2 ? { ...r, facultyRankingDeadline: null } : r,
      ),
    );
    await userEvent.click(await stepButton(2, 6));
    await screen.findByTestId("Cards-close-reviews-modal");
    expect(
      screen.queryByTestId("Cards-close-reviews-early"),
    ).not.toBeInTheDocument();
  });

  test("Open Faculty Reviews proposes a deadline five working days ahead", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Monday 2026-11-02: five working days later is Monday 2026-11-09.
    vi.setSystemTime(new Date(2026, 10, 2, 9, 0, 0));
    try {
      renderCards();
      await userEvent.click(await stepButton(0, 6));
      expect(
        screen.getByTestId("Cards-faculty-ranking-deadline-input"),
      ).toHaveValue("2026-11-09");
    } finally {
      vi.useRealTimers();
    }
  });

  test("on a Friday the proposed deadline skips the weekend", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 6, 17, 0, 0));
    try {
      renderCards();
      await userEvent.click(await stepButton(0, 6));
      expect(
        screen.getByTestId("Cards-faculty-ranking-deadline-input"),
      ).toHaveValue("2026-11-13");
    } finally {
      vi.useRealTimers();
    }
  });

  // ---- Issue #233: the live Recruitment Steps diagram on each card ----

  const expandedByIndex = (count) =>
    Array.from({ length: count }, (_, i) =>
      screen
        .getByTestId(`Cards-card-${i}-steps-toggle`)
        .getAttribute("aria-expanded"),
    );

  test("each card fetches its recruitment's steps and shows where it is in one line", async () => {
    renderCards();

    // Every box but step 1 is not done in the mocked steps, so each is at step 2 (TA or ULA).
    expect(
      await screen.findByTestId("Cards-card-0-steps-summary"),
    ).toHaveTextContent("Step 2 of 9: Open TA Applications");
    expect(screen.getByTestId("Cards-card-1-steps-summary")).toHaveTextContent(
      "Step 2 of 9: Open TA Applications",
    );
    expect(screen.getByTestId("Cards-card-2-steps-summary")).toHaveTextContent(
      "Step 2 of 9: Open ULA Applications",
    );
    for (const id of [3, 1, 2]) {
      expect(stepsGets(id)).toHaveLength(1);
    }
  });

  test("the most recent TA and the most recent ULA recruitment start expanded, the rest collapsed", async () => {
    renderCards();
    await screen.findByTestId("Cards-card-2-steps-toggle");

    // S26 TA (id 3) and W26 ULA (id 2) are the latest of their types; W26 TA (id 1) is older.
    expect(expandedByIndex(3)).toEqual(["true", "false", "true"]);
    expect(
      screen.getByTestId("Cards-card-0-steps-diagram"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("Cards-card-1-steps-diagram"),
    ).not.toBeInTheDocument();

    // The admin can open the collapsed one and close an open one; nothing is saved.
    await userEvent.click(screen.getByTestId("Cards-card-1-steps-toggle"));
    expect(
      screen.getByTestId("Cards-card-1-steps-diagram"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("Cards-card-0-steps-toggle"));
    expect(
      screen.queryByTestId("Cards-card-0-steps-diagram"),
    ).not.toBeInTheDocument();
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("of two recruitments of one type, the later quarter is expanded, and on a tie the newer id", async () => {
    const make = (id, quarter, type) => ({ ...three[0], id, quarter, type });
    renderCards([
      make(10, "20262", "TA"),
      make(11, "20262", "TA"),
      make(12, "20254", "TA"),
      make(13, "20261", "ULA"),
      make(14, "20254", "ULA"),
    ]);
    await screen.findByTestId("Cards-card-4-steps-toggle");

    // The mocked step 1 label carries its recruitment's id, so the expanded panels name themselves.
    const expandedIds = [];
    for (let i = 0; i < 5; i += 1) {
      if (
        screen
          .getByTestId(`Cards-card-${i}-steps-toggle`)
          .getAttribute("aria-expanded") === "true"
      ) {
        const label = screen.getByTestId(
          `Cards-card-${i}-steps-steps-step-1-label`,
        );
        expandedIds.push(Number(label.textContent.match(/#(\d+)/)[1]));
      }
    }
    // Ids 10 and 11 tie on quarter (11 is newer); 13 is the latest ULA quarter.
    expect(expandedIds.sort()).toEqual([11, 13]);
  });

  test("a card whose steps cannot be loaded still shows, without the diagram panel", async () => {
    axiosMock.onGet(stepsUrl).reply(500, { message: "boom" });
    renderCards();

    expect(await screen.findByTestId("Cards-card-0-quarter")).toHaveTextContent(
      "S26",
    );
    await waitFor(() => expect(stepsGets(3)).toHaveLength(1));
    expect(
      screen.queryByTestId("Cards-card-0-steps-summary"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("Cards-card-0-courses-button"),
    ).toBeInTheDocument();
  });

  test("the applications and review steps open the same modal either way, going by the current status", async () => {
    renderCards();

    // Card 2 (W26 ULA) is open for applications and for faculty reviews; card 0 is neither.
    await userEvent.click(await stepButton(2, 2));
    expect(
      await screen.findByTestId("Cards-status-modal-yes"),
    ).toHaveTextContent("Yes, Close Applications Now");
    await userEvent.click(screen.getByTestId("Cards-status-modal-no"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(await stepButton(0, 4));
    expect(
      await screen.findByTestId("Cards-status-modal-yes"),
    ).toHaveTextContent("Yes, Open Applications Now");
    await userEvent.click(screen.getByTestId("Cards-status-modal-no"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(await stepButton(2, 6));
    expect(
      await screen.findByTestId("Cards-close-reviews-yes"),
    ).toHaveTextContent("Yes, Close Faculty Reviews Now");
    await userEvent.click(screen.getByTestId("Cards-close-reviews-no"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(await stepButton(0, 7));
    expect(
      await screen.findByTestId("Cards-faculty-review-save"),
    ).toHaveTextContent("Yes, Open Faculty Reviews Now");
    await userEvent.click(screen.getByTestId("Cards-faculty-review-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("step 5 opens the Allocation Visibility modal, and Save sends the choice and re-reads the steps", async () => {
    axiosMock
      .onPut("/api/admin/recruitments/allocationVisibility")
      .reply(200, {});
    renderCards();

    await userEvent.click(await stepButton(0, 5));
    expect(await screen.findByTestId("Cards-visibility")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Allocation Visibility",
    );
    await userEvent.click(screen.getByTestId("Cards-visibility-OWN_COURSES"));
    const getsBefore = stepsGets(3).length;
    await userEvent.click(screen.getByTestId("Cards-visibility-save"));

    await waitFor(() =>
      expect(
        axiosMock.history.put.filter((r) =>
          r.url.endsWith("/allocationVisibility"),
        ),
      ).toHaveLength(1),
    );
    expect(
      axiosMock.history.put.find((r) => r.url.endsWith("/allocationVisibility"))
        .params,
    ).toEqual({ id: 3, visibility: "OWN_COURSES" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(stepsGets(3).length).toBeGreaterThan(getsBefore),
    );
  });

  test("Cancel in the Allocation Visibility modal sends nothing", async () => {
    renderCards();

    await userEvent.click(await stepButton(2, 5));
    await userEvent.click(await screen.findByTestId("Cards-visibility-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("step 9 opens the Publish Assignments modal, Yes publishes, and No does nothing", async () => {
    axiosMock
      .onPut("/api/admin/recruitments/assignmentsPublished")
      .reply(200, {});
    renderCards();

    // W26 TA (id 1) has applications and ranking closed, so nothing stands in the way.
    await userEvent.click(await stepButton(1, 9));
    const modal = await screen.findByTestId("Cards-publish-modal");
    expect(modal).toHaveTextContent("Publish Assignments");
    expect(screen.queryByTestId("Cards-publish-refusal")).toBeNull();
    await userEvent.click(screen.getByTestId("Cards-publish-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(axiosMock.history.put).toHaveLength(0);

    await userEvent.click(await stepButton(1, 9));
    await userEvent.click(await screen.findByTestId("Cards-publish-confirm"));
    await waitFor(() => expect(axiosMock.history.put).toHaveLength(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/admin/recruitments/assignmentsPublished",
    );
    expect(axiosMock.history.put[0].params).toEqual({ id: 1, published: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("step 9 on a card whose ranking or applications are still open shows why and disables Yes (issue #237)", async () => {
    renderCards();

    // S26 TA (id 3): faculty ranking has not even started.
    await userEvent.click(await stepButton(0, 9));
    expect(
      await screen.findByTestId("Cards-publish-refusal"),
    ).toHaveTextContent(
      "Close Faculty Ranking before releasing hiring decisions.",
    );
    expect(screen.getByTestId("Cards-publish-confirm")).toBeDisabled();
    await userEvent.click(screen.getByTestId("Cards-publish-cancel"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("a refusal from the backend stays in the modal opened from the card", async () => {
    axiosMock.onPut("/api/admin/recruitments/assignmentsPublished").reply(400, {
      message: "Assign candidates to slots before releasing hiring decisions.",
    });
    renderCards();

    await userEvent.click(await stepButton(1, 9));
    await userEvent.click(await screen.findByTestId("Cards-publish-confirm"));
    expect(
      await screen.findByTestId("Cards-publish-refusal"),
    ).toHaveTextContent(
      "Assign candidates to slots before releasing hiring decisions.",
    );
    expect(screen.getByTestId("Cards-publish-modal")).toBeInTheDocument();
  });

  test("the diagram's page links go to the budget, courses and assignments pages without a reload", async () => {
    renderCards();
    // Open the collapsed card 1 (W26 TA, id 1) so every kind of link is on screen.
    await stepButton(1, 2);

    await userEvent.click(
      screen.getByTestId("Cards-card-1-steps-steps-step-3-link-Budget"),
    );
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/budget/W26");

    await userEvent.click(
      screen.getByTestId("Cards-card-1-steps-steps-step-3-link-Allocations"),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/recruitments/1/courses",
    );

    await userEvent.click(
      screen.getByTestId("Cards-card-1-steps-steps-step-8-link"),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/recruitments/1/assignments",
    );

    await userEvent.click(
      screen.getByTestId("Cards-card-1-steps-steps-step-7-secondary-link"),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/recruitments/1/courses",
    );
    await userEvent.click(
      screen.getByTestId("Cards-card-1-steps-steps-step-9-secondary-link"),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/admin/recruitments/1/courses",
    );
    // Following links changes nothing on the backend.
    expect(axiosMock.history.put).toHaveLength(0);
  });

  test("a successful change re-reads the steps of the recruitments", async () => {
    renderCards();

    await userEvent.click(await stepButton(0, 2));
    await userEvent.click(await screen.findByTestId("Cards-status-modal-yes"));
    await waitFor(() => expect(stepsGets(3).length).toBeGreaterThan(1));
    // Steps of the other cards are refreshed too: one list of steps, one query key.
    await waitFor(() => expect(stepsGets(2).length).toBeGreaterThan(1));
  });

  test("the deadline Change button still opens the deadline modal from the new layout", async () => {
    renderCards();

    await userEvent.click(
      screen.getByTestId("Cards-card-2-edit-faculty-ranking-deadline"),
    );
    expect(
      screen.getByTestId("Cards-faculty-ranking-deadline-input"),
    ).toHaveValue("2026-02-15");
    expect(screen.getByTestId("Cards-faculty-review-save")).toHaveTextContent(
      "Save Deadline",
    );
  });
});
