import React from "react";
import { HttpResponse, http } from "msw";
import SoftOfferResultsPage from "main/pages/Admin/SoftOfferResultsPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json([recruitmentsFixtures.releasedUla]),
  ),
  http.put("/api/admin/recruitments/softOffers", () =>
    HttpResponse.json(recruitmentsFixtures.releasedUla),
  ),
];

export default {
  title: "pages/Admin/SoftOfferResultsPage",
  component: SoftOfferResultsPage,
  parameters: {
    // The page reads :recruitmentId from the route.
    reactRouter: { initialEntries: ["/admin/recruitments/5/softOffers"] },
  },
};

const Template = () => <SoftOfferResultsPage />;

/** Three assigned ULAs with every kind of answer, and one answer from an unassigned applicant. */
export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/softOffers", () =>
        HttpResponse.json(softOfferResultsFixtures.three),
      ),
    ],
  },
};

export const Empty = Template.bind({});
Empty.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/softOffers", () =>
        HttpResponse.json(softOfferResultsFixtures.empty),
      ),
    ],
  },
};

/** Opened for a recruitment whose soft offers are not released: the backend's refusal. */
export const NotReleased = Template.bind({});
NotReleased.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/softOffers", () =>
        HttpResponse.json(
          {
            message: "Soft offers have not been released for this recruitment.",
          },
          { status: 400 },
        ),
      ),
    ],
  },
};
