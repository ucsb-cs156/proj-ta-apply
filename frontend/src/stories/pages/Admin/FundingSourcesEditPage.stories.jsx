import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import FundingSourcesEditPage from "main/pages/Admin/FundingSourcesEditPage";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/fundingSources/all", () =>
    HttpResponse.json(fundingSourcesFixtures.threeSources),
  ),
  http.put("/api/admin/fundingSources/put", () =>
    HttpResponse.json({
      abbreviation: "sub0",
      explanation: "Temporary Sub Zero funds",
    }),
  ),
];

export default {
  title: "pages/Admin/FundingSourcesEditPage",
  component: FundingSourcesEditPage,
};

/** Rendered under a Route so useParams() sees the abbreviation in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route
      path="/admin/fundingSources/edit/:abbreviation"
      element={<FundingSourcesEditPage storybook={true} />}
    />
  </Routes>
);

const routeTo = (abbreviation) => ({
  initialEntries: [`/admin/fundingSources/edit/${abbreviation}`],
});

/** sub0 from the list: the abbreviation is read-only, only the explanation can change. */
export const Default = Template.bind({});
Default.parameters = {
  reactRouter: routeTo("sub0"),
  msw: { handlers: common },
};

/** An abbreviation that is not in the list. */
export const NoSuchSource = Template.bind({});
NoSuchSource.parameters = {
  reactRouter: routeTo("startup"),
  msw: { handlers: common },
};
