import React from "react";
import { HttpResponse, http } from "msw";
import TestApplicationPage from "main/pages/Admin/TestApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json({
      ...apiCurrentUserFixtures.adminUser,
      user: {
        ...apiCurrentUserFixtures.adminUser.user,
        givenName: "Ada",
        familyName: "Admin",
      },
    }),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(recruitmentsFixtures.threeRecruitments),
  ),
  http.get("/api/recruitmentcourses/all", () =>
    HttpResponse.json(recruitmentCoursesFixtures.fourCourses),
  ),
  http.post("/api/applications/test", () =>
    HttpResponse.json(applicationsFixtures.oneTestApplication),
  ),
];

export default {
  title: "pages/Admin/TestApplicationPage",
  component: TestApplicationPage,
  parameters: {
    // Recruitment 3 is a closed TA recruitment; the preview works before it opens.
    reactRouter: { initialEntries: ["/admin/recruitments/3/test-application"] },
  },
};

const Template = () => <TestApplicationPage />;

export const BeforeAnyTest = Template.bind({});
BeforeAnyTest.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications/mine", () => HttpResponse.json([])),
    ],
  },
};

/** After one submission the saved test answers are shown back under the form. */
export const WithASavedTestApplication = Template.bind({});
WithASavedTestApplication.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications/mine", () =>
        HttpResponse.json([applicationsFixtures.oneTestApplication]),
      ),
    ],
  },
};
