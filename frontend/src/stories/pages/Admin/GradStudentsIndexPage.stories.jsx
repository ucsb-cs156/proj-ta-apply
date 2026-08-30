import React from "react";
import { HttpResponse, http } from "msw";
import GradStudentsIndexPage from "main/pages/Admin/GradStudentsIndexPage";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const baseHandlers = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
];

export default {
  title: "pages/Admin/GradStudentsIndexPage",
  component: GradStudentsIndexPage,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.get("/api/admin/gradstudents/get", () =>
          HttpResponse.json(roleEmailFixtures.threeItems),
        ),
        http.delete("/api/admin/gradstudents/delete", () =>
          HttpResponse.json({ message: "Deleted" }),
        ),
        http.post("/api/admin/gradstudents/upload/csv", () =>
          HttpResponse.json({
            inserted: 2,
            alreadyPresent: 1,
            invalid: 0,
            invalidEmails: [],
          }),
        ),
      ],
    },
  },
};

const Template = () => <GradStudentsIndexPage />;

export const Default = Template.bind({});

export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      ...baseHandlers,
      http.get("/api/admin/gradstudents/get", () => HttpResponse.json([])),
    ],
  },
};
