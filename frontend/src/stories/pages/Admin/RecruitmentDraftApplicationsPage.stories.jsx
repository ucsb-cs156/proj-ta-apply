import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import RecruitmentDraftApplicationsPage from "main/pages/Admin/RecruitmentDraftApplicationsPage";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";

const common = [
  http.get("/api/admin/hiddencolumns", ({ request }) =>
    HttpResponse.json(
      defaultHiddenColumns(
        new URL(request.url).searchParams.get("recruitmentId") === "1"
          ? "TA"
          : "ULA",
      ),
    ),
  ),
  http.put("/api/admin/hiddencolumns/all", () => HttpResponse.json([])),
  http.put("/api/admin/hiddencolumns", () => HttpResponse.json([])),
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
  title: "pages/Admin/RecruitmentDraftApplicationsPage",
  component: RecruitmentDraftApplicationsPage,
};

/** Rendered under a Route so useParams() sees the id in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route
      path="/admin/recruitments/:recruitmentId/draft-applications"
      element={<RecruitmentDraftApplicationsPage />}
    />
  </Routes>
);

const routeTo = (recruitmentId) => ({
  initialEntries: [`/admin/recruitments/${recruitmentId}/draft-applications`],
});

/** The TA round with id 1: two drafts. */
export const TaRound = Template.bind({});
TaRound.parameters = {
  reactRouter: routeTo(1),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/draftApplications/all", () =>
        HttpResponse.json([
          draftApplicationsFixtures.adminSavedTaDraft,
          {
            ...draftApplicationsFixtures.adminSavedTaDraft,
            id: 23,
            firstName: "Uma",
            adminComments: "Asked to apply to both rounds",
          },
        ]),
      ),
    ],
  },
};

/** The ULA round with id 2: one saved draft with an admin comment, one only just opened. */
export const UlaRound = Template.bind({});
UlaRound.parameters = {
  reactRouter: routeTo(2),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/draftApplications/all", () =>
        HttpResponse.json([
          draftApplicationsFixtures.adminSavedUlaDraft,
          draftApplicationsFixtures.adminEmptyUlaDraft,
        ]),
      ),
    ],
  },
};

/** No one has started an application: the count is 0 and there is no table. */
export const NoDrafts = Template.bind({});
NoDrafts.parameters = {
  reactRouter: routeTo(3),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/draftApplications/all", () => HttpResponse.json([])),
    ],
  },
};
