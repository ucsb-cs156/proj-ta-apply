import React from "react";
import { HttpResponse, http } from "msw";
import CandidateRankingPage from "main/pages/Instructor/CandidateRankingPage";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import candidatesFixtures from "fixtures/candidatesFixtures";

export default {
  title: "pages/Instructor/CandidateRankingPage",
  component: CandidateRankingPage,
  parameters: {
    reactRouter: {
      initialEntries: ["/recruitments/1/courses/2/ranking"],
    },
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.instructorUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.get(
          "/api/instructor/recruitments/1/courses/2/ranking",
          () =>
            HttpResponse.json(
              instructorRecruitmentsFixtures.candidateRankingPage,
            ),
          http.get("/api/instructor/recruitments/1/courses/2/candidates", () =>
            HttpResponse.json(candidatesFixtures),
          ),
          http.put(
            "/api/instructor/recruitments/1/courses/2/candidates/:id/rank",
            async ({ request }) => HttpResponse.json(await request.json()),
          ),
        ),
      ],
    },
  },
};

const Template = () => <CandidateRankingPage />;

export const Default = Template.bind({});
