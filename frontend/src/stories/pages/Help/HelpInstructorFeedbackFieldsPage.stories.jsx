import React from "react";
import { HttpResponse, http } from "msw";
import HelpInstructorFeedbackFieldsPage from "main/pages/Help/HelpInstructorFeedbackFieldsPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/HelpInstructorFeedbackFieldsPage",
  component: HelpInstructorFeedbackFieldsPage,
};

const Template = () => <HelpInstructorFeedbackFieldsPage />;

export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      http.get("/api/currentUser", () =>
        HttpResponse.json(apiCurrentUserFixtures.adminUser),
      ),
      http.get("/api/systemInfo", () =>
        HttpResponse.json(systemInfoFixtures.showingNeither),
      ),
    ],
  },
};
