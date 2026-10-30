import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import AdminApplicationEditPage from "main/pages/Admin/AdminApplicationEditPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import coursesFixtures from "fixtures/coursesFixtures";
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
  http.get("/api/recruitments/courses", () =>
    HttpResponse.json(["CMPSC     8", "CMPSC   156"]),
  ),
  http.get("/api/recruitments/sections", () =>
    HttpResponse.json(courseSectionsFixtures.cmpsc156),
  ),
  // Add Multiple UCSB CMPSC Courses lists the course table (issue #100).
  http.get("/api/courses/all", () =>
    HttpResponse.json(coursesFixtures.threeCourses),
  ),
  http.get("/api/notices", () => HttpResponse.json(noticesFixtures.ulaV1)),
  http.put("/api/admin/applications", () =>
    HttpResponse.json(applicationsFixtures.oneUlaApplication),
  ),
];

const routeTo = (id) => ({
  initialEntries: [`/admin/applications/${id}/edit`],
});

export default {
  title: "pages/Admin/AdminApplicationEditPage",
  component: AdminApplicationEditPage,
};

/** Rendered under a Route so useParams() sees the id in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route
      path="/admin/applications/:id/edit"
      element={<AdminApplicationEditPage />}
    />
  </Routes>
);

export const UlaApplication = Template.bind({});
UlaApplication.parameters = {
  reactRouter: routeTo(applicationsFixtures.oneUlaApplication.id),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/applications", () =>
        HttpResponse.json(applicationsFixtures.oneUlaApplication),
      ),
      http.get("/api/recruitments/options", () =>
        HttpResponse.json(appSettingsFixtures.ulaOptions),
      ),
    ],
  },
};

export const TaApplication = Template.bind({});
TaApplication.parameters = {
  reactRouter: routeTo(applicationsFixtures.oneTaApplication.id),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/applications", () =>
        HttpResponse.json(applicationsFixtures.oneTaApplication),
      ),
      http.get("/api/recruitments/options", () =>
        HttpResponse.json(appSettingsFixtures.taOptions),
      ),
    ],
  },
};
