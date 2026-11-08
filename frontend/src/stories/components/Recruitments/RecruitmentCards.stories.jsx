import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentCards from "main/components/Recruitments/RecruitmentCards";
import { QUARTER_CARD_STORAGE_PREFIX } from "main/components/Recruitments/AdminQuarterCard";
import { RECRUITMENT_CARD_STORAGE_PREFIX } from "main/components/Recruitments/RecruitmentCardLayout";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { recruitmentStepsHandler } from "../../recruitmentStepsHandlers";

/**
 * Issue #379: the quarter cards and the nested recruitment cards remember whether they are open in
 * localStorage. Each story first forgets what an earlier story left, then remembers what it is
 * about (as if the admin had left the cards that way), so it starts in the state it shows.
 */
const remembering =
  (remembered = {}) =>
  (Story) => {
    Object.keys(localStorage)
      .filter(
        (key) =>
          key.startsWith(QUARTER_CARD_STORAGE_PREFIX) ||
          key.startsWith(RECRUITMENT_CARD_STORAGE_PREFIX),
      )
      .forEach((key) => localStorage.removeItem(key));
    Object.entries(remembered).forEach(([key, value]) =>
      localStorage.setItem(key, value),
    );
    return <Story />;
  };

export default {
  title: "components/Recruitments/RecruitmentCards",
  component: RecruitmentCards,
  decorators: [remembering()],
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

const threeArgs = {
  recruitments: recruitmentsFixtures.threeRecruitments,
  applicationCounts: { 1: 15, 2: 1, 3: 0 },
  onDeleteRequested: (recruitment) =>
    window.alert(`Delete requested for recruitment ${recruitment.id}`),
};

/**
 * The default state (issue #379): one card per quarter, newest first. The newest quarter, S26, is
 * open with its one nested card (TA) open and its diagram expanded; the older quarter, W26, is
 * closed to its row, headed W26 with Budget Planning and "Allocate TA and ULA slots to Courses".
 * Click the W26 row to open it; click a button on the row to navigate without toggling.
 */
export const NewestOpenOlderClosed = Template.bind({});
NewestOpenOlderClosed.args = threeArgs;

/**
 * Every quarter open (as if the admin had opened W26): S26 with its TA card, then W26 with its TA
 * and ULA cards nested, each headed by its type alone. The most recent TA (S26) and ULA (W26)
 * recruitments' diagrams start expanded (issue #233); W26 TA's is collapsed to its summary line.
 */
export const EveryQuarterOpen = Template.bind({});
EveryQuarterOpen.args = threeArgs;
EveryQuarterOpen.decorators = [
  remembering({ [`${QUARTER_CARD_STORAGE_PREFIX}W26`]: "open" }),
];

/**
 * Nested cards closed: W26 is open but both of its recruitment cards are closed to their rows
 * (type, badges, count, trash icon); S26 is closed too. Click a nested row to open just that card.
 */
export const NestedCardsClosed = Template.bind({});
NestedCardsClosed.args = threeArgs;
NestedCardsClosed.decorators = [
  remembering({
    [`${QUARTER_CARD_STORAGE_PREFIX}S26`]: "closed",
    [`${QUARTER_CARD_STORAGE_PREFIX}W26`]: "open",
    [`${RECRUITMENT_CARD_STORAGE_PREFIX}20261.TA`]: "closed",
    [`${RECRUITMENT_CARD_STORAGE_PREFIX}20261.ULA`]: "closed",
  }),
];

/** Every quarter closed: just the quarter rows with their buttons. */
export const EveryQuarterClosed = Template.bind({});
EveryQuarterClosed.args = threeArgs;
EveryQuarterClosed.decorators = [
  remembering({ [`${QUARTER_CARD_STORAGE_PREFIX}S26`]: "closed" }),
];

/** A quarter with one recruitment (S26, TA only): "Allocate TA slots to Courses". */
export const QuarterWithOneRecruitment = Template.bind({});
QuarterWithOneRecruitment.args = {
  ...threeArgs,
  recruitments: recruitmentsFixtures.threeRecruitments.filter(
    (r) => r.id === 3,
  ),
};

/** A quarter with one recruitment, ULA only: "Allocate ULA slots to Courses". */
export const QuarterWithUlaOnly = Template.bind({});
QuarterWithUlaOnly.args = {
  ...threeArgs,
  recruitments: recruitmentsFixtures.threeRecruitments.filter(
    (r) => r.id === 2,
  ),
};

/** A quarter with both recruitments (W26): TA then ULA nested, "Allocate TA and ULA slots to Courses". */
export const QuarterWithTwoRecruitments = Template.bind({});
QuarterWithTwoRecruitments.args = {
  ...threeArgs,
  recruitments: recruitmentsFixtures.threeRecruitments.filter(
    (r) => r.quarter === "20261",
  ),
};

/** The W26 TA recruitment's assignments are published (issue #180): the badge on its nested row. */
export const OnePublished = Template.bind({});
OnePublished.args = {
  ...threeArgs,
  recruitments: recruitmentsFixtures.threeRecruitments.map((r) =>
    r.id === 1 ? { ...r, assignmentsPublished: true } : r,
  ),
  onDeleteRequested: () => {},
};
OnePublished.decorators = [
  remembering({ [`${QUARTER_CARD_STORAGE_PREFIX}W26`]: "open" }),
];

/** No recruitments: the Quarters control and the message. */
export const Empty = Template.bind({});
Empty.args = { recruitments: [] };
