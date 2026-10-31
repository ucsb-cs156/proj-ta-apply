import { act, fireEvent, render, screen, within } from "@testing-library/react";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import CandidateTable from "main/components/Instructor/CandidateTable";
import candidatesFixtures from "fixtures/candidatesFixtures";

const mock = new AxiosMockAdapter(axios);
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
      {...props}
    />,
  );
}
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
    mock.reset();
    mock.resetHistory();
    mock.onPut().reply(200, { rank: 1 });
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
      expect(
        screen.getAllByRole("columnheader").map((header) => header.textContent),
      ).toEqual(expected);
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
    expect(names()).toEqual(["Ada", "Grace", "Alan", "Katherine"]);
    fireEvent.click(screen.getByRole("button", { name: "Course Preference" }));
    expect(names()).toEqual(["Katherine", "Alan", "Grace", "Ada"]);
    expect(
      screen.getByRole("columnheader", { name: "Course Preference" }),
    ).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(screen.getByRole("button", { name: "Course Preference" }));
    expect(names()).toEqual(["Ada", "Grace", "Alan", "Katherine"]);
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
    expect(screen.getByRole("columnheader", { name: label })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
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

  test("serializes same-candidate writes, ignores stale response, and saves different candidates independently", async () => {
    const resolvers = [];
    mock.resetHandlers();
    mock
      .onPut(`${apiUrl}/1/rank`)
      .reply(() => new Promise((resolve) => resolvers.push(resolve)));
    mock.onPut(`${apiUrl}/2/rank`).reply(200, { rank: 4 });
    table();
    fireEvent.change(input(), { target: { value: "2" } });
    fireEvent.change(input(), { target: { value: "3" } });
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.change(input("Grace Hopper"), { target: { value: "4" } });
    expect(mock.history.put.map((request) => request.url)).toEqual([
      `${apiUrl}/1/rank`,
      `${apiUrl}/2/rank`,
    ]);
    expect(input()).toHaveValue(null);
    await act(async () => resolvers[0]([200, { rank: 2 }]));
    expect(mock.history.put).toHaveLength(3);
    expect(JSON.parse(mock.history.put[2].data)).toEqual({ rank: 3 });
    expect(input()).toHaveValue(null);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Saving...");
    await act(async () => resolvers[1]([500, { message: "stale failure" }]));
    expect(screen.queryByText(/stale failure/)).not.toBeInTheDocument();
    expect(mock.history.put).toHaveLength(4);
    expect(JSON.parse(mock.history.put[3].data)).toEqual({ rank: null });
    await act(async () => resolvers[2]([200, { rank: null }]));
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
      screen.queryByText(/You have tied rankings/),
    ).not.toBeInTheDocument();
    expect(cells[0]).not.toHaveStyle({ backgroundColor: "#ffff00" });
    act(() => vi.advanceTimersByTime(1999));
    expect(
      screen.queryByText(/You have tied rankings/),
    ).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/You have tied rankings/).textContent).toBe(
      "You have tied rankings. This is permitted, but please be absolutely sure that you really do have zero preference between the candidates you have given the same ranking. Rankings without ties make it easier to finalize assignments.",
    );
    expect(screen.getByText("absolutely").tagName).toBe("EM");
    cells.forEach((cell) =>
      expect(cell).toHaveStyle({ backgroundColor: "#ffff00" }),
    );
    fireEvent.change(input("Grace Hopper"), { target: { value: "" } });
    expect(
      screen.queryByText(/You have tied rankings/),
    ).not.toBeInTheDocument();
    cells.forEach((cell) =>
      expect(cell).not.toHaveStyle({ backgroundColor: "#ffff00" }),
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
      screen.queryByText(/You have tied rankings/),
    ).not.toBeInTheDocument();
    fireEvent.change(input("Grace Hopper"), { target: { value: "1" } });
    act(() => vi.advanceTimersByTime(1500));
    fireEvent.change(input("Alan Turing"), { target: { value: "1" } });
    act(() => vi.advanceTimersByTime(1999));
    expect(
      screen.queryByText(/You have tied rankings/),
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
});
