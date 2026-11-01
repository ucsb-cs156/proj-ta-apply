import React from "react";
import { HttpResponse, http } from "msw";
import DeveloperModePage from "main/pages/Admin/DeveloperModePage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/DeveloperModePage",
  component: DeveloperModePage,
};

const Template = () => <DeveloperModePage />;

const handlers = (systemInfo, status) => [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () => HttpResponse.json(systemInfo)),
  http.get("/api/developerMode", () => HttpResponse.json(status)),
  http.put("/api/admin/developerMode", ({ request }) =>
    HttpResponse.json({
      available: true,
      on: new URL(request.url).searchParams.get("on") === "true",
    }),
  ),
];

/** A test instance with the switch available and off. */
export const AvailableAndOff = Template.bind({});
AvailableAndOff.parameters = {
  msw: {
    handlers: handlers(systemInfoFixtures.developerModeAvailable, {
      available: true,
      on: false,
    }),
  },
};

/** The switch is on: the footer shows the red badge. */
export const AvailableAndOn = Template.bind({});
AvailableAndOn.parameters = {
  msw: {
    handlers: handlers(systemInfoFixtures.developerModeAvailable, {
      available: true,
      on: true,
    }),
  },
};

/** Production: the instance was started without the flag, so there is no switch. */
export const NotAvailable = Template.bind({});
NotAvailable.parameters = {
  msw: {
    handlers: handlers(systemInfoFixtures.showingNeither, {
      available: false,
      on: false,
    }),
  },
};
