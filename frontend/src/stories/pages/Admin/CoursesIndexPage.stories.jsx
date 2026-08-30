import React from "react";
import { HttpResponse, http } from "msw";
import CoursesIndexPage from "main/pages/Admin/CoursesIndexPage";
import coursesFixtures from "fixtures/coursesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const baseHandlers = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.put("/api/courses/flags", () => HttpResponse.json({})),
  http.post("/api/jobs/launch/populateCourses", () =>
    HttpResponse.json({ id: 1, status: "running" }),
  ),
];

export default {
  title: "pages/Admin/CoursesIndexPage",
  component: CoursesIndexPage,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.get("/api/courses/all", () =>
          HttpResponse.json(coursesFixtures.threeCourses),
        ),
      ],
    },
  },
};

const Template = () => <CoursesIndexPage />;

export const Default = Template.bind({});

// What an admin sees before running Populate for the first time.
export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      ...baseHandlers,
      http.get("/api/courses/all", () => HttpResponse.json([])),
    ],
  },
};
