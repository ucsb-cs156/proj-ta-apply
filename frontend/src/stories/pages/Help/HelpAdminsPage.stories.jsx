import React from "react";
import { HttpResponse, http } from "msw";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/HelpAdminsPage",
  component: HelpAdminsPage,
};

const Template = () => <HelpAdminsPage />;

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
