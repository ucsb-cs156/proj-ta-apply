import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import RecruitmentApplicationsPage from "main/pages/Admin/RecruitmentApplicationsPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";

// Issue #189: the hidden columns, as if the defaults were already on file; a ULA round's
// defaults differ from a TA round's. Hiding or showing answers with the current list.
const hiddenColumnHandlers = [
  http.get("/api/admin/hiddencolumns", ({ request }) =>
    HttpResponse.json(
      defaultHiddenColumns(
        new URL(request.url).searchParams.get("recruitmentId") === "2"
          ? "ULA"
          : "TA",
      ),
    ),
  ),
  http.put("/api/admin/hiddencolumns/all", ({ request }) =>
    HttpResponse.json(
      (new URL(request.url).searchParams.get("columnIds") ?? "")
        .split(",")
        .filter((id) => id !== ""),
    ),
  ),
  http.put("/api/admin/hiddencolumns", ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get("hidden") === "true"
        ? [new URL(request.url).searchParams.get("columnId")]
        : [],
    ),
  ),
];

const common = [
  ...hiddenColumnHandlers,
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(recruitmentsFixtures.threeRecruitments),
  ),
  http.get("/api/admin/recruitmentaudittrail/all", () =>
    HttpResponse.json(recruitmentAuditTrailFixtures.onePage),
  ),
];

export default {
  title: "pages/Admin/RecruitmentApplicationsPage",
  component: RecruitmentApplicationsPage,
};

/** Rendered under a Route so useParams() sees the id in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route
      path="/admin/recruitments/:recruitmentId/applications"
      element={<RecruitmentApplicationsPage />}
    />
  </Routes>
);

/** The TA round with id 1: one real application and one test application. */
export const TaRound = Template.bind({});
TaRound.parameters = {
  reactRouter: {
    initialEntries: ["/admin/recruitments/1/applications"],
  },
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/applications/all", () =>
        HttpResponse.json([
          applicationsFixtures.oneTaApplication,
          applicationsFixtures.oneTestApplication,
        ]),
      ),
    ],
  },
};

/** The ULA round with id 2: the Expected Graduation column. */
export const UlaRound = Template.bind({});
UlaRound.parameters = {
  reactRouter: {
    initialEntries: ["/admin/recruitments/2/applications"],
  },
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/applications/all", () =>
        HttpResponse.json([applicationsFixtures.oneUlaApplication]),
      ),
    ],
  },
};

export const NothingYet = Template.bind({});
NothingYet.parameters = {
  reactRouter: {
    initialEntries: ["/admin/recruitments/3/applications"],
  },
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/applications/all", () => HttpResponse.json([])),
    ],
  },
};
