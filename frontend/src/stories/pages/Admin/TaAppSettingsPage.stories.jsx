import React from "react";
import { HttpResponse, http } from "msw";
import TaAppSettingsPage from "main/pages/Admin/TaAppSettingsPage";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
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
