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

/** The W26 TA recruitment's assignments are published (issue #180). */
export const OnePublished = Template.bind({});
OnePublished.args = {
  recruitments: recruitmentsFixtures.threeRecruitments.map((r) =>
    r.id === 1 ? { ...r, assignmentsPublished: true } : r,
  ),
  applicationCounts: { 1: 15, 2: 1, 3: 0 },
  onDeleteRequested: () => {},
};

export const ThreeRecruitments = Template.bind({});
ThreeRecruitments.args = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  applicationCounts: { 1: 15, 2: 1, 3: 0 },
  onDeleteRequested: (recruitment) =>
    window.alert(`Delete requested for recruitment ${recruitment.id}`),
};

export const Empty = Template.bind({});
Empty.args = { recruitments: [] };

export const RankingsDownload = Template.bind({});
RankingsDownload.args = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  applicationCounts: { 1: 2, 2: 0, 3: 3 },
};
RankingsDownload.parameters = {
  docs: {
    description: {
      story:
        "Each recruitment has separate application and rankings CSV downloads. Rankings include real unranked applicants and historical course sections; empty recruitments download a header-only file.",
    },
  },
};
