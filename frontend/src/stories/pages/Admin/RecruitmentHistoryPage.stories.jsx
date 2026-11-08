import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import RecruitmentHistoryPage from "main/pages/Admin/RecruitmentHistoryPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(recruitmentsFixtures.threeRecruitments),
  ),
];

export default {
  title: "pages/Admin/RecruitmentHistoryPage",
  component: RecruitmentHistoryPage,
};

/** Rendered under a Route so useParams() sees the id in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route
      path="/admin/recruitments/:recruitmentId/history"
      element={<RecruitmentHistoryPage />}
    />
  </Routes>
);

const routeTo = (recruitmentId) => ({
  initialEntries: [`/admin/recruitments/${recruitmentId}/history`],
});

/** The TA round with id 1: three changes on one page, newest first (issue #139, #337). */
export const ThreeChanges = Template.bind({});
ThreeChanges.parameters = {
  reactRouter: routeTo(1),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/recruitmentaudittrail/all", () =>
        HttpResponse.json(recruitmentAuditTrailFixtures.onePage),
      ),
    ],
  },
};

/** The same three changes, two to a page: Next is enabled, Previous is not. */
export const TwoPages = Template.bind({});
TwoPages.parameters = {
  reactRouter: routeTo(1),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/recruitmentaudittrail/all", ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("page") === "0"
            ? recruitmentAuditTrailFixtures.firstOfTwoPages
            : recruitmentAuditTrailFixtures.secondOfTwoPages,
        ),
      ),
    ],
  },
};

/** The ULA round with id 2, with no changes recorded. */
export const NoChanges = Template.bind({});
NoChanges.parameters = {
  reactRouter: routeTo(2),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/recruitmentaudittrail/all", () =>
        HttpResponse.json(recruitmentAuditTrailFixtures.emptyPage),
      ),
    ],
  },
};
