import React from "react";
import { HttpResponse, http } from "msw";
import HiringStaffCreatePage from "main/pages/Admin/HiringStaffCreatePage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/HiringStaffCreatePage",
  component: HiringStaffCreatePage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.post("/api/admin/hiringStaff/post", () =>
          HttpResponse.json({ email: "finance@ucsb.edu" }),
        ),
      ],
    },
  },
};

// storybook={true} keeps a successful submit from navigating away from the story.
const Template = () => <HiringStaffCreatePage storybook={true} />;

export const Default = Template.bind({});
