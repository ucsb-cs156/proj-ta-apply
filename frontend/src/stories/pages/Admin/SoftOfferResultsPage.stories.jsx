import React from "react";
import { HttpResponse, http } from "msw";
import SoftOfferResultsPage from "main/pages/Admin/SoftOfferResultsPage";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
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
  http.get("/api/hiringStaff/recruitments", () =>
    HttpResponse.json([recruitmentsFixtures.releasedUla]),
  ),
  http.put("/api/admin/recruitments/softOffers", () =>
    HttpResponse.json(recruitmentsFixtures.releasedUla),
  ),
  // The Funding dropdown's choices (issue #512).
  http.get("/api/admin/fundingSources/all", () =>
    HttpResponse.json(fundingSourcesFixtures.threeSources),
  ),
  // A save (issue #509) answers with Grace's record as if Formal Offer Sent had been ticked; the
  // results are then re-read, and come back unchanged here, so the table shows the fixture again.
  http.put("/api/admin/softOffers/hiring", () =>
    HttpResponse.json(softOfferResultsFixtures.graceFormalOfferSent),
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

/**
 * Three assigned ULAs with every kind of answer, one answer from an unassigned applicant, and the
 * hiring columns (issues #509 and #512) filled from the fixture's records.
 */
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
