import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import CombinedAllocationsPage from "main/pages/Admin/CombinedAllocationsPage";
import budgetFixtures from "fixtures/budgetFixtures";
import combinedAllocationsFixtures from "fixtures/combinedAllocationsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/CombinedAllocationsPage",
  component: CombinedAllocationsPage,
};

// The page reads :qyy from the route, so each story sets its own initial entry.
const Template = () => (
  <Routes>
    <Route
      path="/admin/allocations/:qyy"
      element={<CombinedAllocationsPage />}
    />
  </Routes>
);

const handlers = (summary, coursesByRecruitment) => [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/budget", () => HttpResponse.json(summary)),
  http.put("/api/admin/budget", () => HttpResponse.json(summary)),
  http.get("/api/recruitmentcourses/all", ({ request }) =>
    HttpResponse.json(
      coursesByRecruitment[
        new URL(request.url).searchParams.get("recruitmentId")
      ] ?? [],
    ),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(combinedAllocationsFixtures.recruitments),
  ),
  http.put("/api/recruitmentcourses/allocation", () => HttpResponse.json({})),
];

const { taCourses, ulaCourses } = combinedAllocationsFixtures;

/** F26: both recruitments: the costs, the conversion factor and the ASE:Student Ratio. */
export const BothRecruitments = Template.bind({});
BothRecruitments.parameters = {
  reactRouter: { initialEntries: ["/admin/allocations/F26"] },
  msw: {
    handlers: handlers(budgetFixtures.bothTypes, {
      5: taCourses,
      6: ulaCourses,
    }),
  },
};

/** W26: a TA recruitment only: TA columns only, and no costs, factor or ASE:Student Ratio. */
export const TaOnly = Template.bind({});
TaOnly.parameters = {
  reactRouter: { initialEntries: ["/admin/allocations/W26"] },
  msw: {
    handlers: handlers(budgetFixtures.taOnlyOverBudget, { 1: [taCourses[1]] }),
  },
};

/** S26: a ULA recruitment only: ULA columns only. */
export const UlaOnly = Template.bind({});
UlaOnly.parameters = {
  reactRouter: { initialEntries: ["/admin/allocations/S26"] },
  msw: {
    handlers: handlers(budgetFixtures.ulaOnly, { 3: [ulaCourses[1]] }),
  },
};
