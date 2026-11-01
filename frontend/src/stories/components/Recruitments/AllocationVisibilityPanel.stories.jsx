import React from "react";
import { HttpResponse, http } from "msw";
import AllocationVisibilityPanel from "main/components/Recruitments/AllocationVisibilityPanel";
import AllocationVisibilityModal from "main/components/Recruitments/AllocationVisibilityModal";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/Recruitments/AllocationVisibilityPanel",
  component: AllocationVisibilityPanel,
  parameters: {
    msw: {
      handlers: [
        http.put("/api/admin/recruitments/allocationVisibility", () =>
          HttpResponse.json({}),
        ),
      ],
    },
  },
};

const Template = (args) => <AllocationVisibilityPanel {...args} />;

/** The default: only admins see the allocations. */
export const AdminsOnly = Template.bind({});
AdminsOnly.args = {
  recruitment: recruitmentsFixtures.threeRecruitments[2],
};

/** Each faculty member sees the allocations for their own courses. */
export const OwnCourses = Template.bind({});
OwnCourses.args = {
  recruitment: {
    ...recruitmentsFixtures.threeRecruitments[2],
    allocationVisibility: "OWN_COURSES",
  },
};

/** Every faculty member teaching in the recruitment sees every course's allocation. */
export const AllCourses = Template.bind({});
AllCourses.args = {
  recruitment: {
    ...recruitmentsFixtures.threeRecruitments[2],
    allocationVisibility: "ALL_COURSES",
  },
};

/** The modal itself, open on the middle state. */
export const ModalOpen = () => (
  <AllocationVisibilityModal
    recruitment={{
      ...recruitmentsFixtures.threeRecruitments[2],
      allocationVisibility: "OWN_COURSES",
    }}
    show={true}
    onHide={() => {}}
  />
);
