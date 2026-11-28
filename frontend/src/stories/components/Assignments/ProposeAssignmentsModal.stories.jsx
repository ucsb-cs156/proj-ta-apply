import React from "react";
import { HttpResponse, http } from "msw";
import ProposeAssignmentsModal from "main/components/Assignments/ProposeAssignmentsModal";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
import autoAssignFixtures from "fixtures/autoAssignFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

/** Recruitment 7 with its ranking deadline long past, and not published: no warnings. */
const settled = {
  ...recruitmentsFixtures.threeRecruitments[0],
  id: 7,
  facultyRankingDeadline: "2000-01-01",
  assignmentsPublished: false,
};

/** The modal's three requests: the preview on opening, Proceed, and Undo this run. */
const handlers = (preview, applied, page) => [
  http.get("/api/admin/assignments/auto/preview", () =>
    HttpResponse.json(preview),
  ),
  http.post("/api/admin/assignments/auto/apply", () =>
    HttpResponse.json(applied),
  ),
  http.post("/api/admin/assignments/auto/undo", () =>
    HttpResponse.json({ assignments: page, cleared: applied.made.length }),
  ),
];

export default {
  title: "components/Assignments/ProposeAssignmentsModal",
  component: ProposeAssignmentsModal,
  parameters: {
    msw: {
      handlers: handlers(
        autoAssignFixtures.storyPreview,
        {
          assignments: autoAssignFixtures.storyPage,
          made: autoAssignFixtures.storyPreview.made,
          notMade: [],
        },
        autoAssignFixtures.storyPage,
      ),
    },
  },
};

const Template = (args) => (
  <ProposeAssignmentsModal
    recruitmentId={7}
    page={autoAssignFixtures.storyPage}
    recruitment={settled}
    headers={{}}
    onUpdated={() => {}}
    onError={() => {}}
    onHide={() => {}}
    testIdPrefix="Story"
    {...args}
  />
);

/**
 * A mixed plan on a TA recruitment: four proposals over three passes (the Pass column shows which
 * later ones depended on earlier ones), every box checked, and a lecture left unfilled for every
 * reason there is: a tie, a top candidate who is only Would Consider, two lectures that both rank
 * the same candidate, no rankings yet, every ranked candidate already assigned, an MS student at
 * the top, and a PhD student in another major at the top. Uncheck rows, sort the columns, and
 * Proceed to see the final step with Undo this run.
 */
export const MixedPlan = Template.bind({});

/** A ULA recruitment: no Class Level or Major columns, since the PhD rule does not apply. */
export const UlaRecruitment = Template.bind({});
UlaRecruitment.args = {
  page: { ...autoAssignFixtures.storyPage, type: "ULA" },
};

/**
 * The warnings: no ranking deadline set, assignments already published, and a lecture with places
 * to fill that nobody has ranked anyone for (CMPSC 180).
 */
export const WithWarnings = Template.bind({});
WithWarnings.args = {
  recruitment: {
    ...settled,
    facultyRankingDeadline: null,
    assignmentsPublished: true,
  },
};

/**
 * Nothing can be proposed: the line says so, Proceed is disabled, and the Not proposed table
 * still explains each lecture (the two reasons of issue #488 among them).
 */
export const NothingToPropose = Template.bind({});
NothingToPropose.parameters = {
  msw: {
    handlers: handlers(
      { ...autoAssignFixtures.storyPreview, made: [] },
      { assignments: autoAssignFixtures.storyPage, made: [], notMade: [] },
      autoAssignFixtures.storyPage,
    ),
  },
};

/**
 * The final step after Proceed, when some of the checked proposals could no longer be made
 * (another admin acted meanwhile): click Proceed to see the count, the three reasons, and Undo
 * this run for the one that was made.
 */
export const ProceedWithSomeNotMade = Template.bind({});
ProceedWithSomeNotMade.args = {
  page: assignmentsFixtures.taPage,
};
ProceedWithSomeNotMade.parameters = {
  msw: {
    handlers: handlers(
      autoAssignFixtures.preview,
      autoAssignFixtures.appliedPartly,
      assignmentsFixtures.taPage,
    ),
  },
};

/** The preview is still being worked out: the spinner line. */
export const Loading = Template.bind({});
Loading.parameters = {
  msw: {
    handlers: [
      http.get(
        "/api/admin/assignments/auto/preview",
        () => new Promise(() => {}),
      ),
    ],
  },
};
