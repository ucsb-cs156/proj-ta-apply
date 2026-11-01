import { HttpResponse, http } from "msw";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

/**
 * The steps each recruitment of recruitmentsFixtures.threeRecruitments shows in Storybook (issue
 * #233): W26 TA (id 1) is past its faculty rankings, W26 ULA (id 2) is taking rankings, and
 * S26 TA (id 3) has only just been created. Any other id gets the fresh recruitment.
 */
const STEPS_BY_ID = {
  1: recruitmentStepsFixtures.rankingsClosed,
  2: { ...recruitmentStepsFixtures.rankingsOpen, type: "ULA" },
  3: recruitmentStepsFixtures.fresh,
};

/** An MSW handler for GET /api/admin/recruitments/:id/steps. */
export const recruitmentStepsHandler = http.get(
  "/api/admin/recruitments/:id/steps",
  ({ params }) =>
    HttpResponse.json({
      ...(STEPS_BY_ID[params.id] ?? recruitmentStepsFixtures.fresh),
      recruitmentId: Number(params.id),
    }),
);
