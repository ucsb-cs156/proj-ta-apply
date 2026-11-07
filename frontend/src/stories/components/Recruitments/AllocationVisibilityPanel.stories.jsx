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

/**
 * A state the backend still has but the modal no longer offers (issue #366): the panel still names
 * it, should an old row hold it.
 */
export const AllCourses = Template.bind({});
AllCourses.args = {
  recruitment: {
    ...recruitmentsFixtures.threeRecruitments[2],
    allocationVisibility: "ALL_COURSES",
  },
};

/** The modal itself, open on the second of its two options (issue #366). */
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
