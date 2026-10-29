import React from "react";
import { HttpResponse, http } from "msw";
import TaAppSettingsPage from "main/pages/Admin/TaAppSettingsPage";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/notices/all", () =>
    HttpResponse.json(noticesFixtures.taHistory),
  ),
  http.post("/api/admin/notices", () =>
    HttpResponse.json({ ...noticesFixtures.taV2, id: 9 }),
  ),
  http.post("/api/admin/settings/ta-majors/post", () =>
    HttpResponse.json({ name: "Mathematics" }),
  ),
  http.post("/api/admin/settings/ta-topics/post", () =>
    HttpResponse.json({ name: "Databases" }),
  ),
  http.put("/api/admin/settings/ta-majors", () =>
    HttpResponse.json({ name: "Renamed" }),
  ),
  http.put("/api/admin/settings/ta-topics", () =>
    HttpResponse.json({ name: "Renamed" }),
  ),
  http.delete("/api/admin/settings/ta-majors/delete", () =>
    HttpResponse.json({ message: "removed from ta-majors" }),
  ),
  http.delete("/api/admin/settings/ta-topics/delete", () =>
    HttpResponse.json({ message: "removed from ta-topics" }),
  ),
  http.post("/api/admin/settings/ta-majors/upload/csv", () =>
    HttpResponse.json({ inserted: 2, alreadyPresent: 0 }),
  ),
  http.post("/api/admin/settings/ta-topics/upload/csv", () =>
    HttpResponse.json({ inserted: 1, alreadyPresent: 1 }),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(recruitmentsFixtures.threeRecruitments),
  ),
  http.post("/api/admin/applications/legacy/upload", () =>
    HttpResponse.json({
      inserted: 2,
      alreadyPresent: 0,
      skipped: 0,
      problems: [],
      addedTopics: ["Cryptography"],
    }),
  ),
];

export default {
  title: "pages/Admin/TaAppSettingsPage",
  component: TaAppSettingsPage,
};

const Template = () => <TaAppSettingsPage />;

export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/settings/ta-majors/all", () =>
        HttpResponse.json(appSettingsFixtures.threeMajors),
      ),
      http.get("/api/admin/settings/ta-topics/all", () =>
        HttpResponse.json(appSettingsFixtures.twoTopics),
      ),
    ],
  },
};

/** What an admin sees before either list has anything in it. */
export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/settings/ta-majors/all", () =>
        HttpResponse.json([]),
      ),
      http.get("/api/admin/settings/ta-topics/all", () =>
        HttpResponse.json([]),
      ),
    ],
  },
};
