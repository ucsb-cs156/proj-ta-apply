import { http, HttpResponse } from "msw";
import CandidateApplicationPage from "main/pages/Instructor/CandidateApplicationPage";
import candidateApplicationsFixtures from "fixtures/candidateApplicationsFixtures";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Instructor/CandidateApplicationPage",
  component: CandidateApplicationPage,
  parameters: {
    reactRouter: {
      initialEntries: ["/recruitments/1/courses/2/applications/1"],
    },
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.instructorUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.get("/api/instructor/recruitments/1/courses/2/ranking", () =>
          HttpResponse.json(
            instructorRecruitmentsFixtures.candidateRankingPage,
          ),
        ),
        http.get("/api/instructor/recruitments/1/courses/2/candidates/1", () =>
          HttpResponse.json(candidateApplicationsFixtures.ta),
        ),
        http.get(
          "/api/quarters/one",
          () => new HttpResponse(null, { status: 404 }),
        ),
        http.get("/api/notices", () => HttpResponse.json(null)),
      ],
    },
  },
};

export const Default = {};
