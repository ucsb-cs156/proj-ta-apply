import React from "react";
import { HttpResponse, http } from "msw";
import InstructorFeedbackSettingsPage from "main/pages/Admin/InstructorFeedbackSettingsPage";
import instructorFeedbackSettingsFixtures from "fixtures/instructorFeedbackSettingsFixtures";
import quartersFixtures from "fixtures/quartersFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

/** Everything but the history: the user, two quarters with recruitments, W26's calendar and costs. */
const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/budget/quarters", () =>
    HttpResponse.json([
      { quarter: "20261", hasTa: true, hasUla: true },
      { quarter: "20214", hasTa: true, hasUla: false },
    ]),
  ),
  http.get("/api/quarters/one", () =>
    HttpResponse.json({
      ...quartersFixtures.f21,
      quarter: "20261",
      qyy: "W26",
      name: "WINTER 2026",
      firstDayOfClasses: "2026-01-05T00:00:00",
    }),
  ),
  http.get("/api/admin/instructorFeedbackSettings/costs", () =>
    HttpResponse.json({
      quarter: "20261",
      estimatedCostPerTA: 12000,
      estimatedCostPerULA: 2000,
    }),
  ),
  http.post("/api/admin/instructorFeedbackSettings", () =>
    HttpResponse.json({ ...instructorFeedbackSettingsFixtures.v2, id: 3 }),
  ),
];

export default {
  title: "pages/Admin/InstructorFeedbackSettingsPage",
  component: InstructorFeedbackSettingsPage,
};

const Template = () => <InstructorFeedbackSettingsPage />;

/**
 * Issue #429: two versions, the admin's rewrite over the one the app was installed with; the
 * preview is filled in for W26.
 */
export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/instructorFeedbackSettings/all", () =>
        HttpResponse.json(instructorFeedbackSettingsFixtures.history),
      ),
    ],
  },
};

/** Just after deploying: only the version the app was installed with, the notes as they were. */
export const AsInstalled = Template.bind({});
AsInstalled.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/instructorFeedbackSettings/all", () =>
        HttpResponse.json([instructorFeedbackSettingsFixtures.v1]),
      ),
    ],
  },
};
