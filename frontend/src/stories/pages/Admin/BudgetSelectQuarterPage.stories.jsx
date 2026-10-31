import React from "react";
import { HttpResponse, http } from "msw";
import BudgetSelectQuarterPage from "main/pages/Admin/BudgetSelectQuarterPage";
import budgetFixtures from "fixtures/budgetFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/BudgetSelectQuarterPage",
  component: BudgetSelectQuarterPage,
};

const Template = () => <BudgetSelectQuarterPage />;

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
];

export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/budget/quarters", () =>
        HttpResponse.json(budgetFixtures.quarters),
      ),
    ],
  },
};

export const NoRecruitments = Template.bind({});
NoRecruitments.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/budget/quarters", () => HttpResponse.json([])),
    ],
  },
};
