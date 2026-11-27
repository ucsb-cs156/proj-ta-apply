import React from "react";
import CopySoftOfferEmails from "main/components/SoftOffers/CopySoftOfferEmails";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";

const { three, empty } = softOfferResultsFixtures;

export default {
  title: "components/SoftOffers/CopySoftOfferEmails",
  component: CopySoftOfferEmails,
};

const Template = (args) => <CopySoftOfferEmails {...args} />;

/**
 * Issue #511: three assigned ULAs, one of whom proceeded and none declined, so Responded
 * "Declined" is disabled. Clicking a button copies and toasts.
 */
export const ThreeAssigned = Template.bind({});
ThreeAssigned.args = { rows: three.rows };

/** Nobody assigned: every button is disabled. */
export const NobodyAssigned = Template.bind({});
NobodyAssigned.args = { rows: empty.rows };
