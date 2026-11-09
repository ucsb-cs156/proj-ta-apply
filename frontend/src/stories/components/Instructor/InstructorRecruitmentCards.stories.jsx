import React from "react";
import { HttpResponse, http } from "msw";
import InstructorRecruitmentCards from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import instructorFeedbackFixtures from "fixtures/instructorFeedbackFixtures";

/** The feedback form's requests (issue #425): the given rows, the W26 costs, saves stamped now. */
const feedbackHandlers = (rows = []) => [
  http.get("/api/instructor/feedback", () => HttpResponse.json(rows)),
  http.get("/api/instructor/feedback/costs", () =>
    HttpResponse.json(instructorFeedbackFixtures.costs),
  ),
  http.put("/api/instructor/feedback", () =>
    HttpResponse.json({
      ...instructorFeedbackFixtures.filledIn,
      lastUpdated: "2026-11-08T15:00:00",
    }),
  ),
];

export default {
  title: "components/Instructor/InstructorRecruitmentCards",
  component: InstructorRecruitmentCards,
  parameters: { msw: { handlers: feedbackHandlers() } },
};

/** Opens every course's drop-down, so the snapshot shows what is inside. */
const openEveryCourse = async ({ canvas, userEvent }) => {
  for (const button of canvas.getAllByRole("button", { expanded: false })) {
    await userEvent.click(button);
  }
};

const Template = (args) => <InstructorRecruitmentCards {...args} />;

const { nothingReleased, taReleased, ulaReleased, bothReleased } =
  instructorRecruitmentsFixtures.quarters;
const [s26Ta, w26Ta, w26Ula] = nothingReleased;

export const Empty = Template.bind({});
Empty.args = { recruitments: [] };

/** One quarter with one recruitment: each course has a TA card and nothing else (issue #364). */
export const QuarterWithOneRecruitment = Template.bind({});
QuarterWithOneRecruitment.args = { recruitments: [w26Ta] };

/**
 * One quarter with both recruitments (issue #364): CMPSC 156 (0100) is in both, so its item has a
 * TA card and a ULA card; the sectionless 156 lecture is only in the TA recruitment and CMPSC 1A
 * only in the ULA one. This is the case the maintainer is asked to judge for heaviness: the dates
 * and badges of each recruitment repeat in every course that is in it.
 */
export const QuarterWithTwoRecruitments = Template.bind({});
QuarterWithTwoRecruitments.args = { recruitments: [w26Ta, w26Ula] };

/** A course that is in only one of the quarter's two recruitments: one card under the table. */
export const CourseInOneRecruitmentOnly = Template.bind({});
CourseInOneRecruitmentOnly.args = {
  recruitments: [
    { ...w26Ta, courses: [w26Ta.courses[1]] },
    { ...w26Ula, courses: [w26Ula.courses[1]] },
  ],
};

/**
 * Two quarters, newest first; nothing released (issue #410): all six columns, with Enrollment
 * Estimate, TA Allocation and ULA Allocation reading TBD, or N/A on the side a course is not in
 * (the sectionless 156 lecture is TA-only, CMPSC 1A ULA-only, S26 has no ULA recruitment). Each
 * card shows only the two faculty review dates, and the S26 card's not-open note runs the full
 * width.
 */
export const NothingReleased = Template.bind({});
NothingReleased.args = { recruitments: nothingReleased };

/**
 * The TA allocations are released: Enrollment Estimate and TA Allocation are numbers and ULA
 * Allocation is still TBD (or N/A for the TA-only lecture); ULA-only CMPSC 1A stays TBD / N/A /
 * TBD.
 */
export const TaAllocationsReleased = Template.bind({});
TaAllocationsReleased.args = { recruitments: taReleased };

/**
 * The ULA allocations are released: Enrollment Estimate and ULA Allocation are numbers and TA
 * Allocation is still TBD (or N/A for ULA-only CMPSC 1A); the TA-only lecture stays TBD / TBD /
 * N/A.
 */
