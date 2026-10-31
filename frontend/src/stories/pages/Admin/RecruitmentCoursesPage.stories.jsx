import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const notRemoved = recruitmentCoursesFixtures.fourCourses.filter(
  (c) => !c.removed,
);

export default {
  title: "pages/Admin/RecruitmentCoursesPage",
  component: RecruitmentCoursesPage,
  parameters: {
    // The page reads :recruitmentId from the route.
    reactRouter: { initialEntries: ["/admin/recruitments/7/courses"] },
    msw: {
      handlers: [
        http.get("/api/currentUser", () =>
          HttpResponse.json(apiCurrentUserFixtures.adminUser),
        ),
        http.get("/api/systemInfo", () =>
          HttpResponse.json(systemInfoFixtures.showingNeither),
        ),
        http.post("/api/recruitmentcourses/post", () =>
          HttpResponse.json(recruitmentCoursesFixtures.oneManual),
        ),
        http.get("/api/admin/recruitments/all", () =>
          HttpResponse.json([
            {
              ...recruitmentsFixtures.threeRecruitments[1],
              id: 7,
              lastPopulatedAt: "2026-02-01T03:00:00",
            },
          ]),
        ),
        http.put("/api/recruitmentcourses/removed", () =>
          HttpResponse.json({}),
        ),
        http.put("/api/recruitmentcourses/allocation", () =>
          HttpResponse.json({}),
        ),
        http.put("/api/admin/recruitments/totalHiringTarget", () =>
          HttpResponse.json({}),
        ),
        http.put("/api/recruitmentcourses/enrollmentEstimate", () =>
          HttpResponse.json({}),
        ),
        http.put("/api/recruitmentcourses/enrollmentEstimates", () =>
          HttpResponse.json(notRemoved),
        ),
        http.post("/api/recruitmentcourses/refresh", () =>
          HttpResponse.json(notRemoved),
        ),
        http.post("/api/jobs/launch/populateRecruitmentCourses", () =>
          HttpResponse.json({ id: 1 }),
        ),
        http.get("/api/recruitmentcourses/all", ({ request }) => {
          const includeRemoved = new URL(request.url).searchParams.get(
            "includeRemoved",
          );
          return HttpResponse.json(
            includeRemoved === "true"
              ? recruitmentCoursesFixtures.fourCourses
              : notRemoved,
          );
        }),
        http.get(
          "/api/instructor/recruitments/7/admin-course-rankings",
          ({ request }) => {
            const includeRemoved = new URL(request.url).searchParams.get(
              "includeRemoved",
            );
            return HttpResponse.json(
              includeRemoved === "true"
                ? recruitmentCoursesFixtures.rankingSummaries
                : recruitmentCoursesFixtures.rankingSummaries.filter(
                    (summary) => summary.recruitmentCourseId !== 4,
                  ),
            );
          },
        ),
      ],
    },
  },
};

const Template = () => <RecruitmentCoursesPage />;

export const Default = Template.bind({});

/** The UCSB API is down: the page says so and shows the stored figures. */
export const RefreshFails = Template.bind({});
RefreshFails.parameters = {
  msw: {
    handlers: [
      ...(Default.parameters?.msw?.handlers ?? []),
      http.post("/api/recruitmentcourses/refresh", () =>
        HttpResponse.json(
          {
            type: "UpstreamApiException",
            message:
              "The UCSB API could not be reached; the stored enrollment figures were kept.",
          },
          { status: 502 },
        ),
      ),
    ],
  },
};
