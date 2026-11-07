import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { describe, expect, test, vi, beforeEach } from "vitest";

import CombinedAllocationTable from "main/components/Allocations/CombinedAllocationTable";
import { combineCourses } from "main/utils/combinedAllocations";
import { combinedColumnChoices } from "main/utils/combinedColumns";
import fixtures from "fixtures/combinedAllocationsFixtures";
import { MemoryRouter } from "react-router";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

const base = {
  days: null,
  time: null,
  room: null,
  enrollment: null,
  maxEnroll: null,
  status: "open",
  summerSession: null,
  removed: false,
};

// CMPSC 156 is in both recruitments (the estimates disagree: 100 and 80), CMPSC 8 only in the TA
// one, CMPSC 24 only in the ULA one.
const taCourses = [
  {
    ...base,
    id: 1,
    recruitmentId: 5,
    courseId: "CMPSC   156",
    enrollCode: "07492",
    section: "0100",
    title: "Advanced Applications",
    instructor: "CONRAD P",
    allocation: 3,
    allocationVersion: 4,
    enrollmentEstimate: 100,
    unroundedAllocation: 2.5,
  },
  {
    ...base,
    id: 2,
    recruitmentId: 5,
    courseId: "CMPSC     8",
    enrollCode: "07000",
    section: "0100",
    title: "Intro",
    instructor: "GAUCHO C",
    allocation: 0,
    allocationVersion: 0,
    enrollmentEstimate: 60,
    unroundedAllocation: null,
  },
];
const ulaCourses = [
  {
    ...base,
    id: 11,
    recruitmentId: 6,
    courseId: "CMPSC   156",
    enrollCode: "07492",
    section: "0100",
    title: "Advanced Applications",
    instructor: "CONRAD P",
    allocation: 6,
    allocationVersion: 9,
    enrollmentEstimate: 80,
    unroundedAllocation: 7.25,
  },
  {
    ...base,
    id: 12,
    recruitmentId: 6,
    courseId: "CMPSC    24",
    enrollCode: "07300",
    section: "0100",
    title: "Data Structures",
    instructor: "WIZARD W",
    allocation: 2,
    allocationVersion: 1,
    enrollmentEstimate: null,
    unroundedAllocation: 0.4,
  },
];

function renderTable(props = {}, queryClient = new QueryClient()) {
  const hasTa = props.hasTa ?? true;
  const hasUla = props.hasUla ?? true;
  return render(
    <QueryClientProvider client={queryClient}>
      <CombinedAllocationTable
        courses={combineCourses(
          hasTa ? taCourses : [],
          hasUla ? ulaCourses : [],
        )}
        hasTa={hasTa}
        hasUla={hasUla}
        conversionFactor={3}
        taBulkVersion={7}
        ulaBulkVersion={8}
        {...props}
      />
    </QueryClientProvider>,
  );
}

const headerIds = () =>
  screen
    .getAllByTestId(/^CombinedAllocationTable-header-[A-Za-z]+$/)
    .map((e) =>
      e
        .getAttribute("data-testid")
        .replace("CombinedAllocationTable-header-", ""),
    );
const cell = (row, column) =>
  screen.getByTestId(`CombinedAllocationTable-cell-row-${row}-${column}`);
const td = (row, column) =>
  screen.getByTestId(`CombinedAllocationTable-cell-row-${row}-col-${column}`);
const puts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/recruitmentcourses/allocation",
  );

