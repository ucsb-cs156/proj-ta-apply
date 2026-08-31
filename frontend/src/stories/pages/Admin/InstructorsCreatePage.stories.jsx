import React from "react";
import { HttpResponse, http } from "msw";
import InstructorsCreatePage from "main/pages/Admin/InstructorsCreatePage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/InstructorsCreatePage",
  component: InstructorsCreatePage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.post("/api/admin/instructors/post", () =>
          HttpResponse.json({ email: "newinstructor@ucsb.edu" }),
        ),
      ],
    },
  },
};

// storybook={true} keeps a successful submit from navigating away from the story.
const Template = () => <InstructorsCreatePage storybook={true} />;

export const Default = Template.bind({});
