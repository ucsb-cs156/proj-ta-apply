import React from "react";
import { HttpResponse, http } from "msw";
import HelpTaApplicantsPage from "main/pages/Help/HelpTaApplicantsPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/HelpTaApplicantsPage",
  component: HelpTaApplicantsPage,
};

const Template = () => <HelpTaApplicantsPage />;

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
