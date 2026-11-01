import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { recruitmentStepsHandler } from "../../recruitmentStepsHandlers";

export default {
  title: "components/Recruitments/RecruitmentCards",
  component: RecruitmentCards,
  parameters: {
    msw: {
      handlers: [
        recruitmentStepsHandler,
        http.put("/api/admin/recruitments/status", () => HttpResponse.json({})),
        http.put("/api/admin/recruitments/allocationVisibility", () =>
          HttpResponse.json({}),
        ),
        http.put("/api/admin/recruitments/assignmentsPublished", () =>
          HttpResponse.json({}),
        ),
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

/**
 * Each card shows its recruitment's live steps (issue #233). The most recent TA (S26) and ULA (W26)
 * recruitments start expanded; W26 TA starts collapsed to its one-line summary.
 */
export const LiveSteps = Template.bind({});
LiveSteps.args = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  applicationCounts: { 1: 15, 2: 1, 3: 0 },
  onDeleteRequested: () => {},
};
