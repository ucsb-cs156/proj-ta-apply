import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ProposeAssignmentsModal from "main/components/Assignments/ProposeAssignmentsModal";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
import autoAssignFixtures from "fixtures/autoAssignFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

const PREVIEW_URL = "/api/admin/assignments/auto/preview";
const APPLY_URL = "/api/admin/assignments/auto/apply";
const UNDO_URL = "/api/admin/assignments/auto/undo";

/** Recruitment 7 with its ranking deadline long past, and not published. */
const settled = {
  ...recruitmentsFixtures.threeRecruitments[0],
  id: 7,
  facultyRankingDeadline: "2000-01-01",
  assignmentsPublished: false,
};

function renderModal(props = {}) {
  const callbacks = {
    onUpdated: vi.fn(),
    onError: vi.fn(),
    onHide: vi.fn(),
  };
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProposeAssignmentsModal
        recruitmentId="7"
        page={assignmentsFixtures.taPage}
        recruitment={settled}
        headers={{ "X-Client-Id": "tab-1" }}
        testIdPrefix="Prop"
        {...callbacks}
        {...props}
      />
    </QueryClientProvider>,
  );
  return callbacks;
}

const previews = () =>
  axiosMock.history.get.filter((r) => r.url === PREVIEW_URL);
const applies = () => axiosMock.history.post.filter((r) => r.url === APPLY_URL);
const undos = () => axiosMock.history.post.filter((r) => r.url === UNDO_URL);

/** The text of a cell of one of the modal's tables. */
const cell = (table, row, column) =>
  screen.getByTestId(`Prop-${table}-cell-row-${row}-col-${column}`).textContent;

/** The texts of a column of one of the modal's tables, in the order shown. */
const columnTexts = (table, column) =>
  within(screen.getByTestId(`Prop-${table}`))
    .getAllByRole("row")
    .slice(1)
    .map(
      (row) =>
        within(row).getAllByRole("cell")[
          [
            ...screen
              .getByTestId(`Prop-${table}-header-group-0`)
              .querySelectorAll("th"),
          ].findIndex(
            (th) =>
              th.getAttribute("data-testid") ===
              `Prop-${table}-header-${column}`,
          )
        ].textContent,
    );

