import React from "react";
import { HttpResponse, http } from "msw";
import HiringStaffIndexPage from "main/pages/Admin/HiringStaffIndexPage";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/HiringStaffIndexPage",
  component: HiringStaffIndexPage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.get("/api/admin/hiringStaff/all", () =>
          HttpResponse.json(roleEmailFixtures.threeItems),
        ),
        http.delete("/api/admin/hiringStaff/delete", () =>
          HttpResponse.json({ message: "Hiring staff deleted" }),
        ),
      ],
    },
  },
};

const Template = () => <HiringStaffIndexPage />;

export const Default = Template.bind({});

export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      http.get("/api/currentUser", () =>
        HttpResponse.json(apiCurrentUserFixtures.adminUser),
      ),
      http.get("/api/systemInfo", () =>
        HttpResponse.json(systemInfoFixtures.showingNeither),
      ),
      http.get("/api/admin/hiringStaff/all", () => HttpResponse.json([])),
    ],
  },
};
