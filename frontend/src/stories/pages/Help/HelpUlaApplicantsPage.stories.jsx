import React from "react";
import { HttpResponse, http } from "msw";
import HelpUlaApplicantsPage from "main/pages/Help/HelpUlaApplicantsPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/HelpUlaApplicantsPage",
  component: HelpUlaApplicantsPage,
};

const Template = () => <HelpUlaApplicantsPage />;

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