export const UlaAllocationsReleased = Template.bind({});
UlaAllocationsReleased.args = { recruitments: ulaReleased };

/** Both released: all six columns as numbers for the course in both recruitments. */
export const BothAllocationsReleased = Template.bind({});
BothAllocationsReleased.args = { recruitments: bothReleased };

/**
 * A quarter whose only recruitment has not started faculty reviews (issue #410): the enrollment
 * table's three right-hand cells read TBD, TBD and N/A; the card body holds just Faculty Reviews
 * Opened and Faculty Ranking Deadline (both blank); and the footer's "Candidate rankings will be
 * available when faculty reviews open." note takes the natural width of the footer instead of
 * wrapping at 16rem.
 */
export const ReviewsNotStarted = Template.bind({});
ReviewsNotStarted.args = { recruitments: [s26Ta] };

/** The W26 TA recruitment's assignments are published (issue #180). */
export const WithPublishedAssignments = Template.bind({});
WithPublishedAssignments.args = {
  recruitments: [s26Ta, { ...w26Ta, assignmentsPublished: true }, w26Ula],
};

// ---- Issue #425: the allocation feedback, with every course opened ----

/**
 * Nothing released: W26 has both recruitments, so each of its courses says "When both the initial
 * TA and ULA allocations have been released..."; S26 has a TA recruitment alone and says "When
 * initial TA allocations have been released...".
 */
export const FeedbackWaitingForBoth = Template.bind({});
FeedbackWaitingForBoth.args = { recruitments: nothingReleased };
FeedbackWaitingForBoth.play = openEveryCourse;

/** Only W26's TA allocations are released: its courses still wait for both. */
export const FeedbackWaitingForBothWithTaReleased = Template.bind({});
FeedbackWaitingForBothWithTaReleased.args = {
  recruitments: [taReleased[1], w26Ula],
};
FeedbackWaitingForBothWithTaReleased.play = openEveryCourse;

/** A TA-only quarter whose TA allocations are withheld. */
export const FeedbackWaitingForTa = Template.bind({});
FeedbackWaitingForTa.args = { recruitments: [s26Ta] };
FeedbackWaitingForTa.play = openEveryCourse;

/** A ULA-only quarter whose ULA allocations are withheld. */
export const FeedbackWaitingForUla = Template.bind({});
FeedbackWaitingForUla.args = { recruitments: [w26Ula] };
FeedbackWaitingForUla.play = openEveryCourse;

/**
 * Both W26 allocations released and no feedback yet: every W26 course has the empty form (the TA
 * and the ULA line, no counts, the "at least one" message, Last saved: never) and the closed Notes
 * on TA/ULA tradeoffs.
 */
export const FeedbackFormEmpty = Template.bind({});
FeedbackFormEmpty.args = { recruitments: [taReleased[1], ulaReleased[2]] };
FeedbackFormEmpty.play = openEveryCourse;

/**
 * CMPSC 156 (0100) filled in: both "different number" boxes checked, so both counts show (3 TAs, 2
 * ULAs), other concerns with a comment, and when it was last saved.
 */
export const FeedbackFormFilledIn = Template.bind({});
FeedbackFormFilledIn.args = { recruitments: [taReleased[1], ulaReleased[2]] };
FeedbackFormFilledIn.parameters = {
  msw: { handlers: feedbackHandlers([instructorFeedbackFixtures.filledIn]) },
};
FeedbackFormFilledIn.play = openEveryCourse;

/** A TA-only quarter once released: the form has no ULA line. */
export const FeedbackFormTaOnly = Template.bind({});
FeedbackFormTaOnly.args = {
  recruitments: [{ ...s26Ta, allocationsReleased: true }],
};
FeedbackFormTaOnly.play = openEveryCourse;

/** A ULA-only quarter once released: the form has no TA line. */
export const FeedbackFormUlaOnly = Template.bind({});
FeedbackFormUlaOnly.args = { recruitments: [ulaReleased[2]] };
FeedbackFormUlaOnly.play = openEveryCourse;
