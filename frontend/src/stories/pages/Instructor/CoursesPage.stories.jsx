import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import CoursesPage from "main/pages/Instructor/CoursesPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Instructor/CoursesPage",
  component: CoursesPage,
  parameters: {
    reactRouter: { initialEntries: ["/recruitments/1/courses"] },
  },
};

// The page reads :recruitmentId from the route.
const Template = () => (
  <Routes>
    <Route
      path="/recruitments/:recruitmentId/courses"
      element={<CoursesPage />}
    />
  </Routes>
);

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.instructorUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
];

/** The admin shows all courses' allocations to all faculty: the five allocation columns are in. */
export const AllocationsShown = Template.bind({});
AllocationsShown.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/instructor/recruitments/1/courses", () =>
        HttpResponse.json(
          instructorRecruitmentsFixtures.coursesWithAllocations,
        ),
      ),
    ],
  },
};

/**
 * Admins only, or faculty see their own courses: the server leaves the allocation figures out and
 * the table has no allocation columns, nor does the Columns menu offer them.
 */
export const AllocationsNotShown = Template.bind({});
AllocationsNotShown.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/instructor/recruitments/1/courses", () =>
        HttpResponse.json(
          instructorRecruitmentsFixtures.coursesWithoutAllocations,
        ),
      ),
    ],
  },
};

/** The recruitment does not exist. */
export const NotFound = Template.bind({});
NotFound.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/instructor/recruitments/1/courses", () =>
        HttpResponse.json(
          { message: "Recruitment with id 1 not found" },
          { status: 404 },
        ),
      ),
    ],
  },
};
