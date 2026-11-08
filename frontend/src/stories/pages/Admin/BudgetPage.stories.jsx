import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import BudgetPage from "main/pages/Admin/BudgetPage";
import budgetFixtures from "fixtures/budgetFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/BudgetPage",
  component: BudgetPage,
};

const AUDIT_OPEN = "collapsibleCard.BudgetPage-auditTrail";

// The page reads :qyy from the route, so each story sets its own initial entry. The Audit Trail
// card (issue #391) remembers whether it was open; each story starts it as a first visit would,
// closed, unless it says otherwise.
const Template = ({ auditOpen = false }) => {
  if (auditOpen) {
    localStorage.setItem(AUDIT_OPEN, "open");
  } else {
    localStorage.removeItem(AUDIT_OPEN);
  }
  return (
    <Routes>
      <Route path="/admin/budget/:qyy" element={<BudgetPage />} />
    </Routes>
  );
};

const handlers = (
  summary,
  presence = { others: [], heartbeatSeconds: 5 },
  auditTrail = recruitmentAuditTrailFixtures.hiringTargetPage,
) => [
  http.get("/api/admin/recruitmentaudittrail/hiringTargets", () =>
    HttpResponse.json(auditTrail),
  ),
  http.post("/api/admin/budget/heartbeat", () => HttpResponse.json(presence)),
  http.post(
    "/api/admin/budget/leave",
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/budget", () => HttpResponse.json(summary)),
  http.put("/api/admin/budget", () => HttpResponse.json(summary)),
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

/** Issue #391: the Audit Trail card open, with the changes to both hiring targets. */
export const AuditTrailOpen = () => <Template auditOpen />;
AuditTrailOpen.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/F26"] },
  msw: { handlers: handlers(budgetFixtures.bothTypes) },
};

/** The card open for a quarter whose hiring targets have never been changed. */
export const AuditTrailOpenEmpty = () => <Template auditOpen />;
AuditTrailOpenEmpty.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/W26"] },
  msw: {
    handlers: handlers(
      budgetFixtures.taOnlyOverBudget,
      { others: [], heartbeatSeconds: 5 },
      recruitmentAuditTrailFixtures.emptyPage,
    ),
  },
};

const phill = {
  label: "phtcon@ucsb.edu (Phill Conrad)",
  samePerson: false,
  admin: true,
};

/** An older tab: another admin has the same quarter open, and only the banner shows. */
export const AnotherAdminIsEditing = Template.bind({});
AnotherAdminIsEditing.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/F26"] },
  msw: {
    handlers: handlers(budgetFixtures.bothTypes, {
      others: [phill],
      heartbeatSeconds: 5,
      newest: false,
      arrivedAtMillis: 1000,
    }),
  },
};

/** The newest tab is asked what to do: leave, wait, or continue anyway. */
export const NewestTabIsAsked = Template.bind({});
NewestTabIsAsked.parameters = {
  reactRouter: { initialEntries: ["/admin/budget/F26"] },
  msw: {
    handlers: handlers(budgetFixtures.bothTypes, {
      others: [phill],
      heartbeatSeconds: 5,
      newest: true,
      arrivedAtMillis: 1000,
    }),
  },
};
