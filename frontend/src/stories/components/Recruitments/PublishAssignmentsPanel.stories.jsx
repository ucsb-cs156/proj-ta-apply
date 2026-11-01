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

/** Faculty ranking is still open: the modal says so and Yes is disabled (issue #237). */
export const BlockedRankingOpen = Template.bind({});
BlockedRankingOpen.args = {
  recruitment: { ...taRecruitment, reviewStatus: "Open" },
};

/** Ranking is closed but applications are open. */
export const BlockedApplicationsOpen = Template.bind({});
BlockedApplicationsOpen.args = {
  recruitment: {
    ...taRecruitment,
    reviewStatus: "Closed",
    applicationStatus: "OPEN",
  },
};

/** Everything the recruitment shows is closed, but the backend finds nobody assigned. */
export const RefusedNobodyAssigned = Template.bind({});
RefusedNobodyAssigned.args = {
  recruitment: {
    ...taRecruitment,
    reviewStatus: "Closed",
    applicationStatus: "CLOSED",
  },
};
RefusedNobodyAssigned.parameters = {
  msw: {
    handlers: [
      http.put("/api/admin/recruitments/assignmentsPublished", () =>
        HttpResponse.json(
          {
            type: "IllegalArgumentException",
            message:
              "Assign candidates to slots before releasing hiring decisions.",
          },
          { status: 400 },
        ),
      ),
    ],
  },
};
