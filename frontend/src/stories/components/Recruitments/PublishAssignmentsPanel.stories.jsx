import React from "react";
import { HttpResponse, http } from "msw";
import PublishAssignmentsPanel from "main/components/Recruitments/PublishAssignmentsPanel";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const taRecruitment = recruitmentsFixtures.threeRecruitments[2];

export default {
  title: "components/Recruitments/PublishAssignmentsPanel",
  component: PublishAssignmentsPanel,
  parameters: {
    msw: {
      handlers: [
        http.put("/api/admin/recruitments/assignmentsPublished", () =>
          HttpResponse.json({ ...taRecruitment, assignmentsPublished: true }),
        ),
      ],
    },
  },
};

const Template = (args) => <PublishAssignmentsPanel {...args} />;

export const NotPublished = Template.bind({});
NotPublished.args = { recruitment: taRecruitment };

export const Published = Template.bind({});
Published.args = {
  recruitment: { ...taRecruitment, assignmentsPublished: true },
};
