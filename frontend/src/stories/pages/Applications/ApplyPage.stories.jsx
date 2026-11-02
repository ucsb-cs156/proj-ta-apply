import courseInstructorsFixtures from "fixtures/courseInstructorsFixtures";
import React from "react";
import { HttpResponse, http } from "msw";
import ApplyPage from "main/pages/Applications/ApplyPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import coursesFixtures from "fixtures/coursesFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
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
  // No application yet for this recruitment, so the form is offered.
  http.get("/api/applications/mine", () => HttpResponse.json([])),
  http.get("/api/recruitments/courses", () => HttpResponse.json(courses)),
  http.get("/api/recruitments/sections", () =>
    HttpResponse.json(courseSectionsFixtures.cmpsc156),
  ),
  http.get("/api/recruitments/instructors", () =>
    HttpResponse.json(courseInstructorsFixtures.fourCourses),
  ),
  // Add Multiple UCSB CMPSC Courses lists the course table (issue #100).
  http.get("/api/courses/all", () =>
    HttpResponse.json(coursesFixtures.threeCourses),
  ),
  http.get("/api/notices/current", () =>
    HttpResponse.json([noticesFixtures.ulaV1]),
  ),
  http.get("/api/recruitments/options", () =>
    HttpResponse.json(appSettingsFixtures.ulaOptions),
  ),
  http.post("/api/applications/post", () =>
    HttpResponse.json(applicationsFixtures.oneUlaApplication),
  ),
  // Saving as you go (issue #270): the draft the form opens, and the saves into it.
  http.put("/api/draftApplications", () =>
    HttpResponse.json(draftApplicationsFixtures.savedUlaDraft),
  ),
];

const openEmptyDraft = http.post("/api/draftApplications/open", () =>
  HttpResponse.json(draftApplicationsFixtures.emptyUlaDraft),
);

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
      openEmptyDraft,
      http.get("/api/applications/prefill", () => HttpResponse.json([])),
    ],
  },
};

/** Resuming a draft: what was typed and saved before comes back, and Save Draft is beside Submit. */
export const ResumedDraft = Template.bind({});
ResumedDraft.parameters = {
  msw: {
    handlers: [
      ...common,
      http.post("/api/draftApplications/open", () =>
        HttpResponse.json(draftApplicationsFixtures.savedUlaDraft),
      ),
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
      openEmptyDraft,
      http.get("/api/applications/prefill", () =>
        HttpResponse.json([applicationsFixtures.oneUlaApplication]),
      ),
    ],
  },
};
