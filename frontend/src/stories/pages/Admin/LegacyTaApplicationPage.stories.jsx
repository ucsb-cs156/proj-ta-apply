import React from "react";
import { HttpResponse, http } from "msw";
import LegacyTaApplicationPage from "main/pages/Admin/LegacyTaApplicationPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/LegacyTaApplicationPage",
  component: LegacyTaApplicationPage,
  parameters: {
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
  },
};

const Template = () => <LegacyTaApplicationPage />;

export const Default = Template.bind({});
