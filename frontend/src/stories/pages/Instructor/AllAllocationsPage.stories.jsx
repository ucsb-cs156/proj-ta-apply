import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import AllAllocationsPage from "main/pages/Instructor/AllAllocationsPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Instructor/AllAllocationsPage",
  component: AllAllocationsPage,
  parameters: {
    reactRouter: { initialEntries: ["/recruitments/1/allocations"] },
  },
};

// The page reads :recruitmentId from the route.
const Template = () => (
  <Routes>
    <Route
      path="/recruitments/:recruitmentId/allocations"
      element={<AllAllocationsPage />}
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

/** The admin shows all allocations to all faculty: every course is listed. */
export const Shown = Template.bind({});
Shown.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/instructor/recruitments/1/allocations", () =>
        HttpResponse.json(instructorRecruitmentsFixtures.allAllocations),
      ),
    ],
  },
};

/** The admin has not: instructors get the backend's refusal. */
export const Hidden = Template.bind({});
Hidden.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/instructor/recruitments/1/allocations", () =>
        HttpResponse.json(
          {
            message:
              "The admin has not chosen to show this recruitment's allocations to all faculty.",
          },
          { status: 403 },
        ),
      ),
    ],
  },
};
