import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import RecruitmentCards, {
  DELETE_TOOLTIP,
  TEST_APPLICATION_TOOLTIP,
} from "main/components/Recruitments/RecruitmentCards";
import { applicationsText } from "main/utils/adminApplications";
import { SORT_KEYS, sortRecruitments } from "main/utils/recruitmentSort";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const axiosMock = new AxiosMockAdapter(axios);

// Fixture order: S26 TA CLOSED (id 3), W26 ULA OPEN (id 2), W26 TA CLOSED (id 1).
const three = recruitmentsFixtures.threeRecruitments;

function renderCards(
  recruitments = three,
  onDeleteRequested = vi.fn(),
  applicationCounts = undefined,
) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RecruitmentCards
          recruitments={recruitments}
          applicationCounts={applicationCounts}
          onDeleteRequested={onDeleteRequested}
          testIdPrefix="Cards"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onDeleteRequested;
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
    expect(screen.getByTestId("Cards-card-2-card").style.maxWidth).toBe(
      "48rem",
    );
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
    const openButton = screen.getByTestId("Cards-card-0-status-button");
    expect(openButton).toHaveTextContent("Open Applications");
    expect(openButton).toHaveClass("btn-success");
    const closeButton = screen.getByTestId("Cards-card-2-status-button");
    expect(closeButton).toHaveTextContent("Close Applications");
    expect(closeButton).toHaveClass("btn-warning");

    await userEvent.click(openButton);
    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe("/api/admin/recruitments/status");
    expect(axiosMock.history.put[0].params).toEqual({ id: 3, status: "OPEN" });
    // The list is refreshed from the backend afterwards.
    await waitFor(() => expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1));
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/recruitments/all"],
    });

    await userEvent.click(closeButton);
    await waitFor(() => expect(axiosMock.history.put.length).toBe(2));
    expect(axiosMock.history.put[1].params).toEqual({
      id: 2,
      status: "CLOSED",
    });
  });

  test("the links lead to that recruitment's courses, preview, CSV and review pages", () => {
    renderCards();
    // Card 2 is id 2.
    const courses = screen.getByTestId("Cards-card-2-courses-button");
    expect(courses).toHaveTextContent("Courses");
    expect(courses).toHaveAttribute("href", "/admin/recruitments/2/courses");
    expect(courses).toHaveClass("btn", "btn-primary");

    const test = screen.getByTestId("Cards-card-2-test-button");
    expect(test).toHaveTextContent("Test Application");
    expect(test).toHaveAttribute(
      "href",
      "/admin/recruitments/2/test-application",
    );
    expect(test).toHaveAttribute("title", TEST_APPLICATION_TOOLTIP);
    expect(test).toHaveClass("btn", "btn-secondary");
    expect(TEST_APPLICATION_TOOLTIP).toBe(
      "Submit a test application to see what the form looks like to applicants",
    );

    const csv = screen.getByTestId("Cards-card-2-csv-button");
    expect(csv).toHaveTextContent("Download CSV");
    expect(csv).toHaveAttribute(
      "href",
      "/api/admin/applications/csv?recruitmentId=2",
    );
    expect(csv).toHaveAttribute("download", "applications-2.csv");
    expect(csv).toHaveClass("btn", "btn-outline-secondary");

    const review = screen.getByTestId("Cards-card-2-review-button");
    expect(review).toHaveTextContent("Review Applications");
    expect(review).toHaveAttribute(
      "href",
      "/admin/recruitments/2/applications",
    );
    expect(review).toHaveClass("btn", "btn-info");

    // All five sit in the footer; Delete moved to the header (issue #108).
    const footer = screen
      .getByTestId("Cards-card-2-card")
      .querySelector(".card-footer");
    expect(footer).toHaveClass("d-flex", "flex-wrap", "gap-2");
    expect(footer.children).toHaveLength(6);
    expect(footer).not.toContainElement(
      screen.getByTestId("Cards-card-2-delete-button"),
    );
  });

  test("opening reviews requires and submits a deadline; canceling does not save", async () => {
    renderCards();

    expect(
      screen.getByTestId("Cards-card-1-review-status-button"),
    ).toHaveTextContent("Open Faculty Reviews");
    await userEvent.click(
      screen.getByTestId("Cards-card-0-review-status-button"),
    );
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
    await userEvent.click(
      screen.getByTestId("Cards-card-0-review-status-button"),
    );
    const reopenedDateInput = screen.getByTestId(
      "Cards-faculty-ranking-deadline-input",
    );
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

    await userEvent.click(
      screen.getByTestId("Cards-card-0-review-status-button"),
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

  test("admins can close reviews and edit the deadline beside its date", async () => {
    renderCards();

    await userEvent.click(
      screen.getByTestId("Cards-card-2-review-status-button"),
    );
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

    await userEvent.click(
      screen.getByTestId("Cards-card-0-review-status-button"),
    );
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
    await userEvent.click(
      screen.getByTestId("Cards-card-0-review-status-button"),
    );
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
});
