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
    await screen.findByText("Data Structures");
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
    await screen.findByText("Intro");
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
});
