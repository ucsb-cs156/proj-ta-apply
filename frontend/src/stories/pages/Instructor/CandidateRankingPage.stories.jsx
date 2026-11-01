import React from "react";
import { HttpResponse, http } from "msw";
import CandidateRankingPage from "main/pages/Instructor/CandidateRankingPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import candidatesFixtures, {
  candidatesWithNotInterested,
} from "fixtures/candidatesFixtures";
import cancelledApplicationsFixtures from "fixtures/cancelledApplicationsFixtures";

/** The handlers every story shares; a variant puts its own override in front of them. */
const handlers = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.instructorUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/instructor/recruitments/1/courses/2/ranking", () =>
    HttpResponse.json(instructorRecruitmentsFixtures.candidateRankingPage),
  ),
  // Ticking the box under the table asks for the Not Interested candidates too (issue #199).
  http.get(
    "/api/instructor/recruitments/1/courses/2/candidates",
    ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get("includeNotInterested") === "true"
          ? candidatesWithNotInterested
          : candidatesFixtures,
      ),
  ),
  http.get("/api/instructor/recruitments/1/courses/2/cancelled", () =>
    HttpResponse.json(cancelledApplicationsFixtures.two),
  ),
  http.put(
    "/api/instructor/recruitments/1/courses/2/candidates/:id/rank",
    async ({ request }) => HttpResponse.json(await request.json()),
  ),
];

export default {
  title: "pages/Instructor/CandidateRankingPage",
  component: CandidateRankingPage,
  parameters: {
    reactRouter: {
      initialEntries: ["/recruitments/1/courses/2/ranking"],
    },
    msw: { handlers },
  },
};

const Template = () => <CandidateRankingPage />;

export const Default = Template.bind({});

/** The admin has shown allocations: the page opens with how many TAs the course has (issue #178). */
export const WithAllocation = Template.bind({});
WithAllocation.parameters = {
  msw: {
    handlers: [
      http.get("/api/instructor/recruitments/1/courses/2/ranking", () =>
        HttpResponse.json(
          instructorRecruitmentsFixtures.candidateRankingPageWithAllocation,
        ),
      ),
      ...handlers,
    ],
  },
};

/** Nobody has cancelled: the table at the bottom is replaced by a sentence (issue #199). */
export const NoCancelledApplications = Template.bind({});
NoCancelledApplications.parameters = {
  msw: {
    handlers: [
      http.get("/api/instructor/recruitments/1/courses/2/cancelled", () =>
        HttpResponse.json(cancelledApplicationsFixtures.none),
      ),
      ...handlers,
    ],
  },
};

/** Reviews are open and this user teaches the course: the ranking boxes are editable (issue #202). */
export const Rankable = Template.bind({});
Rankable.parameters = {
  msw: {
    handlers: [
      http.get("/api/instructor/recruitments/1/courses/2/ranking", () =>
        HttpResponse.json({
          ...instructorRecruitmentsFixtures.candidateRankingPage,
          reviewStatus: "Open",
          canRank: true,
        }),
      ),
      ...handlers,
    ],
  },
};