describe("ProposeAssignmentsModal tests (issue #515)", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet(PREVIEW_URL).reply(200, autoAssignFixtures.preview);
    axiosMock.onPost(APPLY_URL).reply(200, autoAssignFixtures.applied);
    axiosMock.onPost(UNDO_URL).reply(200, autoAssignFixtures.undone);
  });

  // ---- opening: the preview ----

  test("fetches the preview on opening, with a spinner line meanwhile, and shows the proposals checked", async () => {
    let release;
    axiosMock.onGet(PREVIEW_URL).reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, autoAssignFixtures.preview]);
        }),
    );
    renderModal();

    expect(screen.getByTestId("Prop-modal")).toBeInTheDocument();
    expect(
      screen.getByText("Propose assignments", { selector: ".modal-title" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Prop-loading")).toHaveTextContent(
      "Working out the proposals…",
    );
    expect(
      within(screen.getByTestId("Prop-loading")).getByRole("status"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("Prop-proceed")).toBeNull();
    expect(screen.queryByTestId("Prop-cancel")).toBeNull();
    await waitFor(() => expect(previews()).toHaveLength(1));
    expect(previews()[0].params).toEqual({ recruitmentId: "7" });
    expect(previews()[0].headers["X-Client-Id"]).toBe("tab-1");

    release();

    expect(await screen.findByTestId("Prop-proposed")).toBeInTheDocument();
    expect(screen.queryByTestId("Prop-loading")).toBeNull();
    expect(screen.queryByTestId("Prop-warnings")).toBeNull();
    expect(screen.getByTestId("Prop-instruction")).toHaveTextContent(
      "Uncheck any assignments you do not want to make in this round",
    );
    expect(screen.getByTestId("Prop-select-all")).toHaveTextContent(
      "Select All",
    );
    expect(screen.getByTestId("Prop-select-none")).toHaveTextContent(
      "Select None",
    );
    expect(screen.getByTestId("Prop-passes-note")).toHaveTextContent(
      "Later passes may depend on earlier ones: a proposal in pass 2 or later was found only after the pass-1 proposals were assumed made.",
    );
    expect(screen.getByTestId("Prop-cancel")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (2)");
    expect(screen.getByTestId("Prop-proceed")).toBeEnabled();
    // The buttons come before the table.
    expect(
      screen
        .getByTestId("Prop-proceed")
        .compareDocumentPosition(screen.getByTestId("Prop-proposed")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId("Prop-proposed-heading")).toHaveTextContent(
      "Proposed assignments",
    );

    // A TA page (issue #488): Class Level and Major show the PhD/CS rule.
    const headers = [
      ...screen
        .getByTestId("Prop-proposed-header-group-0")
        .querySelectorAll("th"),
    ].map((th) => th.textContent);
    expect(headers).toEqual([
      "Make",
      "Applicant",
      "Lecture",
      "Rank",
      "Preference",
      "Pass",
      "Class Level",
      "Major",
    ]);
    expect(cell("proposed", 0, "applicant")).toBe("Ada Lovelace");
    expect(cell("proposed", 0, "lecture")).toBe("8");
    expect(cell("proposed", 0, "rank")).toBe("1");
    expect(cell("proposed", 0, "preference")).toBe("1st Choice");
    expect(cell("proposed", 0, "pass")).toBe("1");
    expect(cell("proposed", 0, "classLevel")).toBe("PHD");
    expect(cell("proposed", 0, "major")).toBe("Computer Science");
    expect(cell("proposed", 1, "applicant")).toBe("blank@ucsb.edu");
    expect(cell("proposed", 1, "lecture")).toBe("24");
    expect(cell("proposed", 1, "rank")).toBe("2");
    expect(cell("proposed", 1, "preference")).toBe("");
    expect(cell("proposed", 1, "pass")).toBe("2");
    expect(screen.getByTestId("Prop-row-0-check")).toBeChecked();
    expect(screen.getByTestId("Prop-row-0-check")).toHaveAccessibleName(
      "Make Ada Lovelace to 8",
    );
    expect(screen.getByTestId("Prop-row-1-check")).toBeChecked();
    expect(screen.getByTestId("Prop-row-1-check")).toHaveAccessibleName(
      "Make blank@ucsb.edu to 24",
    );

    // The lectures left unfilled, with the reason in the page's words.
    expect(screen.getByTestId("Prop-skipped-heading")).toHaveTextContent(
      "Not proposed",
    );
    expect(screen.getByTestId("Prop-skipped-intro")).toHaveTextContent(
      "Lectures still to fill, and why nothing is proposed for them (these are the judgement calls):",
    );
    expect(
      [
        ...screen
          .getByTestId("Prop-skipped-header-group-0")
          .querySelectorAll("th"),
      ].map((th) => th.textContent),
    ).toEqual([
      "Lecture",
      "Places left",
      "Reason",
      "Candidate",
      "Also ranked by",
    ]);
    expect(cell("skipped", 0, "lecture")).toBe("16");
    expect(cell("skipped", 0, "left")).toBe("-1");
    expect(cell("skipped", 0, "reason")).toBe(
      "Its top remaining candidate is also ranked by another lecture that still has places.",
    );
    expect(cell("skipped", 0, "candidate")).toBe("Alan Turing (ranked 1)");
    expect(cell("skipped", 0, "alsoRankedBy")).toBe("8, 24");
    expect(screen.queryByTestId("Prop-none")).toBeNull();
    expect(screen.queryByTestId("Prop-all-filled")).toBeNull();
    expect(applies()).toHaveLength(0);
  });

  test("a ULA page has no Class Level or Major columns (issue #488)", async () => {
    axiosMock.onGet(PREVIEW_URL).reply(200, {
      version: 1,
      made: [{ applicationId: 5, recruitmentCourseId: 40, rank: 1, pass: 1 }],
      skipped: [],
    });
    renderModal({ page: assignmentsFixtures.ulaPage });

    expect(await screen.findByTestId("Prop-proposed")).toBeInTheDocument();
    expect(
      [
        ...screen
          .getByTestId("Prop-proposed-header-group-0")
          .querySelectorAll("th"),
      ].map((th) => th.textContent),
    ).toEqual(["Make", "Applicant", "Lecture", "Rank", "Preference", "Pass"]);
    expect(cell("proposed", 0, "applicant")).toBe("Edsger Dijkstra");
    expect(cell("proposed", 0, "lecture")).toBe("156");
    expect(cell("proposed", 0, "preference")).toBe("Would Consider");
    expect(screen.getByTestId("Prop-all-filled")).toHaveTextContent(
      "No lecture has places left to fill.",
    );
    expect(screen.queryByTestId("Prop-skipped")).toBeNull();
  });

  test("the tables sort, and a box stays with its row when the order changes", async () => {
    renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-row-0-check"));
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (1)");

    // A number column sorts descending first: the nameless applicant (rank 2) comes first.
    const rankHeader = screen.getByTestId(
      "Prop-proposed-header-rank-sort-header",
    );
    await userEvent.click(rankHeader);
    expect(columnTexts("proposed", "applicant")).toEqual([
      "blank@ucsb.edu",
      "Ada Lovelace",
    ]);
    // The Make column has nothing to sort by: no sorting cursor on its heading, unlike Rank's.
    expect(
      screen.getByTestId("Prop-proposed-header-check-sort-header"),
    ).not.toHaveStyle({ cursor: "pointer" });
    expect(rankHeader).toHaveStyle({ cursor: "pointer" });
    await userEvent.click(
      screen.getByTestId("Prop-proposed-header-check-sort-header"),
    );
    expect(columnTexts("proposed", "applicant")).toEqual([
      "blank@ucsb.edu",
      "Ada Lovelace",
    ]);
    // Ada's box (test ids follow the data's order, not the shown one) is still the unchecked one,
    // and it is the second box shown.
    expect(screen.getByTestId("Prop-row-0-check")).not.toBeChecked();
    expect(screen.getByTestId("Prop-row-1-check")).toBeChecked();
    const boxes = within(screen.getByTestId("Prop-proposed")).getAllByRole(
      "checkbox",
    );
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (1)");

    // Then ascending, then the sort is removed and the data's order is back.
    await userEvent.click(rankHeader);
    expect(columnTexts("proposed", "applicant")).toEqual([
      "Ada Lovelace",
      "blank@ucsb.edu",
    ]);
    await userEvent.click(rankHeader);
    expect(columnTexts("proposed", "applicant")).toEqual([
      "Ada Lovelace",
      "blank@ucsb.edu",
    ]);
    expect(screen.getByTestId("Prop-row-0-check")).not.toBeChecked();
  });

  // ---- the warnings ----

  test("warns when no ranking deadline is set", async () => {
    renderModal({
      recruitment: { ...settled, facultyRankingDeadline: null },
    });
    const warnings = screen.getByTestId("Prop-warnings");
    expect(within(warnings).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByTestId("Prop-warning-deadline")).toHaveTextContent(
      "No faculty ranking deadline is set, so rankings may still be arriving.",
    );
    expect(screen.getByTestId("Prop-warning-deadline")).toHaveClass(
      "text-danger",
    );
    // The warnings stay once the preview is in.
    await screen.findByTestId("Prop-proposed");
    expect(screen.getByTestId("Prop-warning-deadline")).toBeInTheDocument();
  });

  test("warns when the ranking deadline is still to come, naming it", () => {
    renderModal({
      recruitment: { ...settled, facultyRankingDeadline: "2099-12-31" },
    });
    expect(screen.getByTestId("Prop-warning-deadline")).toHaveTextContent(
      "The faculty ranking deadline (2099-12-31) has not passed, so rankings may still be arriving.",
    );
  });

  test("warns when assignments are published", () => {
    renderModal({ recruitment: { ...settled, assignmentsPublished: true } });
    expect(screen.getByTestId("Prop-warning-published")).toHaveTextContent(
      "Assignments are published: faculty will see these changes at once.",
    );
    expect(screen.queryByTestId("Prop-warning-deadline")).toBeNull();
  });

  test("no recruitment-based warnings while the recruitment is not known", () => {
    renderModal({ recruitment: undefined });
    expect(screen.queryByTestId("Prop-warnings")).toBeNull();
  });

  test("warns about a lecture, or lectures, still needing assignments with no rankings", () => {
    const page = assignmentsFixtures.taPage;
    const one = {
      ...page,
      courses: [...page.courses, { ...page.courses[0], id: 50 }],
    };
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ProposeAssignmentsModal
          recruitmentId="7"
          page={one}
          recruitment={settled}
          headers={{}}
          onUpdated={vi.fn()}
          onError={vi.fn()}
          onHide={vi.fn()}
          testIdPrefix="Prop"
        />
      </QueryClientProvider>,
    );
    // Two lectures with the course number 8 now: both are named with their section.
    expect(screen.getByTestId("Prop-warning-unranked")).toHaveTextContent(
      "This lecture still needs assignments but has no rankings yet, so nothing can be proposed for it and a proposal now could hand its instructor's favourite to another lecture: 8 (0100).",
    );
    unmount();

    const two = {
      ...page,
      courses: [
        ...page.courses,
        { ...page.courses[0], id: 50, courseId: "CMPSC   130A" },
        { ...page.courses[0], id: 60, courseId: "CMPSC   190DD", left: 3 },
      ],
    };
    renderModal({ page: two });
    expect(screen.getByTestId("Prop-warning-unranked")).toHaveTextContent(
      "These lectures still need assignments but have no rankings yet, so nothing can be proposed for them and a proposal now could hand their instructor's favourite to another lecture: 130A, 190DD.",
    );
  });

  test("the warnings are listed deadline, published, unranked", () => {
    renderModal({
      recruitment: {
        ...settled,
        facultyRankingDeadline: null,
        assignmentsPublished: true,
      },
      page: {
        ...assignmentsFixtures.taPage,
        courses: [
          ...assignmentsFixtures.taPage.courses,
          { ...assignmentsFixtures.taPage.courses[0], id: 50 },
        ],
      },
    });
    const items = within(screen.getByTestId("Prop-warnings")).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.getAttribute("data-testid"))).toEqual([
      "Prop-warning-deadline",
      "Prop-warning-published",
      "Prop-warning-unranked",
    ]);
  });

  // ---- choosing ----

  test("Select None empties the selection and disables Proceed; Select All restores it", async () => {
    renderModal();
    await screen.findByTestId("Prop-proposed");

    await userEvent.click(screen.getByTestId("Prop-select-none"));
    expect(screen.getByTestId("Prop-row-0-check")).not.toBeChecked();
    expect(screen.getByTestId("Prop-row-1-check")).not.toBeChecked();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (0)");
    expect(screen.getByTestId("Prop-proceed")).toBeDisabled();

    await userEvent.click(screen.getByTestId("Prop-select-all"));
    expect(screen.getByTestId("Prop-row-0-check")).toBeChecked();
    expect(screen.getByTestId("Prop-row-1-check")).toBeChecked();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (2)");
    expect(screen.getByTestId("Prop-proceed")).toBeEnabled();
  });

  test("a box can be unchecked and checked again, and the count follows", async () => {
    renderModal();
    await screen.findByTestId("Prop-proposed");
    const box = screen.getByTestId("Prop-row-1-check");

    await userEvent.click(box);
    expect(box).not.toBeChecked();
    expect(screen.getByTestId("Prop-row-0-check")).toBeChecked();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (1)");

    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (2)");
  });

  test("Cancel and the close button hide it without making anything", async () => {
    const { onHide, onUpdated } = renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-cancel"));
    expect(onHide).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onHide).toHaveBeenCalledTimes(2);
    expect(applies()).toHaveLength(0);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  // ---- nothing to propose ----

  test("when nothing can be proposed it says so, Proceed is disabled, and the Not proposed table explains", async () => {
    axiosMock.onGet(PREVIEW_URL).reply(200, autoAssignFixtures.previewNothing);
    renderModal();

    expect(await screen.findByTestId("Prop-none")).toHaveTextContent(
      "No no-conflict assignments can be proposed.",
    );
    expect(screen.queryByTestId("Prop-instruction")).toBeNull();
    expect(screen.queryByTestId("Prop-select-all")).toBeNull();
    expect(screen.queryByTestId("Prop-select-none")).toBeNull();
    expect(screen.queryByTestId("Prop-passes-note")).toBeNull();
    expect(screen.queryByTestId("Prop-proposed")).toBeNull();
    expect(screen.queryByTestId("Prop-proposed-heading")).toBeNull();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (0)");
    expect(screen.getByTestId("Prop-proceed")).toBeDisabled();
    expect(screen.getByTestId("Prop-cancel")).toBeEnabled();
    expect(columnTexts("skipped", "lecture")).toEqual([
      "8",
      "16",
      "24",
      "lecture 99",
    ]);
    expect(columnTexts("skipped", "left")).toEqual(["1", "-1", "0", ""]);
    expect(columnTexts("skipped", "reason")).toEqual([
      "Its top remaining candidate is not enthusiastic about it.",
      "Two or more remaining candidates share its top rank (1).",
      "No rankings yet.",
      "Every candidate it ranked is already assigned.",
    ]);
    expect(columnTexts("skipped", "candidate")).toEqual([
      "Grace Hopper (ranked 2)",
      "",
      "",
      "",
    ]);
    expect(columnTexts("skipped", "alsoRankedBy")).toEqual(["", "", "", ""]);
  });

  test("a TA preview left to a person for class level or major gives both reasons (issue #488)", async () => {
    axiosMock
      .onGet(PREVIEW_URL)
      .reply(200, autoAssignFixtures.previewManualOnly);
    renderModal();

    expect(await screen.findByTestId("Prop-none")).toBeInTheDocument();
    expect(columnTexts("skipped", "reason")).toEqual([
      "Its top remaining candidate is an MS student, so is assigned by hand only.",
      "Its top remaining candidate is not a Computer Science major, so is assigned by hand only.",
    ]);
    expect(columnTexts("skipped", "candidate")).toEqual([
      "Grace Hopper (ranked 1)",
      "Alan Turing (ranked 1)",
    ]);
  });

  test("one proposal and nothing else to fill: the all-filled line and no Not proposed table", async () => {
    axiosMock
      .onGet(PREVIEW_URL)
      .reply(200, autoAssignFixtures.previewAllFilled);
    renderModal();

    expect(await screen.findByTestId("Prop-proposed")).toBeInTheDocument();
    expect(screen.getByTestId("Prop-proceed")).toHaveTextContent("Proceed (1)");
    expect(screen.getByTestId("Prop-all-filled")).toHaveTextContent(
      "No lecture has places left to fill.",
    );
    expect(screen.queryByTestId("Prop-skipped-intro")).toBeNull();
    expect(screen.queryByTestId("Prop-skipped-heading")).toBeNull();
    expect(screen.queryByTestId("Prop-skipped")).toBeNull();
  });

  test("a failed preview is handed to the page and the modal closes", async () => {
    axiosMock.onGet(PREVIEW_URL).reply(500, { message: "Boom" });
    const { onError, onHide, onUpdated } = renderModal();

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].response.status).toBe(500);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
  });

  // ---- Proceed ----

  test("Proceed posts only the checked proposals with the preview's version and the client id, shows the page it answers with, toasts the count, then the final step", async () => {
    axiosMock.onPost(APPLY_URL).reply(200, autoAssignFixtures.appliedOne);
    const { onUpdated, onHide } = renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-row-1-check"));

    await userEvent.click(screen.getByTestId("Prop-proceed"));

    await waitFor(() => expect(applies()).toHaveLength(1));
    expect(applies()[0].params).toEqual({ recruitmentId: "7", version: 3 });
    expect(applies()[0].headers["X-Client-Id"]).toBe("tab-1");
    expect(JSON.parse(applies()[0].data)).toEqual([
      { applicationId: 1, recruitmentCourseId: 10, rank: 1, pass: 1 },
    ]);
    expect(await screen.findByTestId("Prop-result-modal")).toBeInTheDocument();
    expect(screen.queryByTestId("Prop-modal")).toBeNull();
    expect(onUpdated).toHaveBeenCalledWith(assignmentsFixtures.taPageAfterMove);
    expect(onHide).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith("1 assignment made.");
    expect(
      screen.getByText("Assignments made", { selector: ".modal-title" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("Prop-made-count")).toHaveTextContent(
      "1 assignment made.",
    );
    expect(screen.queryByTestId("Prop-not-made-intro")).toBeNull();
    expect(screen.queryByTestId("Prop-not-made")).toBeNull();
    expect(screen.getByTestId("Prop-undo")).toHaveTextContent("Undo this run");
    expect(screen.getByTestId("Prop-close")).toHaveTextContent("Close");
  });

  test("Proceed with everything checked sends both, in the preview's order, and the toast is plural", async () => {
    renderModal();
    await screen.findByTestId("Prop-proposed");

    await userEvent.click(screen.getByTestId("Prop-proceed"));

    await waitFor(() => expect(applies()).toHaveLength(1));
    expect(JSON.parse(applies()[0].data)).toEqual(
      autoAssignFixtures.preview.made,
    );
    expect(await screen.findByTestId("Prop-made-count")).toHaveTextContent(
      "2 assignments made.",
    );
    expect(mockToast).toHaveBeenCalledWith("2 assignments made.");
  });

  test("Proceed is disabled while the apply is pending", async () => {
    let release;
    axiosMock.onPost(APPLY_URL).reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, autoAssignFixtures.applied]);
        }),
    );
    renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-proceed"));
    await waitFor(() =>
      expect(screen.getByTestId("Prop-proceed")).toBeDisabled(),
    );
    release();
    expect(await screen.findByTestId("Prop-result-modal")).toBeInTheDocument();
  });

  test("the final step lists what could not be made, with the reason", async () => {
    axiosMock.onPost(APPLY_URL).reply(200, autoAssignFixtures.appliedPartly);
    renderModal();
    await screen.findByTestId("Prop-proposed");

    await userEvent.click(screen.getByTestId("Prop-proceed"));

    expect(await screen.findByTestId("Prop-made-count")).toHaveTextContent(
      "1 assignment made.",
    );
    expect(screen.getByTestId("Prop-not-made-intro")).toHaveTextContent(
      "Not made, because the assignments changed since the preview:",
    );
    const items = within(screen.getByTestId("Prop-not-made")).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toBe(screen.getByTestId("Prop-not-made-0"));
    expect(items.map((item) => item.textContent)).toEqual([
      "blank@ucsb.edu to 24: already assigned meanwhile.",
      "Grace Hopper to 16: the lecture is no longer on offer.",
      "applicant 99 to 8: the application is no longer in this recruitment.",
    ]);
    expect(screen.getByTestId("Prop-undo")).toBeInTheDocument();
  });

  test("when nothing selected could be made there is nothing to undo", async () => {
    axiosMock.onPost(APPLY_URL).reply(200, autoAssignFixtures.appliedNone);
    const { onUpdated } = renderModal();
    await screen.findByTestId("Prop-proposed");

    await userEvent.click(screen.getByTestId("Prop-proceed"));

    expect(await screen.findByTestId("Prop-made-count")).toHaveTextContent(
      "No assignments were made.",
    );
    expect(mockToast).toHaveBeenCalledWith("No assignments were made.");
    expect(onUpdated).toHaveBeenCalledWith(assignmentsFixtures.taPage);
    expect(screen.getByTestId("Prop-not-made-0")).toHaveTextContent(
      "Ada Lovelace to 8: already assigned meanwhile.",
    );
    expect(screen.queryByTestId("Prop-undo")).toBeNull();
    expect(screen.getByTestId("Prop-close")).toBeInTheDocument();
  });

  test("a failed apply is handed to the page and the modal closes", async () => {
    axiosMock.onPost(APPLY_URL).reply(409, {
      message: "Changed.",
      assignments: assignmentsFixtures.taPageAfterMove,
    });
    const { onError, onHide, onUpdated } = renderModal();
    await screen.findByTestId("Prop-proposed");

    await userEvent.click(screen.getByTestId("Prop-proceed"));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].response.status).toBe(409);
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(onUpdated).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(screen.queryByTestId("Prop-result-modal")).toBeNull();
  });

  // ---- undo ----

  test("Undo this run posts back what was made, with the version of the page as it now stands, and reports", async () => {
    const { onUpdated, onHide } = renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-proceed"));
    await screen.findByTestId("Prop-result-modal");

    await userEvent.click(screen.getByTestId("Prop-undo"));

    await waitFor(() => expect(undos()).toHaveLength(1));
    // The page prop is still the fixture (the parent is not re-rendering here), so its version.
    expect(undos()[0].params).toEqual({ recruitmentId: "7", version: 3 });
    expect(undos()[0].headers["X-Client-Id"]).toBe("tab-1");
    expect(JSON.parse(undos()[0].data)).toEqual(
      autoAssignFixtures.applied.made,
    );
    await waitFor(() => expect(onHide).toHaveBeenCalledTimes(1));
    expect(onUpdated).toHaveBeenLastCalledWith(assignmentsFixtures.taPage);
    expect(mockToast).toHaveBeenLastCalledWith("Undid 2 assignments.");
  });

  test("undoing one assignment is reported in the singular, and the button is disabled meanwhile", async () => {
    let release;
    axiosMock.onPost(UNDO_URL).reply(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve([
              200,
              { assignments: assignmentsFixtures.taPage, cleared: 1 },
            ]);
        }),
    );
    renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-proceed"));
    await userEvent.click(await screen.findByTestId("Prop-undo"));
    await waitFor(() => expect(screen.getByTestId("Prop-undo")).toBeDisabled());
    release();
    await waitFor(() =>
      expect(mockToast).toHaveBeenLastCalledWith("Undid 1 assignment."),
    );
  });

  test("a failed undo is handed to the page and the modal closes", async () => {
    axiosMock.onPost(UNDO_URL).reply(500, { message: "Boom" });
    const { onError, onHide } = renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-proceed"));
    await userEvent.click(await screen.findByTestId("Prop-undo"));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].response.status).toBe(500);
    expect(onHide).toHaveBeenCalledTimes(1);
    // Only the apply's toast; nothing about the undo.
    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  test("Close on the final step hides the modal", async () => {
    const { onHide } = renderModal();
    await screen.findByTestId("Prop-proposed");
    await userEvent.click(screen.getByTestId("Prop-proceed"));
    await userEvent.click(await screen.findByTestId("Prop-close"));
    expect(onHide).toHaveBeenCalledTimes(1);
    expect(undos()).toHaveLength(0);
  });
});