describe("CombinedAllocationTable tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {});
  });

  test("with both types: the TA columns, the ULA columns and the ASE:Student Ratio", () => {
    renderTable();

    expect(headerIds()).toEqual([
      "courseId",
      "section",
      "title",
      "instructor",
      "instructorEmail",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "taAllocation",
      "taUnroundedAllocation",
      "taDelta",
      "taRatio",
      "ulaAllocation",
      "ulaUnroundedAllocation",
      "ulaDelta",
      "ulaRatio",
      "aseRatio",
      "status",
    ]);
    expect(screen.getByText("TA Allocation")).toBeInTheDocument();
    expect(screen.getByText("TA Delta")).toBeInTheDocument();
    expect(screen.getByText("ULA Allocation")).toBeInTheDocument();
    expect(screen.getByText("ULA Delta")).toBeInTheDocument();
    expect(
      screen.getByTestId("CombinedAllocationTable-header-taRatio"),
    ).toHaveTextContent("TA:student ratio");
    expect(
      screen.getByTestId("CombinedAllocationTable-header-ulaRatio"),
    ).toHaveTextContent("ULA:student ratio");
    expect(
      screen.getByTestId(
        "CombinedAllocationTable-header-taUnroundedAllocation",
      ),
    ).toHaveTextContent("TA Unrounded Allocation");
    expect(
      screen.getByTestId(
        "CombinedAllocationTable-header-ulaUnroundedAllocation",
      ),
    ).toHaveTextContent("ULA Unrounded Allocation");
    expect(
      screen.getByTestId("CombinedAllocationTable-header-aseRatio"),
    ).toHaveTextContent("ASE:Student Ratio");
  });

  test("with TA only: no ULA columns and no ASE:Student Ratio", () => {
    renderTable({ hasUla: false });

    expect(headerIds()).toEqual([
      "courseId",
      "section",
      "title",
      "instructor",
      "instructorEmail",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "taAllocation",
      "taUnroundedAllocation",
      "taDelta",
      "taRatio",
      "status",
    ]);
  });

  test("with ULA only: no TA columns and no ASE:Student Ratio", () => {
    renderTable({ hasTa: false });

    expect(headerIds()).toEqual([
      "courseId",
      "section",
      "title",
      "instructor",
      "instructorEmail",
      "days",
      "time",
      "room",
      "enrollment",
      "maxEnroll",
      "enrollmentEstimate",
      "ulaAllocation",
      "ulaUnroundedAllocation",
      "ulaDelta",
      "ulaRatio",
      "status",
    ]);
  });

  test("shows the union of the courses, in course order", () => {
    renderTable();

    expect(screen.getAllByTestId(/^CombinedAllocationTable-row-/)).toHaveLength(
      3,
    );
    expect(td(0, "courseId")).toHaveTextContent("CMPSC 8");
    expect(td(1, "courseId")).toHaveTextContent("CMPSC 24");
    expect(td(2, "courseId")).toHaveTextContent("CMPSC 156");
  });

  test("a section in both recruitments is one row, with the higher estimate, both types' figures and the ASE ratio", () => {
    renderTable();

    // Row 2 is CMPSC 156: estimate max(100, 80) = 100.
    expect(td(2, "enrollmentEstimate")).toHaveTextContent("100");
    expect(cell(2, "TA-allocation")).toHaveValue(3);
    expect(cell(2, "ULA-allocation")).toHaveValue(6);
    expect(td(2, "taUnroundedAllocation")).toHaveTextContent("2.5");
    expect(td(2, "ulaUnroundedAllocation")).toHaveTextContent("7.3");
    expect(cell(2, "TA-delta")).toHaveTextContent("-0.5");
    expect(cell(2, "TA-delta")).toHaveClass("text-danger");
    expect(cell(2, "ULA-delta")).toHaveTextContent("+1.3");
    expect(cell(2, "ULA-delta")).toHaveClass("text-success");
    // Ratios use the one estimate shown: 100 / 3 and 100 / 6.
    expect(td(2, "taRatio")).toHaveTextContent("1:33");
    expect(td(2, "ulaRatio")).toHaveTextContent("1:17");
    // 3 + 6 / 3 = 5 TA-equivalents; 100 / 5 = 20.
    expect(td(2, "aseRatio")).toHaveTextContent("1:20");
  });

  test("the conversion factor is the one the ASE:Student Ratio is computed with", () => {
    renderTable({ conversionFactor: 2 });

    // 3 + 6 / 2 = 6; 100 / 6 = 16.7
    expect(td(2, "aseRatio")).toHaveTextContent("1:17");
  });

  test("the ASE:Student Ratio follows a change of the factor on the same rows", () => {
    const client = new QueryClient();
    const courses = combineCourses(taCourses, ulaCourses);
    const table = (conversionFactor) => (
      <QueryClientProvider client={client}>
        <CombinedAllocationTable
          courses={courses}
          hasTa
          hasUla
          conversionFactor={conversionFactor}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(table(3));
    expect(td(2, "aseRatio")).toHaveTextContent("1:20");

    rerender(table(2));

    expect(td(2, "aseRatio")).toHaveTextContent("1:17");
  });

  test("a section in one recruitment only: the other type's cells are blank", () => {
    renderTable();

    // Row 0 is CMPSC 8, TA only.
    expect(cell(0, "TA-allocation")).toHaveValue(0);
    expect(td(0, "taUnroundedAllocation")).toHaveTextContent("—");
    expect(cell(0, "TA-delta")).toHaveTextContent("0.0");
    expect(td(0, "taRatio")).toHaveTextContent("—");
    expect(
      screen.queryByTestId("CombinedAllocationTable-cell-row-0-ULA-allocation"),
    ).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationTable-cell-row-0-ULA-delta"),
    ).toBeNull();
    expect(td(0, "ulaUnroundedAllocation")).toBeEmptyDOMElement();
    expect(td(0, "ulaRatio")).toBeEmptyDOMElement();
    // The ASE ratio counts the missing type as nothing: no TAs, so a dash.
    expect(td(0, "aseRatio")).toHaveTextContent("—");

    // Row 1 is CMPSC 24, ULA only, with no estimate.
    expect(cell(1, "ULA-allocation")).toHaveValue(2);
    expect(
      screen.queryByTestId("CombinedAllocationTable-cell-row-1-TA-allocation"),
    ).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationTable-cell-row-1-TA-delta"),
    ).toBeNull();
    expect(td(1, "taUnroundedAllocation")).toBeEmptyDOMElement();
    expect(td(1, "taRatio")).toBeEmptyDOMElement();
    expect(td(1, "ulaRatio")).toHaveTextContent("—");
    expect(td(1, "aseRatio")).toHaveTextContent("—");
  });

  test("each box is labelled with its type and section", () => {
    renderTable();

    expect(
      screen.getByRole("spinbutton", {
        name: "TA allocation for CMPSC 156 section 0100",
      }),
    ).toBe(cell(2, "TA-allocation"));
    expect(
      screen.getByRole("spinbutton", {
        name: "ULA allocation for CMPSC 156 section 0100",
      }),
    ).toBe(cell(2, "ULA-allocation"));
  });

  test("a section without a section number still labels its box", () => {
    renderTable({
      courses: combineCourses([{ ...taCourses[0], section: null }], []),
      hasUla: false,
    });

    expect(
      screen.getByRole("spinbutton", {
        name: "TA allocation for CMPSC 156 section",
      }),
    ).toBeInTheDocument();
  });

  test("a removed row's box cannot be edited", () => {
    renderTable({
      courses: combineCourses([{ ...taCourses[0], removed: true }], []),
      hasUla: false,
    });

    expect(cell(0, "TA-allocation")).toBeDisabled();
  });

  test("a TA allocation is saved against the TA row, with its versions", async () => {
    renderTable();

    fireEvent.change(cell(2, "TA-allocation"), { target: { value: "5" } });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({
      id: 1,
      allocation: 5,
      expectedVersion: 4,
      expectedBulkVersion: 7,
    });
  });

  test("a ULA allocation is saved against the ULA row, with the ULA recruitment's bulk version", async () => {
    renderTable();

    fireEvent.change(cell(2, "ULA-allocation"), { target: { value: "4" } });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].params).toEqual({
      id: 11,
      allocation: 4,
      expectedVersion: 9,
      expectedBulkVersion: 8,
    });
  });

  test("a value that is not a whole number is flagged and not sent", async () => {
    renderTable();

    fireEvent.change(cell(2, "TA-allocation"), { target: { value: "-1" } });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(cell(2, "TA-allocation")).toHaveClass("is-invalid");
    expect(puts()).toHaveLength(0);
  });

  test("a valid draft is not flagged and a box is not flagged until it is edited", () => {
    renderTable();

    expect(cell(2, "TA-allocation")).not.toHaveClass("is-invalid");
    fireEvent.change(cell(2, "TA-allocation"), { target: { value: "4" } });
    expect(cell(2, "TA-allocation")).toHaveValue(4);
    expect(cell(2, "TA-allocation")).not.toHaveClass("is-invalid");
  });

  test("leaving a box shows the stored value again", async () => {
    renderTable();
    const box = cell(2, "TA-allocation");

    fireEvent.change(box, { target: { value: "-1" } });
    expect(box).toHaveValue(-1);
    fireEvent.blur(box);

    expect(box).toHaveValue(3);
  });

  test("a refused edit says why, in a toast", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(409, { message: "Changed elsewhere." });
    renderTable();

    await userEvent.clear(cell(2, "ULA-allocation"));
    await userEvent.type(cell(2, "ULA-allocation"), "1");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Changed elsewhere."),
    );
  });

  test("the headings are the issue's, and the stacked ones are two lines in a smaller font", () => {
    renderTable();

    const heading = (id) =>
      screen.getByTestId(`CombinedAllocationTable-header-${id}`);
    expect(heading("courseId")).toHaveTextContent("Course Number");
    expect(heading("section")).toHaveTextContent("Section");
    expect(heading("title")).toHaveTextContent("Title");
    expect(heading("instructor")).toHaveTextContent("Instructor");
    expect(heading("enrollmentEstimate")).toHaveTextContent(
      "Enrollment Estimate",
    );
    expect(heading("taAllocation")).toHaveTextContent("TA Allocation");
    expect(heading("taDelta")).toHaveTextContent("TA Delta");
    expect(heading("ulaAllocation")).toHaveTextContent("ULA Allocation");
    expect(heading("ulaDelta")).toHaveTextContent("ULA Delta");
    expect(heading("aseRatio").querySelector("span").style.fontSize).toBe(
      "80%",
    );
    expect(heading("aseRatio").querySelector("br")).not.toBeNull();
  });

  test("the cells are laid out like the Recruitment Courses table's", () => {
    renderTable();

    expect(td(2, "courseId").style.width).toBe("1%");
    expect(td(2, "courseId").querySelector("span").style.fontFamily).toBe(
      "monospace",
    );
    expect(td(2, "courseId").querySelector("span").style.whiteSpace).toBe(
      "pre",
    );
    expect(td(2, "title").style.width).toBe("100%");
    expect(td(2, "enrollmentEstimate").style.textAlign).toBe("right");
    expect(td(2, "taUnroundedAllocation").style.textAlign).toBe("right");
    expect(td(2, "taRatio").style.whiteSpace).toBe("nowrap");
    expect(td(2, "taRatio").style.textAlign).toBe("");
    expect(cell(2, "TA-allocation").style.width).toBe("5em");
  });

  test.each([
    ["TA", "ta"],
    ["ULA", "ula"],
  ])(
    "the %s Unrounded Allocation heading explains itself on hover",
    async (type, key) => {
      renderTable();
      const heading = screen.getByTestId(
        `CombinedAllocationTable-${key}-unrounded-heading`,
      );
      expect(heading.style.textDecoration).toBe("underline dotted");

      await userEvent.hover(heading);

      const tip = await screen.findByRole("tooltip");
      expect(tip).toHaveTextContent(
        `unroundedAllocation is how many ${type}s the course would receive`,
      );
      expect(tip).toHaveAttribute(
        "id",
        `CombinedAllocationTable-${key}-unrounded-tooltip`,
      );
    },
  );

  const courseOrder = () =>
    screen
      .getAllByTestId(/^CombinedAllocationTable-cell-row-\d+-col-courseId$/)
      .map((e) => e.textContent.replace(/\s+/g, " "));
  const sortBy = async (id) =>
    userEvent.click(
      screen.getByTestId(`CombinedAllocationTable-header-${id}-sort-header`),
    );

  // A numeric column sorts descending first. A section the type does not have has nothing to sort
  // by and goes last. CMPSC 8 is only in the TA recruitment (allocation 0, no unrounded share),
  // CMPSC 24 only in the ULA one (allocation 2, share 0.4), CMPSC 156 in both.
  test.each([
    ["taAllocation", ["CMPSC 156", "CMPSC 8", "CMPSC 24"]],
    ["taUnroundedAllocation", ["CMPSC 156", "CMPSC 8", "CMPSC 24"]],
    ["taDelta", ["CMPSC 8", "CMPSC 156", "CMPSC 24"]],
    ["ulaAllocation", ["CMPSC 156", "CMPSC 24", "CMPSC 8"]],
    ["ulaUnroundedAllocation", ["CMPSC 156", "CMPSC 24", "CMPSC 8"]],
    ["ulaDelta", ["CMPSC 156", "CMPSC 24", "CMPSC 8"]],
  ])("sorts by %s", async (id, expected) => {
    renderTable();
    expect(courseOrder()).toEqual(["CMPSC 8", "CMPSC 24", "CMPSC 156"]);

    await sortBy(id);

    expect(courseOrder()).toEqual(expected);
  });
});

