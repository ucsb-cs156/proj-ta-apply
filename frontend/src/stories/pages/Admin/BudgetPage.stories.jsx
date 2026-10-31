import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import BudgetPage from "main/pages/Admin/BudgetPage";
import budgetFixtures from "fixtures/budgetFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/BudgetPage",
  component: BudgetPage,
};

// The page reads :qyy from the route, so each story sets its own initial entry.
const Template = () => (
  <Routes>
    <Route path="/admin/budget/:qyy" element={<BudgetPage />} />
  </Routes>
);

const handlers = (summary) => [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/budget", () => HttpResponse.json(summary)),
  http.put("/api/admin/budget", () => HttpResponse.json(summary)),
  http.put("/api/admin/recruitments/avgCostPerPosition", () =>
    HttpResponse.json({}),
  ),
  http.put("/api/admin/recruitments/totalHiringTarget", () =>
    HttpResponse.json({}),
  ),
];

export const BothRecruitments = Template.bind({});
BothRecruitments.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/F26"] },
  msw: { handlers: handlers(budgetFixtures.bothTypes) },
};

export const UlaOnlyNothingEntered = Template.bind({});
UlaOnlyNothingEntered.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/S26"] },
  msw: { handlers: handlers(budgetFixtures.ulaOnly) },
};

export const TaOnlyOverBudget = Template.bind({});
TaOnlyOverBudget.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/W26"] },
  msw: { handlers: handlers(budgetFixtures.taOnlyOverBudget) },
};

export const NotAQuarter = Template.bind({});
NotAQuarter.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/Fall2026"] },
  msw: { handlers: handlers(budgetFixtures.bothTypes) },
};
