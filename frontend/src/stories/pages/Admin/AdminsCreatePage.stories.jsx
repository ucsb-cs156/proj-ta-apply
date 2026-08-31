import React from "react";
import { HttpResponse, http } from "msw";
import AdminsCreatePage from "main/pages/Admin/AdminsCreatePage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/AdminsCreatePage",
  component: AdminsCreatePage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.post("/api/admin/post", () =>
          HttpResponse.json({ email: "newadmin@ucsb.edu" }),
        ),
      ],
    },
  },
};

// storybook={true} keeps a successful submit from navigating away from the story.
const Template = () => <AdminsCreatePage storybook={true} />;

export const Default = Template.bind({});
