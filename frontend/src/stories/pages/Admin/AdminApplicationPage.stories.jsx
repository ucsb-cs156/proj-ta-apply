import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import AdminApplicationPage from "main/pages/Admin/AdminApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import auditTrailFixtures from "fixtures/auditTrailFixtures";
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
  http.get("/api/notices", () => HttpResponse.json(noticesFixtures.ulaV1)),
  http.put("/api/admin/applications/adminComments", () =>
    HttpResponse.json(applicationsFixtures.oneUlaApplication),
  ),
];

const withAuditRows = http.get("/api/admin/audittrail/application", () =>
  HttpResponse.json(auditTrailFixtures.threeRows.slice(1)),
);
const noAuditRows = http.get("/api/admin/audittrail/application", () =>
  HttpResponse.json([]),
);

const routeTo = (id) => ({ initialEntries: [`/admin/applications/${id}`] });

export default {
  title: "pages/Admin/AdminApplicationPage",
  component: AdminApplicationPage,
};

/** Rendered under a Route so useParams() sees the id in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route path="/admin/applications/:id" element={<AdminApplicationPage />} />
  </Routes>
);

/** A ULA application with admin comments already written, and two audited changes. */
export const UlaWithComments = Template.bind({});
UlaWithComments.parameters = {
  reactRouter: routeTo(applicationsFixtures.oneUlaApplication.id),
  msw: {
    handlers: [
      ...common,
      withAuditRows,
      http.get("/api/admin/applications", () =>
        HttpResponse.json(applicationsFixtures.oneUlaApplication),
      ),
    ],
  },
};

/** A TA application nobody has commented on or edited yet. */
export const TaNoCommentsYet = Template.bind({});
TaNoCommentsYet.parameters = {
  reactRouter: routeTo(applicationsFixtures.oneTaApplication.id),
  msw: {
    handlers: [
      ...common,
      noAuditRows,
      http.get("/api/admin/applications", () =>
        HttpResponse.json(applicationsFixtures.oneTaApplication),
      ),
    ],
  },
};
