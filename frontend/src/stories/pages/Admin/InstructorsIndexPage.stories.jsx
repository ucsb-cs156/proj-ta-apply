import React from "react";
import { HttpResponse, http } from "msw";
import InstructorsIndexPage from "main/pages/Admin/InstructorsIndexPage";
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
  title: "pages/Admin/InstructorsIndexPage",
  component: InstructorsIndexPage,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.get("/api/admin/instructors/get", () =>
          HttpResponse.json(roleEmailFixtures.threeItems),
        ),
        http.delete("/api/admin/instructors/delete", () =>
          HttpResponse.json({ message: "Deleted" }),
        ),
        http.post("/api/admin/instructors/upload/csv", () =>
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

const Template = () => <InstructorsIndexPage />;

export const Default = Template.bind({});

export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      ...baseHandlers,
      http.get("/api/admin/instructors/get", () => HttpResponse.json([])),
    ],
  },
};
