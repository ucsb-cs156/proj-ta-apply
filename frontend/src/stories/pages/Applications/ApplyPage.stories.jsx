import React from "react";
import { HttpResponse, http } from "msw";
import ApplyPage from "main/pages/Applications/ApplyPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const [, openUla] = recruitmentsFixtures.threeRecruitments;
const courses = ["CMPSC     8", "CMPSC    16", "CMPSC   130A", "CMPSC   156"];

const common = [
  // Both names, so the empty form shows the Google-account fallback.
  http.get("/api/currentUser", () =>
    HttpResponse.json({
      ...apiCurrentUserFixtures.userOnly,
      user: {
        ...apiCurrentUserFixtures.userOnly.user,
        givenName: "Chris",
        familyName: "Gaucho",
      },
    }),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/recruitments/applicable", () => HttpResponse.json([openUla])),
  http.get("/api/recruitments/courses", () => HttpResponse.json(courses)),
  http.post("/api/applications/post", () =>
    HttpResponse.json(applicationsFixtures.oneUlaApplication),
  ),
];

export default {
  title: "pages/Applications/ApplyPage",
  component: ApplyPage,
  parameters: {
    // The page reads :recruitmentId from the route.
    reactRouter: { initialEntries: ["/apply/2"] },
  },
};

const Template = () => <ApplyPage />;

export const FirstTimeApplicant = Template.bind({});
FirstTimeApplicant.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications/prefill", () => HttpResponse.json([])),
    ],
  },
};

/** A repeat applicant's answers are carried over so they need not retype everything. */
export const PrefilledFromAPreviousApplication = Template.bind({});
PrefilledFromAPreviousApplication.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications/prefill", () =>
        HttpResponse.json([applicationsFixtures.oneUlaApplication]),
      ),
    ],
  },
};
