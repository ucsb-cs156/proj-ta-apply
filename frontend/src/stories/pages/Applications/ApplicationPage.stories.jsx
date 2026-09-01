import React from "react";
import { HttpResponse, http } from "msw";
import ApplicationPage from "main/pages/Applications/ApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;
const courses = ["CMPSC     8", "CMPSC    16", "CMPSC   130A", "CMPSC   156"];

// The primary consideration date decides which of the three phases the page is in, so each
// story picks a recruitment whose date puts it in the phase being shown.
const stillOpen = { ...openUla, primaryConsiderationDate: "2099-01-20" };
const pastDeadline = { ...openUla, primaryConsiderationDate: "2000-01-20" };

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.userOnly),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/recruitments/courses", () => HttpResponse.json(courses)),
  http.put("/api/applications", () =>
    HttpResponse.json(applicationsFixtures.oneUlaApplication),
  ),
  http.put("/api/applications/comments", () =>
    HttpResponse.json(applicationsFixtures.oneUlaApplication),
  ),
];

export default {
  title: "pages/Applications/ApplicationPage",
  component: ApplicationPage,
  parameters: {
    // The page reads :id from the route.
    reactRouter: { initialEntries: ["/applications/2"] },
  },
};

const Template = () => <ApplicationPage />;

export const Editable = Template.bind({});
Editable.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications", () =>
        HttpResponse.json(applicationsFixtures.oneUlaApplication),
      ),
      http.get("/api/recruitments/applicable", () =>
        HttpResponse.json([stillOpen]),
      ),
    ],
  },
};

/** Past the deadline the answers are shown back, and only the comments can still change. */
export const CommentsOnly = Template.bind({});
CommentsOnly.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications", () =>
        HttpResponse.json(applicationsFixtures.oneUlaApplication),
      ),
      http.get("/api/recruitments/applicable", () =>
        HttpResponse.json([pastDeadline]),
      ),
    ],
  },
};

export const ClosedAndViewOnly = Template.bind({});
ClosedAndViewOnly.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/applications", () =>
        HttpResponse.json({
          ...applicationsFixtures.oneTaApplication,
          recruitmentId: 1,
        }),
      ),
      http.get("/api/recruitments/applicable", () =>
        HttpResponse.json([closedTa]),
      ),
    ],
  },
};
