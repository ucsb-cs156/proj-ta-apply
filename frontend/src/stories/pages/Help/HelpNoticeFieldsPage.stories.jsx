import React from "react";
import { HttpResponse, http } from "msw";
import HelpNoticeFieldsPage from "main/pages/Help/HelpNoticeFieldsPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/HelpNoticeFieldsPage",
  component: HelpNoticeFieldsPage,
};

const Template = () => <HelpNoticeFieldsPage />;

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
