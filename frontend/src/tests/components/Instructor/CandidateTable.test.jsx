import { act, fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import userEvent from "@testing-library/user-event";
import CandidateTable, {
  DEFAULT_SORT_TOOLTIP,
  TIED_WARNING,
} from "main/components/Instructor/CandidateTable";
import candidatesFixtures from "fixtures/candidatesFixtures";

const mock = new AxiosMockAdapter(axios);
const KEY = "candidateRanking.hiddenColumns.1.TA";
const apiUrl = "/api/instructor/recruitments/1/courses/2/candidates";
const applicationUrl = "/recruitments/1/courses/2/applications";
const taHeaders = [
  "Ranking",
  "Course Preference",
  "First Name",
  "Last Name",
  "Email",
  "Major",
  "Level (PhD/MS)",
  "Year in Program",
  "Expected Graduation",
];
const ulaHeaders = [
  ...taHeaders.slice(0, 6),
  "Year in Program",
  "Expected Graduation",
  "GPA in Major",
  "Overall GPA",
  "Quarters of Previous ULA Service",
  "Video Link",
];
function table(props = {}) {
  return render(
    <CandidateTable
      candidates={candidatesFixtures}
      type="TA"
      editable={true}
      apiUrl={apiUrl}
      applicationUrl={applicationUrl}
      columnsStorageKey={KEY}
      {...props}
    />,
  );
}
// A heading's accessible name also holds its "Hide ... column" link, when it has one.
const heading = (label) =>
  screen.getByRole("columnheader", {
    name: (name) => name === label || name.endsWith(` ${label}`),
  });
const headingLabels = () =>
  screen
    .getAllByRole("columnheader")
    .map((header) => within(header).getAllByRole("button").at(-1).textContent);
const input = (name = "Ada Lovelace") =>
  screen.getByRole("spinbutton", { name: `Ranking for ${name}` });
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0].textContent);
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

