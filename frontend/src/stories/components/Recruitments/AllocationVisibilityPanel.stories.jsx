import React from "react";
import { HttpResponse, http } from "msw";
import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/Recruitments/AllocationVisibilityPanel",
  component: AllocationVisibilityPanel,
  parameters: {
    msw: {
      handlers: [
        http.put("/api/admin/recruitments/allocationsVisibleToFaculty", () =>
          HttpResponse.json({}),
        ),
      ],
    },
  },
};

const Template = (args) => <AllocationVisibilityPanel {...args} />;

/** The default: allocations hidden from faculty, with the button to show them. */
export const Hidden = Template.bind({});
Hidden.args = {
  recruitment: recruitmentsFixtures.threeRecruitments[2],
};

/** Allocations shown to faculty, with the button to hide them again. */
export const Shown = Template.bind({});
Shown.args = {
  recruitment: {
    ...recruitmentsFixtures.threeRecruitments[2],
    allocationsVisibleToFaculty: true,
  },
};
