import React from "react";
import { HttpResponse, http } from "msw";
import HiringTargetPanel from "main/components/Recruitments/HiringTargetPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/Recruitments/HiringTargetPanel",
  component: HiringTargetPanel,
  parameters: {
    msw: {
      handlers: [
        http.put("/api/admin/recruitments/totalHiringTarget", () =>
          HttpResponse.json({}),
        ),
      ],
    },
  },
};

const Template = (args) => <HiringTargetPanel {...args} />;

/** A TA recruitment expecting 10, with 4 allocated so far. */
export const SomeLeft = Template.bind({});
SomeLeft.args = {
  recruitment: recruitmentsFixtures.threeRecruitments[2],
  allocatedSoFar: 4,
};

/** A ULA recruitment whose allocations add up exactly. */
export const ExactlyAllocated = Template.bind({});
ExactlyAllocated.args = {
  recruitment: recruitmentsFixtures.threeRecruitments[1],
  allocatedSoFar: 6,
};

/** More allocated than the target: the warning appears. */
export const OverAllocated = Template.bind({});
OverAllocated.args = {
  recruitment: recruitmentsFixtures.threeRecruitments[2],
  allocatedSoFar: 13,
};
