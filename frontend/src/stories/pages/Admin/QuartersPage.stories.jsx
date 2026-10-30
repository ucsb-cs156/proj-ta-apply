import React from "react";
import { HttpResponse, http } from "msw";
import QuartersPage from "main/pages/Admin/QuartersPage";
import quartersFixtures from "fixtures/quartersFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/QuartersPage",
  component: QuartersPage,
};

const Template = () => <QuartersPage />;

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
      http.get("/api/admin/quarters/all", ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("direction") === "asc"
            ? quartersFixtures.threeOldestFirst
            : quartersFixtures.threeNewestFirst,
        ),
      ),
      http.post("/api/admin/quarters/refresh", () =>
        HttpResponse.json(quartersFixtures.refresh),
      ),
    ],
  },
};
