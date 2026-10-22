import React from "react";
import { HttpResponse, http } from "msw";
import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

const handlers = (user, backend = {}) => [
  http.get("/api/currentUser", () => HttpResponse.json(user)),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/recruitments/open", () =>
    HttpResponse.json(backend.open ?? []),
  ),
  http.get("/api/recruitments/upcoming", () =>
    HttpResponse.json(backend.upcoming ?? []),
  ),
  http.get("/api/recruitments/recentlyClosed", () =>
    HttpResponse.json(backend.recentlyClosed ?? []),
  ),
  http.get("/api/recruitments/applicable", () =>
    HttpResponse.json(backend.applicable ?? []),
  ),
  http.get("/api/applications/mine", () =>
    HttpResponse.json(backend.applications ?? []),
  ),
];

export default {
  title: "pages/Home/HomePageLoggedIn",
  component: HomePageLoggedIn,
};

const Template = () => <HomePageLoggedIn />;

export const UndergradNothingOpen = Template.bind({});
UndergradNothingOpen.parameters = {
  msw: { handlers: handlers(apiCurrentUserFixtures.userOnly) },
};

export const UndergradApplicationsOpen = Template.bind({});
UndergradApplicationsOpen.parameters = {
  msw: {
    handlers: handlers(apiCurrentUserFixtures.userOnly, { open: [openUla] }),
  },
};

export const GradStudentWithAnApplication = Template.bind({});
GradStudentWithAnApplication.parameters = {
  msw: {
    handlers: handlers(apiCurrentUserFixtures.gradStudentUser, {
      upcoming: [upcomingTa],
      recentlyClosed: [closedTa],
      applications: [applicationsFixtures.oneTaApplication],
      applicable: recruitmentsFixtures.threeRecruitments,
    }),
  },
};

/** An admin is not an applicant, so no dashboard at all. */
export const Admin = Template.bind({});
Admin.parameters = {
  msw: { handlers: handlers(apiCurrentUserFixtures.adminUser) },
};
