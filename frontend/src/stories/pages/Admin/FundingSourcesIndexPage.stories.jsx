import React from "react";
import { HttpResponse, http } from "msw";
import FundingSourcesIndexPage from "main/pages/Admin/FundingSourcesIndexPage";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/FundingSourcesIndexPage",
  component: FundingSourcesIndexPage,
  parameters: {
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.get("/api/admin/fundingSources/all", () =>
          HttpResponse.json(fundingSourcesFixtures.threeSources),
        ),
        http.delete("/api/admin/fundingSources/delete", () =>
          HttpResponse.json({ message: "FundingSource with id sub0 deleted" }),
        ),
      ],
    },
  },
};

const Template = () => <FundingSourcesIndexPage />;

export const Default = Template.bind({});

export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      http.get("/api/currentUser", () =>
        HttpResponse.json(apiCurrentUserFixtures.adminUser),
      ),
      http.get("/api/systemInfo", () =>
        HttpResponse.json(systemInfoFixtures.showingNeither),
      ),
      http.get("/api/admin/fundingSources/all", () => HttpResponse.json([])),
    ],
  },
};