describe("CombinedAllocationTable: the columns of the allocations pages (issue #358)", () => {
  const fx = fixtures;
  function renderFull(props = {}) {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CombinedAllocationTable
            courses={combineCourses(fx.taCourses, fx.ulaCourses)}
            hasTa
            hasUla
            conversionFactor={3}
            taRankingSummaries={fx.taRankingSummaries}
            ulaRankingSummaries={fx.ulaRankingSummaries}
            {...props}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  test("the rankings columns come first, each only when its type has them", () => {
    renderFull({ showTaRankings: true, showUlaRankings: true });
    expect(headerIds().slice(0, 3)).toEqual([
      "taRankingCount",
      "ulaRankingCount",
      "courseId",
    ]);
    expect(
      screen.getByTestId("CombinedAllocationTable-header-taRankingCount"),
    ).toHaveTextContent("TA Rankings");
    expect(
      screen.getByTestId("CombinedAllocationTable-header-ulaRankingCount"),
    ).toHaveTextContent("ULA Rankings");
  });

  test("no rankings column without the rankings opened or without the recruitment", () => {
    const { unmount } = renderFull({ showTaRankings: false });
    expect(headerIds()).not.toContain("taRankingCount");
    expect(headerIds()).not.toContain("ulaRankingCount");
    unmount();

    renderFull({
      hasTa: false,
      courses: combineCourses([], fx.ulaCourses),
      showTaRankings: true,
      showUlaRankings: true,
    });
    expect(headerIds()).not.toContain("taRankingCount");
    expect(headerIds()).toContain("ulaRankingCount");
  });

  test("a rankings cell links to the course's ranking page; a section of the other type has none", () => {
    renderFull({ showTaRankings: true, showUlaRankings: true });

    // Row 2 is CMPSC 156 (TA course 1, ULA course 11).
    const taLink = screen.getByTestId(
      "CombinedAllocationTable-ta-cell-row-2-ranking-link",
    );
    expect(taLink).toHaveTextContent("4");
    expect(taLink).toHaveAttribute("href", "/recruitments/5/courses/1/ranking");
    const ulaLink = screen.getByTestId(
      "CombinedAllocationTable-ula-cell-row-2-ranking-link",
    );
    expect(ulaLink).toHaveTextContent("9");
    expect(ulaLink).toHaveAttribute(
      "href",
      "/recruitments/6/courses/11/ranking",
    );
    // Row 0 is CMPSC 8, TA only, and the ULA cell is empty.
    expect(
      screen.getByTestId("CombinedAllocationTable-ta-cell-row-0-ranking-link"),
    ).toHaveTextContent("6");
    expect(td(0, "ulaRankingCount")).toBeEmptyDOMElement();
  });

  test("a course without a count shows a dash", () => {
    // Neither list of summaries is given: nothing is known about any course.
    renderFull({
      showTaRankings: true,
      taRankingSummaries: undefined,
      ulaRankingSummaries: undefined,
    });
    expect(
      within(td(0, "taRankingCount")).getByLabelText(
        "Ranking count unavailable",
      ),
    ).toHaveTextContent("—");
  });

  test("the headings of the descriptive columns", () => {
    renderFull();

    const heading = (id) =>
      screen.getByTestId(`CombinedAllocationTable-header-${id}`);
    expect(heading("section")).toHaveTextContent("Section");
    expect(heading("title")).toHaveTextContent("Title");
    expect(heading("instructor")).toHaveTextContent("Instructor");
    expect(heading("instructorEmail")).toHaveTextContent("Email");
    expect(heading("days")).toHaveTextContent("Days");
    expect(heading("time")).toHaveTextContent("Time");
    expect(heading("room")).toHaveTextContent("Room");
    expect(heading("enrollment")).toHaveTextContent("Enrolled");
    expect(heading("maxEnroll")).toHaveTextContent("Max");
    expect(heading("status")).toHaveTextContent("Status");
  });

  // CMPSC 8 is only in the TA recruitment (6 rankings), CMPSC 24 only in the ULA one (7), CMPSC 156
  // in both (4 and 9). A numeric column sorts descending first.
  test.each([
    [
      "taRankingCount",
      ["CMPSC 8", "CMPSC 156", "CMPSC 24"],
      ["CMPSC 156", "CMPSC 8", "CMPSC 24"],
    ],
    [
      "ulaRankingCount",
      ["CMPSC 156", "CMPSC 24", "CMPSC 8"],
      ["CMPSC 24", "CMPSC 156", "CMPSC 8"],
    ],
  ])(
    "sorting by %s orders by the count, and a section of the other type goes last either way",
    async (id, descending, ascending) => {
      renderFull({ showTaRankings: true, showUlaRankings: true });
      const order = () =>
        screen
          .getAllByTestId(/^CombinedAllocationTable-cell-row-\d+-col-courseId$/)
          .map((e) => e.textContent.replace(/\s+/g, " "));
      const sortHeader = screen.getByTestId(
        `CombinedAllocationTable-header-${id}-sort-header`,
      );

      await userEvent.click(sortHeader);
      expect(order()).toEqual(descending);

      await userEvent.click(sortHeader);
      expect(order()).toEqual(ascending);
    },
  );

  test("the descriptive columns come from the TA row, and from the ULA row for a ULA-only section", () => {
    renderFull();

    // CMPSC 156 is in both; the ULA row has no days, room or counts, the TA row does.
    expect(td(2, "days")).toHaveTextContent("M W");
    expect(td(2, "time")).toHaveTextContent("9:30 AM - 10:45 AM");
    expect(td(2, "room")).toHaveTextContent("PHELP 1448");
    expect(td(2, "enrollment")).toHaveTextContent("90");
    expect(td(2, "maxEnroll")).toHaveTextContent("120");
    expect(td(2, "status")).toHaveTextContent("open");
    // CMPSC 24 is in the ULA recruitment only.
    expect(td(1, "days")).toHaveTextContent("T R");
    expect(td(1, "room")).toHaveTextContent("HFH 1104");
    expect(td(1, "enrollment")).toHaveTextContent("40");
    expect(td(1, "maxEnroll")).toHaveTextContent("50");
  });

  test("a cancelled section has the red badge, as on the allocations page", () => {
    renderFull();

    expect(
      screen.getByTestId("CombinedAllocationTable-cell-row-1-cancelled"),
    ).toHaveTextContent("Cancelled");
  });

  test("the email is the TA row's, else the ULA row's, with the copy widget; unmapped links to the instructors page", async () => {
    const onCopyEmail = vi.fn();
    renderFull({ onCopyEmail });

    expect(td(2, "instructorEmail")).toHaveTextContent("pconrad@ucsb.edu");
    expect(td(1, "instructorEmail")).toHaveTextContent("wizard@ucsb.edu");
    await userEvent.click(
      screen.getByTestId("CombinedAllocationTable-cell-row-1-copy-email"),
    );
    expect(onCopyEmail).toHaveBeenCalledWith("wizard@ucsb.edu");
    expect(
      screen.getByRole("button", { name: "Copy pconrad@ucsb.edu" }),
    ).toBeInTheDocument();
    // CMPSC 8 has no email.
    expect(
      screen.getByTestId("CombinedAllocationTable-cell-row-0-unmapped"),
    ).toHaveAttribute("href", "/admin/instructors");
  });

  test("hiddenColumns leaves the columns out, and Course Number is never one of them", () => {
    renderFull({ hiddenColumns: ["section", "title", "taDelta", "status"] });

    const ids = headerIds();
    ["section", "title", "taDelta", "status"].forEach((id) =>
      expect(ids).not.toContain(id),
    );
    expect(ids).toContain("courseId");
    expect(ids).toContain("instructor");
  });

  test("the Course Number heading is stacked and its cell is 13 characters wide", () => {
    renderFull();

    const heading = screen.getByTestId(
      "CombinedAllocationTable-header-courseId",
    );
    expect(heading.querySelector("br")).not.toBeNull();
    expect(heading).toHaveTextContent("Course Number");
    expect(heading.querySelector("span").getAttribute("style")).toContain(
      "font-size: 80%",
    );
    const cellText = td(2, "courseId").querySelector("span");
    const style = cellText.getAttribute("style");
    expect(style).toContain("min-width: 13ch");
    expect(style).toContain("font-family: monospace");
    expect(style).toContain("display: inline-block");
  });

  test("with the hide links, every heading but Course Number has one that hides it", async () => {
    const onHide = vi.fn();
    renderFull({
      showTaRankings: true,
      showUlaRankings: true,
      hideLinks: {
        choices: combinedColumnChoices(
          { exists: true, showRankings: true },
          { exists: true, showRankings: true },
        ),
        onHide,
      },
    });

    const ids = headerIds();
    ids
      .filter((id) => id !== "courseId")
      .forEach((id) =>
        expect(
          screen.getByTestId(`CombinedAllocationTable-header-${id}-hide`),
        ).toBeInTheDocument(),
      );
    expect(
      screen.queryByTestId("CombinedAllocationTable-header-courseId-hide"),
    ).toBeNull();
    await userEvent.click(
      screen.getByTestId("CombinedAllocationTable-header-section-hide"),
    );
    expect(onHide).toHaveBeenCalledWith("section");
  });
});
