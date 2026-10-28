import React from "react";
import { HttpResponse, http } from "msw";
import UlaAppSettingsPage from "main/pages/Admin/UlaAppSettingsPage";
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
  http.post("/api/admin/settings/ula-majors/post", () =>
    HttpResponse.json({ name: "Mathematics" }),
  ),
  http.post("/api/admin/settings/ula-topics/post", () =>
    HttpResponse.json({ name: "Databases" }),
  ),
  http.put("/api/admin/settings/ula-majors", () =>
    HttpResponse.json({ name: "Renamed" }),
  ),
  http.put("/api/admin/settings/ula-topics", () =>
    HttpResponse.json({ name: "Renamed" }),
  ),
  http.delete("/api/admin/settings/ula-majors/delete", () =>
    HttpResponse.json({ message: "removed from ula-majors" }),
  ),
  http.delete("/api/admin/settings/ula-topics/delete", () =>
    HttpResponse.json({ message: "removed from ula-topics" }),
  ),
];

export default {
  title: "pages/Admin/UlaAppSettingsPage",
  component: UlaAppSettingsPage,
};

const Template = () => <UlaAppSettingsPage />;

export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/settings/ula-majors/all", () =>
        HttpResponse.json(appSettingsFixtures.threeMajors),
      ),
      http.get("/api/admin/settings/ula-topics/all", () =>
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
      http.get("/api/admin/settings/ula-majors/all", () =>
        HttpResponse.json([]),
      ),
      http.get("/api/admin/settings/ula-topics/all", () =>
        HttpResponse.json([]),
      ),
    ],
  },
};
