import React from "react";
import { HttpResponse, http } from "msw";
import AdminUsersPage from "main/pages/Admin/AdminUsersPage";
import usersFixtures from "fixtures/usersFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const usersPage = {
  content: usersFixtures.threeUsers,
  number: 0,
  size: 10,
  totalElements: usersFixtures.threeUsers.length,
  totalPages: 1,
};

export default {
  title: "pages/Admin/AdminUsersPage",
  component: AdminUsersPage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.get("/api/admin/users", () => HttpResponse.json(usersPage)),
      ],
    },
  },
};

const Template = () => <AdminUsersPage />;

export const Default = Template.bind({});
