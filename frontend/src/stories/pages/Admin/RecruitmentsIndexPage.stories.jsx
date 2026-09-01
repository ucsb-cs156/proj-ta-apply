import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentsIndexPage from "main/pages/Admin/RecruitmentsIndexPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const baseHandlers = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.post("/api/admin/recruitments/post", () => HttpResponse.json({ id: 4 })),
  http.put("/api/admin/recruitments/status", () => HttpResponse.json({})),
  http.delete("/api/admin/recruitments/delete", () =>
    HttpResponse.json({ message: "deleted" }),
  ),
];

export default {
  title: "pages/Admin/RecruitmentsIndexPage",
  component: RecruitmentsIndexPage,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.get("/api/admin/recruitments/all", () =>
          HttpResponse.json(recruitmentsFixtures.threeRecruitments),
        ),
      ],
    },
  },
};

const Template = () => <RecruitmentsIndexPage />;

export const Default = Template.bind({});

// What an admin sees before creating the first recruitment.
export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      ...baseHandlers,
      http.get("/api/admin/recruitments/all", () => HttpResponse.json([])),
    ],
  },
};
