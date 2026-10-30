import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentsDashboard from "main/components/Recruitments/RecruitmentsDashboard";
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
  http.get("/api/admin/recruitments/applicationCounts", () =>
    HttpResponse.json({ 1: 15, 2: 1, 3: 0 }),
  ),
  http.post("/api/admin/recruitments/post", () => HttpResponse.json({ id: 4 })),
  http.put("/api/admin/recruitments/status", () => HttpResponse.json({})),
  http.delete("/api/admin/recruitments/delete", () =>
    HttpResponse.json({ message: "deleted" }),
  ),
];

export default {
  title: "components/Recruitments/RecruitmentsDashboard",
  component: RecruitmentsDashboard,
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

const Template = () => <RecruitmentsDashboard />;

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
