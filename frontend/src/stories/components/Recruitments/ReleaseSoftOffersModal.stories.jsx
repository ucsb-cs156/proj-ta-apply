import React from "react";
import { HttpResponse, http } from "msw";
import { fn } from "storybook/test";
import ReleaseSoftOffersModal from "main/components/Recruitments/ReleaseSoftOffersModal";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import softOfferNoticeFixtures from "fixtures/softOfferNoticeFixtures";

const release = http.put("/api/admin/recruitments/softOffers", () =>
  HttpResponse.json(recruitmentsFixtures.releasedUla),
);

export default {
  title: "components/Recruitments/ReleaseSoftOffersModal",
  component: ReleaseSoftOffersModal,
  args: {
    recruitment: recruitmentsFixtures.publishedUla,
    show: true,
    onHide: fn(),
  },
};

const Template = (args) => <ReleaseSoftOffersModal {...args} />;

/** Soft Offer Notices text is saved and nothing has been reopened: no warnings. */
export const Default = Template.bind({});
Default.parameters = {
  msw: {
    handlers: [
      release,
      http.get("/api/softOfferNotices/current", () =>
        HttpResponse.json([softOfferNoticeFixtures.v2]),
      ),
    ],
  },
};

/** No notice text saved yet, and faculty ranking reopened: both warnings in red. */
export const WithWarnings = Template.bind({});
WithWarnings.args = {
  recruitment: { ...recruitmentsFixtures.publishedUla, reviewStatus: "Open" },
};
WithWarnings.parameters = {
  msw: {
    handlers: [
      release,
      http.get("/api/softOfferNotices/current", () => HttpResponse.json([])),
    ],
  },
};

/** The backend refuses (here: hiring decisions were taken back meanwhile). */
export const Refused = Template.bind({});
Refused.parameters = {
  msw: {
    handlers: [
      http.put("/api/admin/recruitments/softOffers", () =>
        HttpResponse.json(
          { message: "Release hiring decisions before releasing soft offers." },
          { status: 400 },
        ),
      ),
      http.get("/api/softOfferNotices/current", () =>
        HttpResponse.json([softOfferNoticeFixtures.v2]),
      ),
    ],
  },
};
