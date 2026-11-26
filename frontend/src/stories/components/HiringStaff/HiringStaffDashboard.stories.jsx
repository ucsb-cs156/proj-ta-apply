import React from "react";
import HiringStaffDashboard from "main/components/HiringStaff/HiringStaffDashboard";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/HiringStaff/HiringStaffDashboard",
  component: HiringStaffDashboard,
};

const Template = (args) => <HiringStaffDashboard {...args} />;

/** Issue #505: a card per ULA recruitment with soft offers released. */
export const TwoRecruitments = Template.bind({});
TwoRecruitments.args = {
  recruitments: [
    recruitmentsFixtures.releasedUla,
    {
      ...recruitmentsFixtures.releasedUla,
      id: 7,
      quarter: "20244",
      softOffersReleasedAt: "2024-10-01T08:00:00",
      softOfferDeadline: "2024-10-08T17:00:00",
    },
  ],
};

export const NothingReleased = Template.bind({});
NothingReleased.args = { recruitments: [] };
