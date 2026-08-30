import React from "react";
import { HttpResponse, http } from "msw";
import GradStudentsCreatePage from "main/pages/Admin/GradStudentsCreatePage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/GradStudentsCreatePage",
  component: GradStudentsCreatePage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.post("/api/admin/gradstudents/post", () =>
          HttpResponse.json({ email: "newgrad@ucsb.edu" }),
        ),
      ],
    },
  },
};

// storybook={true} keeps a successful submit from navigating away from the story.
const Template = () => <GradStudentsCreatePage storybook={true} />;

export const Default = Template.bind({});
