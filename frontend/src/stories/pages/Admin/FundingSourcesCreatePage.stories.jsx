import React from "react";
import { HttpResponse, http } from "msw";
import FundingSourcesCreatePage from "main/pages/Admin/FundingSourcesCreatePage";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/FundingSourcesCreatePage",
  component: FundingSourcesCreatePage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.post("/api/admin/fundingSources/post", () =>
          HttpResponse.json(fundingSourcesFixtures.oneSource),
        ),
      ],
    },
  },
};

// storybook={true} keeps a successful submit from navigating away from the story.
const Template = () => <FundingSourcesCreatePage storybook={true} />;

export const Default = Template.bind({});
