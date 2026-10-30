import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

export default {
  title: "components/Recruitments/RecruitmentCards",
  component: RecruitmentCards,
  parameters: {
    msw: {
      handlers: [
        http.put("/api/admin/recruitments/status", () => HttpResponse.json({})),
      ],
    },
  },
};

const Template = (args) => <RecruitmentCards {...args} />;

export const ThreeRecruitments = Template.bind({});
ThreeRecruitments.args = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  onDeleteRequested: (recruitment) =>
    window.alert(`Delete requested for recruitment ${recruitment.id}`),
};

export const Empty = Template.bind({});
Empty.args = { recruitments: [] };