describe("CandidateTable", () => {
  beforeEach(() => {
    localStorage.clear();
    mock.reset();
    mock.resetHistory();
    mock.onPut().reply(200, { rank: 1, version: 4 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    ["TA", taHeaders],
    ["ULA", ulaHeaders],
  ])(
    "%s has the exact type-specific ordered sortable columns and name links",
    (type, expected) => {
      table({ type });
      expect(headingLabels()).toEqual(expected);
      expect(names()).toEqual(["Ada", "Grace", "Alan", "Katherine"]);
      for (const label of expected)
        expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      for (const candidate of candidatesFixtures) {
        for (const name of [candidate.firstName, candidate.lastName]) {
          const link = screen.getByRole("link", { name, exact: true });
          expect(link).toHaveAttribute(
            "href",
            `${applicationUrl}/${candidate.applicationId}`,
          );
          expect(link).toHaveAttribute("target", "_blank");
          expect(link).toHaveAttribute("rel", "noopener noreferrer");
        }
      }
      if (type === "TA") expect(screen.getAllByText("PhD")).toHaveLength(2);
    },
  );

  test("preference has semantic, reversible sorting, not alphabetical order", () => {
    table({ candidates: [...candidatesFixtures].reverse() });
    fireEvent.click(screen.getByRole("button", { name: "Course Preference" }));
    expect(names()).toEqual(["Ada", "Grace", "Alan", "Katherine"]);
    expect(heading("Course Preference")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    fireEvent.click(screen.getByRole("button", { name: "Course Preference" }));
    expect(names()).toEqual(["Katherine", "Alan", "Grace", "Ada"]);
    expect(heading("Course Preference")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  // Submission order is the order of the array: 1 F, 2 A, 3 B, 4 C, 5 D, 6 E.
  const submitted = [
    ["F", null, "2nd Choice"],
    ["A", null, "1st Choice"],
    ["B", 2, "Would Consider"],
    ["C", 2, "Enthusiastic"],
    ["D", 1, "Would Consider"],
    ["E", null, "1st Choice"],
  ].map(([firstName, rank, preference], i) => ({
    ...candidatesFixtures[0],
    applicationId: i + 1,
    firstName,
    lastName: `${firstName}son`,
    rank,
    preference,
  }));

  test("the page starts in the default sort: ranking, then preference, then submission order", () => {
    table({ candidates: submitted });
    // Ranked first (1, then the two 2s by preference), then the unranked by preference, with
    // equal preferences in submission order (A before E).
    expect(names()).toEqual(["D", "C", "B", "A", "E", "F"]);
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("aria-sort", "none");
    }
  });

  test("equal ranking and equal preference stay in submission order", () => {
    table({
      candidates: submitted.map((candidate) => ({
        ...candidate,
        rank: 1,
        preference: "Enthusiastic",
      })),
    });
    expect(names()).toEqual(["F", "A", "B", "C", "D", "E"]);
  });

  test("Not Interested candidates sort after the others with the same ranking", () => {
    table({
      candidates: [
        { ...submitted[0], rank: null, preference: "Not Interested" },
        { ...submitted[1], rank: null, preference: "Would Consider" },
      ],
    });
    expect(names()).toEqual(["A", "F"]);
  });

  test("Default Sort goes back to the default after sorting by another column", () => {
    table({ candidates: submitted });
    fireEvent.click(screen.getByRole("button", { name: "First Name" }));
    expect(names()).toEqual(["A", "B", "C", "D", "E", "F"]);
    fireEvent.click(screen.getByRole("button", { name: "Default Sort" }));
    expect(names()).toEqual(["D", "C", "B", "A", "E", "F"]);
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("aria-sort", "none");
    }
  });

  test("the first click on a column after the default sort is ascending", () => {
    table({ candidates: submitted });
    fireEvent.click(screen.getByRole("button", { name: "Course Preference" }));
    expect(heading("Course Preference")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  test("Default Sort has a tooltip that explains the order", async () => {
    table({ candidates: submitted });
    const button = screen.getByTestId("CandidateTable-default-sort");
    expect(button).toHaveTextContent("Default Sort");
    await userEvent.hover(button);
    const tooltip = await screen.findByText(DEFAULT_SORT_TOOLTIP);
    expect(tooltip.closest('[role="tooltip"]')).toHaveAttribute(
      "id",
      "CandidateTable-default-sort-tooltip",
    );
    expect(DEFAULT_SORT_TOOLTIP).toMatch(/faculty ranking/);
    expect(DEFAULT_SORT_TOOLTIP).toMatch(/course preference/);
    expect(DEFAULT_SORT_TOOLTIP).toMatch(
      /order the applications were submitted/,
    );
  });

  test("typing a ranking does not move the row until Default Sort is clicked", () => {
    table({ candidates: submitted });
    expect(names()).toEqual(["D", "C", "B", "A", "E", "F"]);
    fireEvent.change(input("F Fson"), {
      target: { value: "1" },
    });
    expect(names()).toEqual(["D", "C", "B", "A", "E", "F"]);
    fireEvent.click(screen.getByRole("button", { name: "Default Sort" }));
    // F and D now both have ranking 1. F's preference (2nd Choice) is stronger than D's
    // (Would Consider), so F comes first.
    expect(names()).toEqual(["F", "D", "C", "B", "A", "E"]);
  });

  test.each([
    ["First Name", ["Ada", "Alan", "Grace", "Katherine"]],
    ["Last Name", ["Grace", "Katherine", "Ada", "Alan"]],
    ["Email", ["Ada", "Alan", "Grace", "Katherine"]],
    ["Major", ["Ada", "Grace", "Katherine", "Alan"]],
    ["Level (PhD/MS)", ["Grace", "Ada", "Alan", "Katherine"]],
    ["Year in Program", ["Grace", "Ada", "Katherine", "Alan"]],
    ["Expected Graduation", ["Grace", "Ada", "Katherine", "Alan"]],
  ])("%s sorts both directions", (label, expected) => {
    table();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(names()).toEqual(expected);
    expect(heading(label)).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByRole("button", { name: label }));
    // Equal keys keep their stable source order.
    const descending =
      label === "Major"
        ? ["Alan", "Grace", "Katherine", "Ada"]
        : label === "Level (PhD/MS)"
          ? ["Katherine", "Ada", "Alan", "Grace"]
          : [...expected].reverse();
    expect(names()).toEqual(descending);
  });

  test.each([
    ["GPA in Major", ["Grace", "Ada", "Alan", "Katherine"]],
    ["Overall GPA", ["Grace", "Ada", "Alan", "Katherine"]],
    ["Quarters of Previous ULA Service", ["Katherine", "Alan", "Ada", "Grace"]],
    ["Video Link", ["Ada", "Alan", "Grace", "Katherine"]],
  ])(
    "ULA %s sorts numerically where appropriate, in both directions",
    (label, expected) => {
      table({ type: "ULA" });
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(names()).toEqual(expected);
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(names()).toEqual([...expected].reverse());
    },
  );

  /** Issue #292: no GPAs yet, so the cells say so, and sorting by GPA does not trip over them. */
  describe("a first quarter candidate", () => {
    const firstQuarterCandidates = () =>
      candidatesFixtures.map((candidate) =>
        candidate.firstName === "Ada"
          ? {
              ...candidate,
              firstQuarter: true,
              gpaMajor: null,
              gpaOverall: null,
            }
          : { ...candidate, firstQuarter: false },
      );
    const gpaCells = (name) => {
      const row = screen
        .getAllByRole("row")
        .find((r) => within(r).queryAllByText(name).length > 0);
      return within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent)
        .slice(8, 10);
    };

    test("has First quarter in both GPA cells, and the others their numbers", () => {
      table({ type: "ULA", candidates: firstQuarterCandidates() });

      expect(gpaCells("Ada")).toEqual(["First quarter", "First quarter"]);
      expect(gpaCells("Grace")).not.toContain("First quarter");
      expect(gpaCells("Grace")[0]).toMatch(/^\d\.\d+$/);
    });

    test.each(["GPA in Major", "Overall GPA"])(
      "sorts by %s with the first quarter candidate after those with a GPA, and back again",
      (label) => {
        table({ type: "ULA", candidates: firstQuarterCandidates() });

        fireEvent.click(screen.getByRole("button", { name: label }));
        expect(names().at(-1)).toBe("Ada");
        fireEvent.click(screen.getByRole("button", { name: label }));
        expect(names()[0]).toBe("Ada");
      },
    );
  });

  test("rank sorts numbers and puts blanks after ranks; equal blanks are stable", () => {
    table({
      candidates: candidatesFixtures.map((candidate, i) => ({
        ...candidate,
        rank: i === 0 ? 2 : i === 1 ? 1 : null,
      })),
    });
    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));
    expect(names()).toEqual(["Grace", "Ada", "Alan", "Katherine"]);
    fireEvent.click(screen.getByRole("button", { name: "Ranking" }));
    expect(names()).toEqual(["Alan", "Katherine", "Ada", "Grace"]);
  });

  test("valid edits and clearing call the backend immediately, with saving and saved states", async () => {
    let finish;
    mock.resetHandlers();
    mock.onPut(`${apiUrl}/1/rank`).reply(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    table();
    expect(input()).toHaveValue(1);
    expect(input()).toHaveAttribute("min", "1");
    expect(input()).toHaveAttribute("max", "4");
    expect(input()).toHaveAttribute("step", "1");
    fireEvent.change(input(), { target: { value: "4" } });
    expect(mock.history.put).toHaveLength(1);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ rank: 4 });
    expect(screen.getByRole("status")).toHaveTextContent("Saving...");
    await act(async () => finish([200, { rank: 4 }]));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    mock.onPut(`${apiUrl}/1/rank`).reply(200, { rank: null });
    fireEvent.change(input(), { target: { value: "" } });
    expect(mock.history.put).toHaveLength(2);
    expect(JSON.parse(mock.history.put[1].data)).toEqual({ rank: null });
    expect(input()).toHaveValue(null);
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  test("onSaved is called after a successful save, never before it and never after a failure", async () => {
    const onSaved = vi.fn();
    let finish;
    mock.resetHandlers();
    mock.onPut(`${apiUrl}/1/rank`).reply(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    table({ onSaved });
    fireEvent.change(input(), { target: { value: "3" } });
    expect(onSaved).not.toHaveBeenCalled();
    await act(async () => finish([200, { rank: 3 }]));
    expect(onSaved).toHaveBeenCalledTimes(1);

    mock
      .onPut(`${apiUrl}/1/rank`)
      .reply(500, { message: "Database unavailable" });
    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test("saving works without an onSaved callback", async () => {
    table();
    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  test.each(["0", "-1", "5", "1.5"])("invalid rank %s is not sent", (value) => {
    table();
    fireEvent.change(input(), { target: { value } });
    expect(mock.history.put).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an integer from 1 through 4, or clear the rank.",
    );
  });

  test("a browser-rejected partial number is not mistaken for clearing a saved rank", () => {
    table();
    Object.defineProperty(input(), "validity", {
      configurable: true,
      value: { badInput: true },
    });

    fireEvent.change(input(), { target: { value: "" } });
    expect(mock.history.put).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an integer from 1 through 4, or clear the rank.",
    );
  });

  test("an earlier successful save cannot erase a newer browser validation error", async () => {
    let finish;
    mock.onPut().reply(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    table();
    fireEvent.change(input(), { target: { value: "2" } });
    Object.defineProperty(input(), "validity", {
      configurable: true,
      value: { badInput: true },
    });
    fireEvent.change(input(), { target: { value: "" } });
    await act(async () => finish([200, { rank: 2 }]));
    expect(mock.history.put).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an integer from 1 through 4, or clear the rank.",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  test("serializes all writes, ignores stale response, and saves another candidate after them", async () => {
    // One version covers the whole list, so every save waits for the one before it.
    const resolvers = [];
    mock.resetHandlers();
    mock
      .onPut(`${apiUrl}/1/rank`)
      .reply(() => new Promise((resolve) => resolvers.push(resolve)));
    mock.onPut(`${apiUrl}/2/rank`).reply(200, { rank: 4, version: 7 });
    table();
    fireEvent.change(input(), { target: { value: "2" } });
    fireEvent.change(input(), { target: { value: "3" } });
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.change(input("Grace Hopper"), { target: { value: "4" } });
    expect(mock.history.put.map((request) => request.url)).toEqual([
      `${apiUrl}/1/rank`,
    ]);
    expect(input()).toHaveValue(null);
    await act(async () => resolvers[0]([200, { rank: 2, version: 4 }]));
    expect(mock.history.put).toHaveLength(2);
    expect(JSON.parse(mock.history.put[1].data)).toEqual({ rank: 3 });
    expect(mock.history.put[1].params).toEqual({ version: 4 });
    expect(input()).toHaveValue(null);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Saving...");
    await act(async () => resolvers[1]([500, { message: "stale failure" }]));
    expect(screen.queryByText(/stale failure/)).not.toBeInTheDocument();
    expect(mock.history.put).toHaveLength(3);
    expect(JSON.parse(mock.history.put[2].data)).toEqual({ rank: null });
    await act(async () => resolvers[2]([200, { rank: null, version: 6 }]));
    expect(mock.history.put).toHaveLength(4);
    expect(mock.history.put[3].url).toBe(`${apiUrl}/2/rank`);
    expect(mock.history.put[3].params).toEqual({ version: 6 });
    await settle();
    expect(input()).toHaveValue(null);
    expect(
      screen
        .getAllByRole("status")
        .every((status) => status.textContent === "Saved"),
    ).toBe(true);
  });

  test("save failures stay explicit and retry submits the current edit", async () => {
    mock.onPut().reply(500, { message: "Database unavailable" });
    table();
    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Save failed: Database unavailable",
    );
    expect(input()).toHaveValue(2);
    mock.onPut().reply(200, { rank: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mock.history.put).toHaveLength(2);
    expect(JSON.parse(mock.history.put[1].data)).toEqual({ rank: 2 });
    await settle();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  test("ties save immediately but only highlight and warn at exactly two seconds; clearing removes both immediately", async () => {
    vi.useFakeTimers();
    table();
    fireEvent.change(input("Grace Hopper"), { target: { value: "1" } });
    expect(mock.history.put).toHaveLength(1);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ rank: 1 });
    const cells = [input().closest("td"), input("Grace Hopper").closest("td")];
    expect(
      screen.queryByText(/You have ranked multiple candidates/),
    ).not.toBeInTheDocument();
    expect(cells[0]).not.toHaveStyle({ backgroundColor: "#ffff00" });
    act(() => vi.advanceTimersByTime(1999));
    expect(
      screen.queryByText(/You have ranked multiple candidates/),
    ).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    const warning = screen.getByText(/You have ranked multiple candidates/);
    expect(warning.textContent).toBe(
      "You have ranked multiple candidates with the same rank.  Are you sure you have no preference among these candidates?",
    );
    expect(TIED_WARNING).toBe(warning.textContent);
    expect(
      screen.getByTestId(
        `CandidateTable-tied-warning-${candidatesFixtures[1].applicationId}`,
      ),
    ).toContainElement(warning);
    expect(warning).toHaveAttribute("role", "alert");
    expect(warning.querySelector("svg")).toBeInTheDocument();
    const cell = warning.closest("td");
    expect(cell.getAttribute("style")).toBe("font-size: 0.8em;");
    expect(cell).toHaveAttribute("colspan", "9");
    expect(cell.closest("tr")).toHaveClass("text-danger");
    // Directly under the last row of the tied group (Ada, then Grace by preference).
    expect(cell.closest("tr").previousElementSibling).toBe(
      cells[1].closest("tr"),
    );
    expect(cells[0].closest("tr").nextElementSibling).toBe(
      cells[1].closest("tr"),
    );
    cells.forEach((cell) =>
      expect(cell).toHaveStyle({ backgroundColor: "#ffff00" }),
    );
    fireEvent.change(input("Grace Hopper"), { target: { value: "" } });
    expect(
      screen.queryByText(/You have ranked multiple candidates/),
    ).not.toBeInTheDocument();
    cells.forEach((cell) =>
      expect(cell).not.toHaveStyle({ backgroundColor: "#ffff00" }),
    );
    await settle();
  });

  test("each group of tied rankings gets its own warning under its last row, wherever sorting puts it", async () => {
    vi.useFakeTimers();
    table();
    // Ada 1, Grace 1; Alan 2, Katherine 2; Edsger unranked.
    [
      ["Grace Hopper", "1"],
      ["Alan Turing", "2"],
      ["Katherine Johnson", "2"],
    ].forEach(([name, value]) =>
      fireEvent.change(input(name), { target: { value } }),
    );
    act(() => vi.advanceTimersByTime(2000));
    const warnings = () => screen.getAllByText(/You have ranked multiple/);
    expect(warnings()).toHaveLength(2);
    const rowOf = (name) => input(name).closest("tr");
    expect(rowOf("Grace Hopper").nextElementSibling).toContainElement(
      warnings()[0],
    );
    expect(rowOf("Katherine Johnson").nextElementSibling).toContainElement(
      warnings()[1],
    );
    expect(rowOf("Ada Lovelace").nextElementSibling).toBe(
      rowOf("Grace Hopper"),
    );
    // The last warning is the last row of the table.
    expect(
      rowOf("Katherine Johnson").nextElementSibling.nextElementSibling,
    ).toBe(null);
    // Sorted by last name the groups are no longer adjacent; still one warning per group,
    // under the last row of each group in the displayed order.
    fireEvent.click(screen.getByRole("button", { name: "Last Name" }));
    expect(warnings()).toHaveLength(2);
    // Order: Hopper, Johnson, Lovelace, Turing.
    expect(rowOf("Alan Turing").nextElementSibling).toContainElement(
      warnings()[1],
    );
    expect(rowOf("Ada Lovelace").nextElementSibling).toContainElement(
      warnings()[0],
    );
    expect(rowOf("Grace Hopper").nextElementSibling).toBe(
      rowOf("Katherine Johnson"),
    );
    expect(rowOf("Katherine Johnson").nextElementSibling).toBe(
      rowOf("Ada Lovelace"),
    );
    await settle();
  });

  test("tie timer recomputes on edits, blanks never tie, and unmount cleans pending timers and writes", async () => {
    vi.useFakeTimers();
    let finish;
    mock.onPut().reply(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { unmount } = table();
    act(() => vi.advanceTimersByTime(2000));
    expect(
      screen.queryByText(/You have ranked multiple candidates/),
    ).not.toBeInTheDocument();
    fireEvent.change(input("Grace Hopper"), { target: { value: "1" } });
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.change(input("Alan Turing"), { target: { value: "1" } });
    act(() => vi.advanceTimersByTime(1999));
    expect(
      screen.queryByText(/You have ranked multiple candidates/),
    ).not.toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => finish([500, { message: "gone" }]));
    expect(screen.queryByText(/gone/)).not.toBeInTheDocument();
  });

  test("read-only and empty states have no edit controls or backend writes", () => {
    const { unmount } = table({ editable: false });
    expect(screen.getByText("Rankings are read-only.")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(mock.history.put).toHaveLength(0);
    unmount();
    table({ candidates: [] });
    expect(
      screen.getByText("No eligible candidates for this course."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  test("reload shows persisted ranks, not previous unsaved local state", () => {
    const first = table({ editable: false });
    expect(
      within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0],
    ).toHaveTextContent("1");
    first.unmount();
    table({
      candidates: candidatesFixtures.map((candidate) => ({
        ...candidate,
        rank: 2,
      })),
    });
    expect(input()).toHaveValue(2);
  });

  // ---- issue #199: interest colours and symbols, right-aligned ranks ----

  test("the preference cell is coloured and marked by the applicant's interest", () => {
    table({
      candidates: [
        ...candidatesFixtures,
        {
          ...candidatesFixtures[0],
          applicationId: 98,
          rank: null,
          preference: "Would Consider",
          firstName: "Barbara",
          lastName: "Liskov",
        },
        {
          ...candidatesFixtures[0],
          applicationId: 99,
          rank: null,
          preference: "Not Interested",
          firstName: "Edsger",
          lastName: "Dijkstra",
        },
      ],
    });

    const cell = (id) => screen.getByTestId(`CandidateTable-preference-${id}`);
    const mark = (id) =>
      screen.getByTestId(`CandidateTable-preference-${id}-mark`);
    expect(cell(1).style.backgroundColor).toBe("rgb(209, 231, 221)");
    expect(cell(1)).toHaveTextContent("➊1st Choice");
    expect(mark(1).style.fontSize).toBe("120%");
    expect(cell(2).style.backgroundColor).toBe("rgb(209, 231, 221)");
    expect(mark(2)).toHaveTextContent("➋");
    expect(cell(98).style.backgroundColor).toBe("rgb(255, 243, 205)");
    expect(mark(98)).toHaveTextContent("▬");
    expect(mark(98)).toHaveAttribute(
      "title",
      "Applicant would consider this course",
    );
    expect(cell(99).style.backgroundColor).toBe("rgb(248, 215, 218)");
    expect(mark(99)).toHaveTextContent("✖");
    expect(cell(99)).toHaveTextContent("Not Interested");
    // Not Interested sorts after every other preference.
    expect(names().at(-1)).toBe("Edsger");
    expect(names().at(-2)).toBe("Barbara");
  });

  test("the ranking column is right-aligned and the other cells are not", () => {
    table();
    const row = screen.getAllByRole("row")[1];
    const cells = within(row).getAllByRole("cell");
    expect(cells[0]).toHaveClass("text-end");
    expect(cells[1]).not.toHaveClass("text-end");
    expect(cells[2]).not.toHaveClass("text-end");
    expect(cells[2]).not.toHaveAttribute("data-testid");
    // Only the preference cell is coloured by interest.
    expect(cells[1].style.backgroundColor).not.toBe("");
    expect(cells[2].style.backgroundColor).toBe("");
    expect(cells[0].style.backgroundColor).toBe("");
  });

  /** Issue #205: video links are clickable. */
  test("a ULA candidate's video link is a link that opens in a new tab", () => {
    table({ type: "ULA" });

    const ada = candidatesFixtures[0];
    const link = screen.getByTestId(
      `CandidateTable-video-${ada.applicationId}`,
    );
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", ada.videoLink);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent(ada.videoLink);
    expect(ada.videoLink).toBe("https://example.edu/ada");
  });

  test("a candidate without a video link gets an empty cell, not a link", () => {
    table({
      type: "ULA",
      candidates: [{ ...candidatesFixtures[0], videoLink: null }],
    });
    expect(
      screen.queryByTestId("CandidateTable-video-31"),
    ).not.toBeInTheDocument();
  });

  // ---- Issue #279: the version of the course's ranking list

  const CHANGED =
    "Rankings for this course changed while you were editing; your change has not been saved.";
  const conflict = (version = 9) => [
    409,
    { message: "Rankings for this course changed", version },
  ];
  /** The candidates as another instructor left them: Ada now 3, Grace 1, at the given version. */
  const reread = (version = 9) => [
    { ...candidatesFixtures[0], rank: 3, rankingVersion: version },
    { ...candidatesFixtures[1], rank: 1, rankingVersion: version },
    { ...candidatesFixtures[2], rankingVersion: version },
    { ...candidatesFixtures[3], rankingVersion: version },
  ];

  test("a save names the version the candidates were read at and this tab, and moves it on", async () => {
    mock.resetHandlers();
    mock.onPut().reply(200, { rank: 2, version: 4 });
    table({ headers: { "X-Client-Id": "tab-1" } });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    fireEvent.change(input("Grace Hopper"), { target: { value: "1" } });
    await settle();

    expect(mock.history.put[0].params).toEqual({ version: 3 });
    expect(mock.history.put[0].headers["X-Client-Id"]).toBe("tab-1");
    expect(mock.history.put[1].params).toEqual({ version: 4 });
  });

  test("a refused save says so, keeps the typed ranking, reads the list again and uses its version", async () => {
    mock.resetHandlers();
    mock
      .onPut()
      .replyOnce(...conflict())
      .onPut()
      .reply(200, { rank: 3, version: 10 });
    const onConflict = vi.fn().mockResolvedValue(reread());
    table({ onConflict });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();

    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent(CHANGED);
    // The typed 2 stays in the box; the others show what the server now has.
    expect(input()).toHaveValue(2);
    expect(input("Grace Hopper")).toHaveValue(1);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    // Not saved, so not sent again by itself.
    expect(mock.history.put).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Save again" }));
    await settle();

    expect(mock.history.put).toHaveLength(2);
    expect(mock.history.put[1].params).toEqual({ version: 9 });
    expect(JSON.parse(mock.history.put[1].data)).toEqual({ rank: 2 });
    expect(
      screen.queryByRole("button", { name: "Save again" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  test("the default sort follows the list that was read again", async () => {
    mock.resetHandlers();
    mock.onPut().reply(...conflict());
    table({ onConflict: async () => reread() });

    fireEvent.change(input("Alan Turing"), { target: { value: "2" } });
    await settle();

    // Grace 1, Alan 2 (typed), Ada 3, then Katherine (unranked).
    expect(names()).toEqual(["Grace", "Ada", "Alan", "Katherine"]);
  });

  test("edits queued behind a refused one are not sent and say the same", async () => {
    mock.resetHandlers();
    const resolvers = [];
    mock.onPut().reply(() => new Promise((resolve) => resolvers.push(resolve)));
    const onConflict = vi.fn().mockResolvedValue(reread());
    table({ onConflict });

    fireEvent.change(input(), { target: { value: "2" } });
    fireEvent.change(input("Grace Hopper"), { target: { value: "4" } });
    await act(async () => resolvers[0](conflict()));
    await settle();

    expect(mock.history.put).toHaveLength(1);
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      CHANGED,
      CHANGED,
    ]);
    // Both typed values are kept, for the instructor to look at and save again.
    expect(input()).toHaveValue(2);
    expect(input("Grace Hopper")).toHaveValue(4);
    expect(screen.getAllByRole("button", { name: "Save again" })).toHaveLength(
      2,
    );
  });

  test("a later edit to a row whose save was refused clears the message", async () => {
    mock.resetHandlers();
    mock
      .onPut()
      .replyOnce(...conflict())
      .onPut()
      .reply(200, { rank: 4, version: 10 });
    table({ onConflict: async () => reread() });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    fireEvent.change(input(), { target: { value: "4" } });
    await settle();

    expect(screen.queryByText(CHANGED)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(mock.history.put[1].params).toEqual({ version: 9 });
  });

  test("when the list cannot be read again the message still shows and the version is kept", async () => {
    mock.resetHandlers();
    mock.onPut().reply(...conflict());
    table({ onConflict: async () => null });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    fireEvent.change(input(), { target: { value: "3" } });
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent(CHANGED);
    expect(input()).toHaveValue(3);
    expect(mock.history.put[1].params).toEqual({ version: 3 });
  });

  test("an empty list read again keeps the version", async () => {
    mock.resetHandlers();
    mock.onPut().reply(...conflict());
    table({ onConflict: async () => [] });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    fireEvent.change(input(), { target: { value: "3" } });
    await settle();

    expect(mock.history.put[1].params).toEqual({ version: 3 });
  });

  test("without a handler for it a refusal still keeps the edit and says so", async () => {
    mock.resetHandlers();
    mock.onPut().reply(...conflict());
    table();

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent(CHANGED);
    expect(input()).toHaveValue(2);
  });

  test("leaving while the list is being read again touches nothing", async () => {
    mock.resetHandlers();
    mock.onPut().reply(...conflict());
    let finish;
    const onConflict = () => new Promise((resolve) => (finish = resolve));
    const { unmount } = table({ onConflict });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    unmount();
    await act(async () => finish(reread()));

    expect(mock.history.put).toHaveLength(1);
  });

  test("another kind of failure is not taken for a refusal", async () => {
    mock.resetHandlers();
    mock.onPut().reply(500, { message: "Database unavailable" });
    const onConflict = vi.fn();
    table({ onConflict });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();

    expect(onConflict).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Save failed: Database unavailable",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("a failure that is not an HTTP answer is not taken for a refusal", async () => {
    mock.resetHandlers();
    mock.onPut().networkError();
    table({ onConflict: vi.fn() });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("Save failed:");
  });

  test("a failure that is null is not taken for a refusal", async () => {
    const put = vi.spyOn(axios, "put").mockRejectedValueOnce(null);
    table({ onConflict: vi.fn() });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("Save failed:");
    put.mockRestore();
  });

  test("a refusal of an edit that has since been replaced says nothing about the old one", async () => {
    mock.resetHandlers();
    const resolvers = [];
    mock.onPut().reply(() => new Promise((resolve) => resolvers.push(resolve)));
    table({ onConflict: () => new Promise(() => {}) });

    fireEvent.change(input(), { target: { value: "2" } });
    fireEvent.change(input(), { target: { value: "3" } });
    await act(async () => resolvers[0](conflict()));
    await settle();

    expect(screen.queryByText(CHANGED)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saving...");
  });

  test("a row that was saved before the refusal shows the list read again, not what was typed", async () => {
    mock.resetHandlers();
    mock.onPut(`${apiUrl}/1/rank`).reply(200, { rank: 2, version: 4 });
    mock.onPut(`${apiUrl}/2/rank`).reply(...conflict());
    table({
      onConflict: async () =>
        reread().map((c) => ({
          ...c,
          rank: c.applicationId === 1 ? 5 : c.rank,
        })),
    });

    fireEvent.change(input(), { target: { value: "2" } });
    await settle();
    fireEvent.change(input("Grace Hopper"), { target: { value: "4" } });
    await settle();

    expect(input()).toHaveValue(5);
    expect(input("Grace Hopper")).toHaveValue(4);
  });

  test("candidates the list read again leaves unranked sort after the ranked ones", async () => {
    mock.resetHandlers();
    mock.onPut().reply(...conflict());
    table({
      onConflict: async () =>
        candidatesFixtures.map((c) => ({
          ...c,
          rank: c.applicationId === 4 ? 1 : null,
          rankingVersion: 9,
        })),
    });

    fireEvent.change(input("Grace Hopper"), { target: { value: "2" } });
    await settle();

    expect(names()).toEqual(["Katherine", "Ada", "Grace", "Alan"]);
  });

  test("a save made while an earlier one is still being sent waits for it", async () => {
    mock.resetHandlers();
    const resolvers = [];
    mock.onPut().reply(() => new Promise((resolve) => resolvers.push(resolve)));
    table();

    fireEvent.change(input(), { target: { value: "2" } });
    fireEvent.change(input("Grace Hopper"), { target: { value: "4" } });
    await act(async () => resolvers[0]([200, { rank: 2, version: 4 }]));
    await settle();
    expect(mock.history.put).toHaveLength(2);

    fireEvent.change(input("Alan Turing"), { target: { value: "1" } });
    await settle();

    expect(mock.history.put).toHaveLength(2);
    await act(async () => resolvers[1]([200, { rank: 4, version: 5 }]));
    await settle();
    expect(mock.history.put).toHaveLength(3);
    expect(mock.history.put[2].params).toEqual({ version: 5 });
  });

  describe("hiding columns (issue #312)", () => {
    const headerTexts = headingLabels;
    const hideLabel = (label) => `Hide ${label} column`;

    test("the Columns menu offers every column except Ranking and the names", async () => {
      table();
      await userEvent.click(
        screen.getByTestId("CandidateTable-columns-toggle"),
      );
      for (const id of [
        "preference",
        "email",
        "major",
        "classLevel",
        "yearInProgram",
        "graduationDate",
      ])
        expect(
          screen.getByTestId(`CandidateTable-columns-${id}`),
        ).toBeChecked();
      for (const id of ["rank", "firstName", "lastName"])
        expect(
          screen.queryByTestId(`CandidateTable-columns-${id}`),
        ).not.toBeInTheDocument();
    });

    test("only the hideable headings have a hide link", () => {
      table();
      for (const label of ["Ranking", "First Name", "Last Name"])
        expect(
          screen.queryByRole("button", { name: hideLabel(label) }),
        ).not.toBeInTheDocument();
      for (const label of taHeaders.filter(
        (l) => !["Ranking", "First Name", "Last Name"].includes(l),
      ))
        expect(
          screen.getByRole("button", { name: hideLabel(label) }),
        ).toHaveTextContent("hide");
    });

    test("a hide link is tucked into the heading's top-right corner", () => {
      table();
      const link = screen.getByTestId("CandidateTable-hide-email");
      expect(link.getAttribute("style")).toBe(
        "position: absolute; top: 0px; right: 0.25rem; font-size: 0.6rem; line-height: 1.2;",
      );
      expect(link).toHaveAttribute("type", "button");
      expect(link).toHaveClass("btn", "btn-link", "text-secondary");
      expect(link.closest("th")).toHaveStyle({ position: "relative" });
    });

    test("a hide link hides its column, heading and cells, and it is remembered", async () => {
      table();
      await userEvent.click(screen.getByTestId("CandidateTable-hide-email"));
      expect(headerTexts()).not.toContain("Email");
      expect(headerTexts()).toHaveLength(taHeaders.length - 1);
      expect(JSON.parse(localStorage.getItem(KEY))).toEqual(["email"]);
      expect(screen.getAllByRole("row")[1].querySelectorAll("td")).toHaveLength(
        taHeaders.length - 1,
      );
    });

    test("a column unticked in the menu is hidden and ticking it brings it back", async () => {
      table();
      await userEvent.click(
        screen.getByTestId("CandidateTable-columns-toggle"),
      );
      await userEvent.click(screen.getByTestId("CandidateTable-columns-major"));
      expect(headerTexts()).not.toContain("Major");
      expect(
        screen.getByTestId("CandidateTable-columns-toggle"),
      ).toHaveTextContent("Columns (1 hidden)");
      await userEvent.click(screen.getByTestId("CandidateTable-columns-major"));
      expect(headerTexts()).toEqual(taHeaders);
    });

    test("Show None leaves Ranking and the names; Show All restores the rest", async () => {
      table();
      await userEvent.click(
        screen.getByTestId("CandidateTable-columns-toggle"),
      );
      await userEvent.click(
        screen.getByTestId("CandidateTable-columns-select-none"),
      );
      expect(headerTexts()).toEqual(["Ranking", "First Name", "Last Name"]);
      expect(input()).toBeInTheDocument();
      await userEvent.click(
        screen.getByTestId("CandidateTable-columns-select-all"),
      );
      expect(headerTexts()).toEqual(taHeaders);
    });

    test("the hidden columns are read from this browser's storage", () => {
      localStorage.setItem(KEY, JSON.stringify(["email", "major"]));
      table();
      expect(headerTexts()).toEqual(
        taHeaders.filter((h) => h !== "Email" && h !== "Major"),
      );
    });

    test("nothing is stored until a column is changed, and other keys are not read", () => {
      localStorage.setItem("other.key", JSON.stringify(["email"]));
      table();
      expect(headerTexts()).toEqual(taHeaders);
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    test("the tied warning spans exactly the visible columns", () => {
      vi.useFakeTimers();
      localStorage.setItem(
        KEY,
        JSON.stringify(["email", "major", "classLevel"]),
      );
      table();
      fireEvent.change(input("Grace Hopper"), { target: { value: "1" } });
      fireEvent.change(input(), { target: { value: "1" } });
      act(() => vi.advanceTimersByTime(2000));
      expect(
        screen.getByText(/You have ranked multiple candidates/).closest("td"),
      ).toHaveAttribute("colspan", "6");
      fireEvent.click(screen.getByTestId("CandidateTable-hide-yearInProgram"));
      expect(
        screen.getByText(/You have ranked multiple candidates/).closest("td"),
      ).toHaveAttribute("colspan", "5");
    });

    test("ULA columns can be hidden too", async () => {
      table({ type: "ULA" });
      await userEvent.click(
        screen.getByTestId("CandidateTable-hide-videoLink"),
      );
      expect(headerTexts()).toEqual(ulaHeaders.slice(0, -1));
    });
  });
});
