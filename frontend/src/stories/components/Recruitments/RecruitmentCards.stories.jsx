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
        http.put("/api/admin/recruitments/reviewStatus", () =>
          HttpResponse.json({}),
        ),
        http.put("/api/admin/recruitments/facultyRankingDeadline", () =>
          HttpResponse.json({}),
        ),
      ],
    },
  },
};

const Template = (args) => <RecruitmentCards {...args} />;

export const ThreeRecruitments = Template.bind({});
ThreeRecruitments.args = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  applicationCounts: { 1: 15, 2: 1, 3: 0 },
  onDeleteRequested: (recruitment) =>
    window.alert(`Delete requested for recruitment ${recruitment.id}`),
};

export const Empty = Template.bind({});
Empty.args = { recruitments: [] };
