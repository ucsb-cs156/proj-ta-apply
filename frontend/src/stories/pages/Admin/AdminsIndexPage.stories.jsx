import React from "react";
import { HttpResponse, http } from "msw";
import AdminsIndexPage from "main/pages/Admin/AdminsIndexPage";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/AdminsIndexPage",
  component: AdminsIndexPage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.get("/api/admin/all", () =>
          HttpResponse.json(
            roleEmailFixtures.threeItemsWithIsInAdminEmailField,
          ),
        ),
        http.delete("/api/admin/delete", () =>
          HttpResponse.json({ message: "Admin deleted" }),
        ),
      ],
    },
  },
};

const Template = () => <AdminsIndexPage />;

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
      http.get("/api/admin/all", () => HttpResponse.json([])),
    ],
  },
};
