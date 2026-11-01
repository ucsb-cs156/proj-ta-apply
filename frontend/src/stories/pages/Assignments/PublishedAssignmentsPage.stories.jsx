import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import PublishedAssignmentsPage from "main/pages/Assignments/PublishedAssignmentsPage";
import publishedAssignmentsFixtures from "fixtures/publishedAssignmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Assignments/PublishedAssignmentsPage",
  component: PublishedAssignmentsPage,
};

// The page reads :recruitmentId from the route, so each story sets its own initial entry.
const Template = () => (
  <Routes>
    <Route
      path="/recruitments/:recruitmentId/assignments"
      element={<PublishedAssignmentsPage />}
    />
  </Routes>
);

const common = (user) => [
  http.get("/api/currentUser", () => HttpResponse.json(user)),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
];

const byLayout = (course, student) =>
  http.get("/api/assignments", ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get("layout") === "student"
        ? student
        : course,
    ),
  );

export const TaRecruitmentAsInstructor = Template.bind({});
TaRecruitmentAsInstructor.parameters = {
  reactRouter: { initialEntries: ["/recruitments/1/assignments"] },
  msw: {
    handlers: [
      ...common(apiCurrentUserFixtures.instructorUser),
      byLayout(
        publishedAssignmentsFixtures.taByCourse,
        publishedAssignmentsFixtures.taByStudent,
      ),
    ],
  },
};

export const UlaRecruitmentAsAdmin = Template.bind({});
UlaRecruitmentAsAdmin.parameters = {
  reactRouter: { initialEntries: ["/recruitments/2/assignments"] },
  msw: {
    handlers: [
      ...common(apiCurrentUserFixtures.adminUser),
      byLayout(
        publishedAssignmentsFixtures.ulaByCourseEmpty,
        publishedAssignmentsFixtures.ulaByStudent,
      ),
    ],
  },
};

export const NotPublishedYet = Template.bind({});
NotPublishedYet.parameters = {
  reactRouter: { initialEntries: ["/recruitments/3/assignments"] },
  msw: {
    handlers: [
      ...common(apiCurrentUserFixtures.instructorUser),
      http.get("/api/assignments", () =>
        HttpResponse.json(
          {
            type: "IllegalArgumentException",
            message: "Assignments for recruitment 3 have not been published",
          },
          { status: 400 },
        ),
      ),
    ],
  },
};

/** Applications or faculty ranking were reopened after release: the Tentative note shows. */
export const Tentative = Template.bind({});
Tentative.parameters = {
  reactRouter: { initialEntries: ["/recruitments/1/assignments"] },
  msw: {
    handlers: [
      ...common(apiCurrentUserFixtures.instructorUser),
      byLayout(
        publishedAssignmentsFixtures.taByCourseTentative,
        publishedAssignmentsFixtures.taByStudent,
      ),
    ],
  },
};
