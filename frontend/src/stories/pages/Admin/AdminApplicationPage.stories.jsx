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

const AUDIT_KEY = "collapsibleCard.AdminApplicationPage-auditTrail";

/**
 * Rendered under a Route so useParams() sees the id in the story's initialEntries. Each story sets
 * the Audit Trail card's remembered setting itself, so it starts as the story says, not as the last
 * story left it.
 */
const templateWith = (auditOpen) => {
  const Template = () => {
    if (auditOpen) {
      localStorage.setItem(AUDIT_KEY, "open");
    } else {
      localStorage.removeItem(AUDIT_KEY);
    }
    return (
      <Routes>
        <Route
          path="/admin/applications/:id"
          element={<AdminApplicationPage />}
        />
      </Routes>
    );
  };
  return Template;
};

/** A ULA application with admin comments already written, and two audited changes (Audit Trail card open). */
export const UlaWithComments = templateWith(true).bind({});
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

/** A TA application nobody has commented on or edited yet; the Audit Trail card is closed. */
export const TaNoCommentsYet = templateWith(false).bind({});
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
