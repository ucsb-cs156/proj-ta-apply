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
        http.put("/api/recruitmentcourses/allocationReleased/all", () =>
          HttpResponse.json([]),
        ),
      ],
    },
  },
};

const Template = (args) => <AllocationVisibilityPanel {...args} />;

/** The default: all allocations hidden, with the per-course release buttons and the switch. */
export const Hidden = Template.bind({});
Hidden.args = {
  recruitment: recruitmentsFixtures.threeRecruitments[2],
};

/** Every allocation shown to every faculty member, with the button to hide them again. */
export const Shown = Template.bind({});
Shown.args = {
  recruitment: {
    ...recruitmentsFixtures.threeRecruitments[2],
    allocationsVisibleToFaculty: true,
  },
};
