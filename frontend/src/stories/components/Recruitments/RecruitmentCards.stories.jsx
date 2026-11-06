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

/** Issue #357: a QXX Budget card sits above each quarter's recruitments (here S26, then W26 with both). */
export const BudgetCardsTwoQuarters = Template.bind({});
BudgetCardsTwoQuarters.args = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  applicationCounts: { 1: 15, 2: 1, 3: 0 },
  onDeleteRequested: () => {},
};

/** A quarter with both a TA and a ULA recruitment: all three budget buttons are live. */
export const BudgetCardBoth = Template.bind({});
BudgetCardBoth.args = {
  recruitments: recruitmentsFixtures.threeRecruitments.filter(
    (r) => r.quarter === "20261",
  ),
  onDeleteRequested: () => {},
};

/** TA recruitment only: the ULA allocations button is greyed out. */
export const BudgetCardTaOnly = Template.bind({});
BudgetCardTaOnly.args = {
  recruitments: recruitmentsFixtures.threeRecruitments.filter(
    (r) => r.id === 3,
  ),
  onDeleteRequested: () => {},
};

/** ULA recruitment only: the TA allocations button is greyed out. */
export const BudgetCardUlaOnly = Template.bind({});
BudgetCardUlaOnly.args = {
  recruitments: recruitmentsFixtures.threeRecruitments.filter(
    (r) => r.id === 2,
  ),
  onDeleteRequested: () => {},
};
