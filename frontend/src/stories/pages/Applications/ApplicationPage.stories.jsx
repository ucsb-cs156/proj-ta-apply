import React from "react";
import { HttpResponse, http } from "msw";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import ApplicationPage from "main/pages/Applications/ApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import coursesFixtures from "fixtures/coursesFixtures";
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
  http.get("/api/recruitments/sections", () =>
    HttpResponse.json(courseSectionsFixtures.cmpsc156),
  ),
  // Add Multiple UCSB CMPSC Courses lists the course table (issue #100).
  http.get("/api/courses/all", () =>
    HttpResponse.json(coursesFixtures.threeCourses),
  ),
  http.get("/api/notices", () => HttpResponse.json(noticesFixtures.ulaV1)),
  http.get("/api/notices/current", () =>
    HttpResponse.json([noticesFixtures.ulaV1]),
  ),
  http.get("/api/recruitments/options", () =>
    HttpResponse.json(appSettingsFixtures.ulaOptions),
  ),
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

/** Past the deadline the form is still offered (issue #98), with the comments box after it. */
export const PastDeadline = Template.bind({});
PastDeadline.parameters = {
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
