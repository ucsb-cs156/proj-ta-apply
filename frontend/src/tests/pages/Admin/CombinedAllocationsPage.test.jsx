import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { beforeEach, describe, expect, test, vi } from "vitest";

import CombinedAllocationsPage from "main/pages/Admin/CombinedAllocationsPage";
import budgetFixtures from "fixtures/budgetFixtures";
import combinedAllocationsFixtures from "fixtures/combinedAllocationsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { CONVERSION_FACTOR_EXPLANATION } from "main/utils/combinedAllocations";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderPage(qyy = "F26") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[`/admin/allocations/${qyy}`]}>
        <Routes>
          <Route
            path="/admin/allocations/:qyy"
            element={<CombinedAllocationsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const BUDGET = "/api/admin/budget";
const COURSES = "/api/recruitmentcourses/all";
const gets = (url) => axiosMock.history.get.filter((r) => r.url === url);
const budgetPuts = () => axiosMock.history.put.filter((r) => r.url === BUDGET);
const allocationPuts = () =>
  axiosMock.history.put.filter(
    (r) => r.url === "/api/recruitmentcourses/allocation",
  );
const factorBox = () =>
  screen.findByTestId("CombinedAllocationsPage-conversionTAtoULA");
const td = (row, column) =>
  screen.getByTestId(`CombinedAllocationTable-cell-row-${row}-col-${column}`);

describe("CombinedAllocationsPage tests", () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20264" } })
      .reply(200, budgetFixtures.bothTypes);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20262" } })
      .reply(200, budgetFixtures.ulaOnly);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20261" } })
      .reply(200, budgetFixtures.taOnlyOverBudget);
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20111" } })
      .reply(404, { message: "No recruitment for quarter 20111" });
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 5, includeRemoved: false } })
      .reply(200, combinedAllocationsFixtures.taCourses);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 6, includeRemoved: false } })
      .reply(200, combinedAllocationsFixtures.ulaCourses);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 3, includeRemoved: false } })
      .reply(200, [combinedAllocationsFixtures.ulaCourses[1]]);
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 1, includeRemoved: false } })
      .reply(200, [combinedAllocationsFixtures.taCourses[1]]);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, combinedAllocationsFixtures.recruitments);
    const summaries = (id) =>
      `/api/instructor/recruitments/${id}/admin-course-rankings`;
    axiosMock
      .onGet(summaries(5))
      .reply(200, combinedAllocationsFixtures.taRankingSummaries);
    axiosMock
      .onGet(summaries(6))
      .reply(200, combinedAllocationsFixtures.ulaRankingSummaries);
    axiosMock.onGet(summaries(3)).reply(200, []);
    axiosMock.onGet(summaries(1)).reply(200, []);
    axiosMock
      .onPut("/api/recruitmentcourses/enrollmentEstimates")
      .reply(200, []);
    axiosMock.onPost("/api/recruitmentcourses/autoAllocate").reply(200, []);
    axiosMock.onPut(BUDGET).reply(200, budgetFixtures.bothTypes);
    axiosMock.onPut("/api/recruitmentcourses/allocation").reply(200, {});
  });

  test("something that is not a quarter is explained, and nothing is fetched", async () => {
    renderPage("F2");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Combined Allocations",
      }),
    ).toBeInTheDocument();
    const message = screen.getByTestId("CombinedAllocationsPage-bad-quarter");
    expect(message).toHaveTextContent(
      "“F2” is not a quarter. Quarters are written as a letter and two digits, such as F26. Choose a quarter.",
    );
    expect(
      within(message).getByRole("link", { name: "Choose a quarter" }),
    ).toHaveAttribute("href", "/admin/budget/selectQuarter");
    await waitFor(() => expect(gets("/api/currentUser")).toHaveLength(1));
    expect(gets(BUDGET)).toHaveLength(0);
    expect(gets(COURSES)).toHaveLength(0);
  });

  test("shows Loading until the summary arrives, with the heading and the link to the budget", async () => {
    renderPage("F26");

    expect(
      screen.getByRole("heading", { level: 1, name: "Allocations for F26" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Budget for F26" }),
    ).toHaveAttribute("href", "/admin/budget/F26");
    expect(
      screen.getByTestId("CombinedAllocationsPage-loading"),
    ).toHaveTextContent("Loading…");
    await screen.findByTestId("CombinedAllocationTable");
    expect(
      screen.queryByTestId("CombinedAllocationsPage-loading"),
    ).not.toBeInTheDocument();
  });

  test("a quarter with no recruitment says so", async () => {
    renderPage("W11");

    expect(
      await screen.findByText("No recruitment for W11."),
    ).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      "Error communicating with backend via GET on /api/admin/budget",
    );
    expect(screen.queryByTestId("CombinedAllocationTable")).toBeNull();
    expect(gets(COURSES)).toHaveLength(0);
  });

  test("with both recruitments: the costs, the factor and the union of the courses", async () => {
    renderPage("F26");

    await screen.findByTestId("CombinedAllocationTable");
    const costs = screen.getByTestId("CombinedAllocationsPage-costs");
    expect(within(costs).queryAllByRole("columnheader")).toHaveLength(0);
    expect(costs.querySelector("thead")).toBeNull();
    expect(within(costs).getAllByRole("row")).toHaveLength(3);
    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ta"),
    ).toHaveTextContent("Cost per TA$12,000.00");
    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ula"),
    ).toHaveTextContent("Cost per ULA$2,500.50");
    // 12000 / 2500.5
    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ratio"),
    ).toHaveTextContent("TA Cost/ULA Cost4.80");

    expect(await factorBox()).toHaveValue("3");
    expect(screen.getByLabelText("Nominal TA to ULA conversion factor")).toBe(
      await factorBox(),
    );
    expect(screen.getAllByTestId(/^CombinedAllocationTable-row-/)).toHaveLength(
      3,
    );
    expect(
      screen.getByTestId("CombinedAllocationTable-header-aseRatio"),
    ).toBeInTheDocument();
    expect(td(2, "aseRatio")).toHaveTextContent("1:20");
    expect(td(2, "enrollmentEstimate")).toHaveTextContent("100");
    expect(gets(COURSES).map((r) => r.params)).toEqual(
      expect.arrayContaining([
        { recruitmentId: 5, includeRemoved: false },
        { recruitmentId: 6, includeRemoved: false },
      ]),
    );
  });

  test("the factor has the explanation as its tooltip", async () => {
    renderPage("F26");

    const box = await factorBox();

    expect(box.closest("[title]")).toHaveAttribute(
      "title",
      CONVERSION_FACTOR_EXPLANATION,
    );
  });

  test("a cost not yet entered is blank, and so is the ratio when the cost per ULA is zero or missing", async () => {
    axiosMock.onGet(BUDGET, { params: { quarter: "20264" } }).reply(200, {
      ...budgetFixtures.bothTypes,
      ta: { ...budgetFixtures.bothTypes.ta, avgCostPerPosition: null },
      ula: { ...budgetFixtures.bothTypes.ula, avgCostPerPosition: 0 },
    });
    renderPage("F26");

    await screen.findByTestId("CombinedAllocationTable");

    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ta"),
    ).toHaveTextContent(/^Cost per TA$/);
    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ula"),
    ).toHaveTextContent("Cost per ULA$0.00");
    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ratio"),
    ).toHaveTextContent(/^TA Cost\/ULA Cost$/);
  });

  test("a ULA cost not yet entered leaves the ratio and the cost blank", async () => {
    axiosMock.onGet(BUDGET, { params: { quarter: "20264" } }).reply(200, {
      ...budgetFixtures.bothTypes,
      ula: { ...budgetFixtures.bothTypes.ula, avgCostPerPosition: null },
    });
    renderPage("F26");

    await screen.findByTestId("CombinedAllocationTable");

    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ula"),
    ).toHaveTextContent(/^Cost per ULA$/);
    expect(
      screen.getByTestId("CombinedAllocationsPage-costs-ratio"),
    ).toHaveTextContent(/^TA Cost\/ULA Cost$/);
  });

  test("the factor in the summary is the one the ratios use", async () => {
    axiosMock.onGet(BUDGET, { params: { quarter: "20264" } }).reply(200, {
      ...budgetFixtures.bothTypes,
      budget: { ...budgetFixtures.bothTypes.budget, conversionTAtoULA: 2 },
    });
    renderPage("F26");

    expect(await factorBox()).toHaveValue("2");
    // 3 + 6 / 2 = 6; 100 / 6
    await waitFor(() => expect(td(2, "aseRatio")).toHaveTextContent("1:17"));
  });

  test("with a ULA recruitment only: no costs, no factor, only ULA columns", async () => {
    renderPage("S26");

    await screen.findByTestId("CombinedAllocationTable");

    expect(screen.queryByTestId("CombinedAllocationsPage-costs")).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationsPage-conversionTAtoULA"),
    ).toBeNull();
    expect(screen.queryByText("Cost per TA")).toBeNull();
    expect(screen.getByText("ULA Allocation")).toBeInTheDocument();
    expect(screen.queryByText("TA Allocation")).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationTable-header-aseRatio"),
    ).toBeNull();
    expect(gets(COURSES).map((r) => r.params)).toEqual([
      { recruitmentId: 3, includeRemoved: false },
    ]);
    // Only the ULA recruitment's one course: nothing is made of the TA list that is not read.
    await screen.findByText("CMPSC 24");
    expect(screen.getAllByTestId(/^CombinedAllocationTable-row-/)).toHaveLength(
      1,
    );
  });

  test("with a TA recruitment only: no costs, no factor, only TA columns", async () => {
    renderPage("W26");

    await screen.findByTestId("CombinedAllocationTable");

    expect(screen.queryByTestId("CombinedAllocationsPage-costs")).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationsPage-conversionTAtoULA"),
    ).toBeNull();
    expect(screen.getByText("TA Allocation")).toBeInTheDocument();
    expect(screen.queryByText("ULA Allocation")).toBeNull();
    expect(
      screen.queryByTestId("CombinedAllocationTable-header-aseRatio"),
    ).toBeNull();
    expect(gets(COURSES).map((r) => r.params)).toEqual([
      { recruitmentId: 1, includeRemoved: false },
    ]);
    await screen.findByText("CMPSC 8");
    expect(screen.getAllByTestId(/^CombinedAllocationTable-row-/)).toHaveLength(
      1,
    );
  });

  test("a valid factor is saved as it is typed, with the budget's version", async () => {
    renderPage("F26");
    const box = await factorBox();

    await userEvent.clear(box);
    await userEvent.type(box, "2");

    await waitFor(() => expect(budgetPuts()).toHaveLength(1));
    expect(budgetPuts()[0].params).toEqual({
      quarter: "20264",
      conversionTAtoULA: "2",
      version: 3,
    });
    expect(box).not.toHaveClass("is-invalid");
  });

  test("the ratios follow the saved factor", async () => {
    const saved = {
      ...budgetFixtures.bothTypes,
      budget: {
        ...budgetFixtures.bothTypes.budget,
        conversionTAtoULA: 2,
        version: 4,
      },
    };
    // What the page reads back after the save is what was saved.
    let stored = budgetFixtures.bothTypes;
    axiosMock
      .onGet(BUDGET, { params: { quarter: "20264" } })
      .reply(() => [200, stored]);
    axiosMock.onPut(BUDGET).reply(() => {
      stored = saved;
      return [200, saved];
    });
    renderPage("F26");
    const box = await factorBox();
    await waitFor(() => expect(td(2, "aseRatio")).toHaveTextContent("1:20"));

    await userEvent.clear(box);
    await userEvent.type(box, "2");

    await waitFor(() => expect(td(2, "aseRatio")).toHaveTextContent("1:17"));
  });

  test.each(["0", "0.0", "-1", "x", ""])(
    "%j is refused with the backend's message, and nothing is saved",
    async (bad) => {
      renderPage("F26");
      const box = await factorBox();

      await userEvent.clear(box);
      if (bad !== "") {
        await userEvent.type(box, bad);
      }

      expect(box).toHaveClass("is-invalid");
      expect(
        screen.getByTestId("CombinedAllocationsPage-conversionTAtoULA-invalid"),
      ).toHaveTextContent("conversionTAtoULA must be greater than zero");
      expect(budgetPuts()).toHaveLength(0);
    },
  );

  test("leaving the box shows the stored factor again", async () => {
    renderPage("F26");
    const box = await factorBox();

    await userEvent.clear(box);
    await userEvent.type(box, "0");
    fireEvent.blur(box);

    expect(box).toHaveValue("3");
    expect(budgetPuts()).toHaveLength(0);
  });

  describe("a factor saved over another admin's change", () => {
    const theirs = {
      ...budgetFixtures.bothTypes,
      budget: {
        ...budgetFixtures.bothTypes.budget,
        conversionTAtoULA: 5,
        version: 4,
      },
    };
    const refuseFirstSave = () => {
      let saves = 0;
      let stored = budgetFixtures.bothTypes;
      axiosMock
        .onGet(BUDGET, { params: { quarter: "20264" } })
        .reply(() => [200, stored]);
      axiosMock.onPut(BUDGET).reply(() => {
        saves += 1;
        stored = theirs;
        return saves === 1
          ? [409, { message: "stale", version: 4, summary: theirs }]
          : [200, theirs];
      });
    };

    test("is refused: the page shows what is stored and offers both choices", async () => {
      refuseFirstSave();
      renderPage("F26");
      const box = await factorBox();

      await userEvent.clear(box);
      await userEvent.type(box, "2");

      expect(
        await screen.findByTestId(
          "CombinedAllocationsPage-conflict-conversionTAtoULA-message",
        ),
      ).toHaveTextContent(
        "The TA to ULA conversion factor was changed in another tab or window. It is now 5; you entered 2.",
      );
      expect(
        screen.getByTestId(
          "CombinedAllocationsPage-conflict-conversionTAtoULA",
        ),
      ).toHaveClass("alert-warning");
      // 3 + 6 / 5 = 4.2; 100 / 4.2 = 23.8
      await waitFor(() => expect(td(2, "aseRatio")).toHaveTextContent("1:24"));
    });

    test("Use theirs drops what was typed", async () => {
      refuseFirstSave();
      renderPage("F26");
      const box = await factorBox();
      await userEvent.clear(box);
      await userEvent.type(box, "2");
      await screen.findByTestId(
        "CombinedAllocationsPage-conflict-conversionTAtoULA",
      );

      await userEvent.click(
        screen.getByTestId(
          "CombinedAllocationsPage-conflict-conversionTAtoULA-theirs",
        ),
      );

      expect(
        screen.queryByTestId(
          "CombinedAllocationsPage-conflict-conversionTAtoULA",
        ),
      ).toBeNull();
      expect(budgetPuts()).toHaveLength(1);
    });

    test("Overwrite saves it again over theirs, with their version", async () => {
      refuseFirstSave();
      renderPage("F26");
      const box = await factorBox();
      await userEvent.clear(box);
      await userEvent.type(box, "2");
      await screen.findByTestId(
        "CombinedAllocationsPage-conflict-conversionTAtoULA",
      );

      await userEvent.click(
        screen.getByTestId(
          "CombinedAllocationsPage-conflict-conversionTAtoULA-overwrite",
        ),
      );

      await waitFor(() => expect(budgetPuts()).toHaveLength(2));
      expect(budgetPuts()[1].params).toEqual({
        quarter: "20264",
        conversionTAtoULA: "2",
        version: 4,
      });
      expect(
        screen.queryByTestId(
          "CombinedAllocationsPage-conflict-conversionTAtoULA",
        ),
      ).toBeNull();
    });
  });

  test("editing a TA and a ULA allocation goes to that recruitment's rows, with the Auto Allocate counts", async () => {
    renderPage("F26");
    await screen.findByTestId("CombinedAllocationTable");
    const ta = await screen.findByTestId(
      "CombinedAllocationTable-cell-row-2-TA-allocation",
    );
    await waitFor(() =>
      expect(td(2, "taAllocation").querySelector("input")).toHaveValue(3),
    );

    fireEvent.change(ta, { target: { value: "5" } });
    await waitFor(() => expect(allocationPuts()).toHaveLength(1));
    fireEvent.change(
      screen.getByTestId("CombinedAllocationTable-cell-row-2-ULA-allocation"),
      { target: { value: "4" } },
    );
    await waitFor(() => expect(allocationPuts()).toHaveLength(2));

    expect(allocationPuts()[0].params).toEqual({
      id: 1,
      allocation: 5,
      expectedVersion: 4,
      expectedBulkVersion: 7,
    });
    expect(allocationPuts()[1].params).toEqual({
      id: 11,
      allocation: 4,
      expectedVersion: 9,
      expectedBulkVersion: 8,
    });
  });

  test("a saved allocation reads the courses again", async () => {
    renderPage("F26");
    const box = await screen.findByTestId(
      "CombinedAllocationTable-cell-row-2-TA-allocation",
    );
    await waitFor(() => expect(gets(COURSES)).toHaveLength(2));

    fireEvent.change(box, { target: { value: "5" } });

    await waitFor(() => expect(gets(COURSES)).toHaveLength(4));
  });

  test("a refused allocation edit reads the recruitments again, for the Auto Allocate counts", async () => {
    axiosMock
      .onPut("/api/recruitmentcourses/allocation")
      .reply(409, { message: "Changed elsewhere." });
    renderPage("F26");
    const box = await screen.findByTestId(
      "CombinedAllocationTable-cell-row-2-TA-allocation",
    );
    await waitFor(() =>
      expect(gets("/api/admin/recruitments/all")).toHaveLength(1),
    );

    fireEvent.change(box, { target: { value: "5" } });

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Changed elsewhere."),
    );
    await waitFor(() =>
      expect(gets("/api/admin/recruitments/all")).toHaveLength(2),
    );
  });

  test("a course list that cannot be read is toasted, and the other type's courses are still shown", async () => {
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 5, includeRemoved: false } })
      .reply(500);
    renderPage("F26");

    await screen.findByTestId("CombinedAllocationTable");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/recruitmentcourses/all",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getAllByTestId(/^CombinedAllocationTable-row-/),
      ).toHaveLength(2),
    );
  });

  test("a ULA course list that cannot be read is toasted too", async () => {
    axiosMock
      .onGet(COURSES, { params: { recruitmentId: 6, includeRemoved: false } })
      .reply(500);
    renderPage("F26");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/recruitmentcourses/all",
      ),
    );
  });

  test("recruitments that cannot be read are toasted", async () => {
    axiosMock.onGet("/api/admin/recruitments/all").reply(500);
    renderPage("F26");

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/admin/recruitments/all",
      ),
    );
  });

  describe("the follow-up criteria of issue #358", () => {
    const headerIds = () =>
      screen
        .getAllByTestId(/^CombinedAllocationTable-header-[A-Za-z]+$/)
        .map((e) =>
          e
            .getAttribute("data-testid")
            .replace("CombinedAllocationTable-header-", ""),
        );
    const openColumns = async () => {
      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-columns-toggle"),
      );
    };

    test("the conversion factor box is on the line of its label", async () => {
      renderPage("F26");
      const box = await factorBox();

      const group = box.closest("[title]");
      expect(group).toHaveClass("d-flex", "align-items-center");
      expect(group.firstElementChild).toHaveTextContent(
        "Nominal TA to ULA conversion factor",
      );
      expect(group.firstElementChild.nextElementSibling).toContainElement(box);
    });

    test("the Budget page's boxes keep the label above the box", async () => {
      // The inline layout is the combined page's alone: the shared box is stacked by default.
      const { default: SavedOnChangeInput } =
        await import("main/components/Budget/SavedOnChangeInput");
      render(
        <SavedOnChangeInput
          id="x"
          label="L"
          stored="1"
          isValid={() => true}
          onSave={() => {}}
        />,
      );
      expect(screen.getByTestId("x").closest(".mb-2")).not.toHaveClass(
        "d-flex",
      );
    });

    test("by default Section, Title, Email, Days, Time, Room, Status and the rankings are hidden", async () => {
      renderPage("F26");
      await screen.findByTestId("CombinedAllocationTable");

      expect(headerIds()).toEqual([
        "courseId",
        "instructor",
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
      ]);
    });

    test("the Columns menu has Show All, Show None and a box for every column but Course Number", async () => {
      renderPage("F26");
      await openColumns();

      expect(
        screen.getByTestId("CombinedAllocationsPage-columns-select-all"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("CombinedAllocationsPage-columns-select-none"),
      ).toBeInTheDocument();
      // TA rankings are open in F26, ULA rankings are not started.
      expect(
        screen.getByTestId("CombinedAllocationsPage-columns-taRankingCount"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-ulaRankingCount"),
      ).toBeNull();
      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-courseId"),
      ).toBeNull();
      expect(screen.getAllByRole("checkbox").map((box) => box.id)).toHaveLength(
        21,
      );
    });

    test("Show All shows every column, including the rankings that exist", async () => {
      renderPage("F26");
      await openColumns();

      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-columns-select-all"),
      );

      expect(headerIds()).toEqual([
        "taRankingCount",
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
      // The TA ranking counts and instructor emails come from the recruitment's summaries.
      expect(
        await screen.findByTestId(
          "CombinedAllocationTable-ta-cell-row-2-ranking-link",
        ),
      ).toHaveTextContent("4");
      expect(td(2, "instructorEmail")).toHaveTextContent("pconrad@ucsb.edu");
    });

    test("Show None leaves only Course Number, and a box brings a column back", async () => {
      renderPage("F26");
      await openColumns();

      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-columns-select-none"),
      );
      expect(headerIds()).toEqual(["courseId"]);

      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-columns-title"),
      );
      expect(headerIds()).toEqual(["courseId", "title"]);
    });

    test("hiding a column from its heading unticks it; Course Number has no such link", async () => {
      renderPage("F26");
      await screen.findByTestId("CombinedAllocationTable");

      expect(
        screen.queryByTestId("CombinedAllocationTable-header-courseId-hide"),
      ).toBeNull();
      await userEvent.click(
        screen.getByTestId("CombinedAllocationTable-header-instructor-hide"),
      );

      expect(headerIds()).not.toContain("instructor");
      await openColumns();
      expect(
        screen.getByTestId("CombinedAllocationsPage-columns-instructor"),
      ).not.toBeChecked();
    });

    test("the choice is kept per quarter in local storage, under its own key", async () => {
      renderPage("F26");
      await screen.findByTestId("CombinedAllocationTable");
      expect(
        localStorage.getItem("combinedAllocations.hiddenColumns.F26"),
      ).toBeNull();

      await userEvent.click(
        screen.getByTestId("CombinedAllocationTable-header-instructor-hide"),
      );

      const stored = JSON.parse(
        localStorage.getItem("combinedAllocations.hiddenColumns.F26"),
      );
      expect(stored).toContain("instructor");
      expect(stored).toContain("section");
      expect(
        localStorage.getItem("combinedAllocations.hiddenColumns.W26"),
      ).toBeNull();
    });

    test("a stored choice is applied when the page opens", async () => {
      localStorage.setItem(
        "combinedAllocations.hiddenColumns.F26",
        JSON.stringify(["instructor"]),
      );
      renderPage("F26");
      await screen.findByTestId("CombinedAllocationTable");

      expect(headerIds()).toContain("section");
      expect(headerIds()).not.toContain("instructor");
    });

    test("the TA-only quarter's menu has no ULA, ASE or ULA rankings choices", async () => {
      renderPage("W26");
      await openColumns();

      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-ulaAllocation"),
      ).toBeNull();
      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-aseRatio"),
      ).toBeNull();
      expect(
        screen.getByTestId("CombinedAllocationsPage-columns-taAllocation"),
      ).toBeInTheDocument();
    });

    test("the ULA-only quarter's menu offers the ULA rankings, as its reviews are Closed", async () => {
      renderPage("S26");
      await openColumns();

      expect(
        screen.getByTestId("CombinedAllocationsPage-columns-ulaRankingCount"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-taAllocation"),
      ).toBeNull();
    });

    test("set enrollment estimates from max or actual acts on every recruitment of the quarter", async () => {
      renderPage("F26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-fill-estimates-max"),
      );

      await waitFor(() =>
        expect(
          axiosMock.history.put
            .filter(
              (r) => r.url === "/api/recruitmentcourses/enrollmentEstimates",
            )
            .map((r) => r.params),
        ).toEqual([
          { recruitmentId: 5, source: "MAX" },
          { recruitmentId: 6, source: "MAX" },
        ]),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Enrollment estimates set from maximum enrollment.",
        ),
      );

      axiosMock.resetHistory();
      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-fill-estimates-actual"),
      );
      await waitFor(() =>
        expect(axiosMock.history.put.map((r) => r.params.source)).toEqual([
          "ACTUAL",
          "ACTUAL",
        ]),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Enrollment estimates set from actual enrollment.",
        ),
      );
    });

    test("with one recruitment the estimates are set for that one only", async () => {
      renderPage("W26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-fill-estimates-max"),
      );

      await waitFor(() =>
        expect(axiosMock.history.put.map((r) => r.params)).toEqual([
          { recruitmentId: 1, source: "MAX" },
        ]),
      );
    });

    test("a failed estimates call is toasted", async () => {
      axiosMock.onPut("/api/recruitmentcourses/enrollmentEstimates").reply(500);
      renderPage("F26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-fill-estimates-max"),
      );

      await waitFor(() => expect(mockToast).toHaveBeenCalled());
    });

    test("each type's Auto assign button has the allocations page's tooltip", async () => {
      renderPage("F26");

      const ta = await screen.findByTestId(
        "CombinedAllocationsPage-auto-assign-TA",
      );
      expect(ta).toHaveTextContent("Auto assign TA allocations");
      expect(ta).toHaveClass("btn-outline-primary");
      await userEvent.hover(ta);
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "Automatically allocate the 8 TAs across courses based on enrollment",
      );
      await userEvent.unhover(ta);

      const ula = screen.getByTestId("CombinedAllocationsPage-auto-assign-ULA");
      expect(ula).toHaveTextContent("Auto assign ULA allocations");
      await userEvent.hover(ula);
      await waitFor(() =>
        expect(screen.getByRole("tooltip")).toHaveTextContent(
          "Automatically allocate the 10 ULAs across courses based on enrollment",
        ),
      );
    });

    test("a quarter with one recruitment has only that type's Auto assign button", async () => {
      renderPage("W26");

      await screen.findByTestId("CombinedAllocationsPage-auto-assign-TA");
      expect(
        screen.queryByTestId("CombinedAllocationsPage-auto-assign-ULA"),
      ).toBeNull();
    });

    test("Auto assign asks first, and confirming allocates that type's recruitment", async () => {
      renderPage("F26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-auto-assign-ULA"),
      );
      const modal = await screen.findByTestId(
        "CombinedAllocationsPage-auto-assign-modal",
      );
      expect(modal).toHaveTextContent("Auto assign ULA allocations");
      expect(modal).toHaveTextContent(
        "This will overwrite all values currently in the ULA allocation fields. This cannot be undone.",
      );
      expect(modal).toHaveTextContent("Are you sure?");
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/recruitmentcourses/autoAllocate",
        ),
      ).toHaveLength(0);

      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-auto-assign-confirm"),
      );

      await waitFor(() =>
        expect(
          axiosMock.history.post
            .filter((r) => r.url === "/api/recruitmentcourses/autoAllocate")
            .map((r) => r.params),
        ).toEqual([{ recruitmentId: 6 }]),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Allocations assigned from the enrollment estimates.",
        ),
      );
      await waitFor(() =>
        expect(
          screen.queryByTestId("CombinedAllocationsPage-auto-assign-modal"),
        ).not.toBeInTheDocument(),
      );
    });

    test("confirming for TA allocates the TA recruitment", async () => {
      renderPage("F26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-auto-assign-TA"),
      );
      await userEvent.click(
        await screen.findByTestId(
          "CombinedAllocationsPage-auto-assign-confirm",
        ),
      );

      await waitFor(() =>
        expect(axiosMock.history.post.map((r) => r.params)).toEqual([
          { recruitmentId: 5 },
        ]),
      );
    });

    test("No, keep my current allocations closes the modal and sends nothing", async () => {
      renderPage("F26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-auto-assign-TA"),
      );
      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-auto-assign-cancel"),
      );

      await waitFor(() =>
        expect(
          screen.queryByTestId("CombinedAllocationsPage-auto-assign-modal"),
        ).not.toBeInTheDocument(),
      );
      expect(axiosMock.history.post).toHaveLength(0);
    });

    const summariesUrl = (id) =>
      `/api/instructor/recruitments/${id}/admin-course-rankings`;

    test("no rankings column is offered while the recruitments are not known", async () => {
      axiosMock.onGet("/api/admin/recruitments/all").reply(200, []);
      renderPage("F26");
      await openColumns();

      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-taRankingCount"),
      ).toBeNull();
      expect(
        screen.queryByTestId("CombinedAllocationsPage-columns-ulaRankingCount"),
      ).toBeNull();
    });

    test("each type's rankings come from its own recruitment's summaries, not including removed courses", async () => {
      axiosMock.onGet("/api/admin/recruitments/all").reply(
        200,
        combinedAllocationsFixtures.recruitments.map((r) => ({
          ...r,
          reviewStatus: "Open",
        })),
      );
      renderPage("F26");
      await openColumns();
      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-columns-select-all"),
      );

      // Row 2 is CMPSC 156 (TA 4, ULA 9); row 1 is CMPSC 24, ULA only (7).
      expect(
        await screen.findByTestId(
          "CombinedAllocationTable-ula-cell-row-2-ranking-link",
        ),
      ).toHaveTextContent("9");
      expect(
        screen.getByTestId(
          "CombinedAllocationTable-ta-cell-row-2-ranking-link",
        ),
      ).toHaveTextContent("4");
      expect(
        screen.getByTestId(
          "CombinedAllocationTable-ula-cell-row-1-ranking-link",
        ),
      ).toHaveTextContent("7");
      expect(gets(summariesUrl(5)).map((r) => r.params)).toEqual([
        { includeRemoved: false },
      ]);
      expect(gets(summariesUrl(6)).map((r) => r.params)).toEqual([
        { includeRemoved: false },
      ]);
    });

    test.each([
      ["S26", 3],
      ["W26", 1],
    ])(
      "%s, with one recruitment, reads that recruitment's summaries only",
      async (qyy, id) => {
        renderPage(qyy);
        await screen.findByTestId("CombinedAllocationTable");

        await waitFor(() => expect(gets(summariesUrl(id))).toHaveLength(1));
        expect(
          axiosMock.history.get.filter((r) => r.url.includes("undefined")),
        ).toHaveLength(0);
      },
    );

    test("ranking summaries that cannot be read are not toasted", async () => {
      axiosMock.onGet(summariesUrl(5)).reply(500);
      axiosMock.onGet(summariesUrl(6)).reply(500);
      renderPage("F26");
      await screen.findByTestId("CombinedAllocationTable");
      await waitFor(() => expect(gets(summariesUrl(6))).toHaveLength(1));

      expect(mockToast).not.toHaveBeenCalled();
    });

    test("the estimates control reads as the allocations page's, and Auto assign's tooltip has its own id", async () => {
      renderPage("F26");

      expect(
        await screen.findByTestId("CombinedAllocationsPage-fill-estimates"),
      ).toHaveTextContent("Set enrollment estimates from: max, actual.");
      await userEvent.hover(
        screen.getByTestId("CombinedAllocationsPage-auto-assign-TA"),
      );
      expect(await screen.findByRole("tooltip")).toHaveAttribute(
        "id",
        "CombinedAllocationsPage-auto-assign-TA-tooltip",
      );
    });

    test("the modal's close button closes it", async () => {
      renderPage("F26");

      await userEvent.click(
        await screen.findByTestId("CombinedAllocationsPage-auto-assign-TA"),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Close" }),
      );

      await waitFor(() =>
        expect(
          screen.queryByTestId("CombinedAllocationsPage-auto-assign-modal"),
        ).not.toBeInTheDocument(),
      );
    });

    test("the page has no Download Rankings CSV: it is on the recruitment cards", async () => {
      renderPage("F26");
      await screen.findByTestId("CombinedAllocationTable");

      expect(screen.queryByText(/Download/)).not.toBeInTheDocument();
    });

    test("copying an email copies it and says so; a refused copy says that", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      renderPage("F26");
      await openColumns();
      await userEvent.click(
        screen.getByTestId("CombinedAllocationsPage-columns-select-all"),
      );

      await userEvent.click(
        await screen.findByTestId(
          "CombinedAllocationTable-cell-row-2-copy-email",
        ),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith("Email copied to clipboard."),
      );
      expect(writeText).toHaveBeenCalledWith("pconrad@ucsb.edu");

      writeText.mockRejectedValue(new Error("no"));
      await userEvent.click(
        screen.getByTestId("CombinedAllocationTable-cell-row-2-copy-email"),
      );
      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          "Unable to copy to clipboard. Check your browser clipboard permissions.",
        ),
      );
    });
  });
});
