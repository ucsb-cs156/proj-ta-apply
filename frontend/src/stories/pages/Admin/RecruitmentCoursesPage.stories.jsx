import React from "react";
import { HttpResponse, http } from "msw";
import RecruitmentCoursesPage from "main/pages/Admin/RecruitmentCoursesPage";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
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
        http.put("/api/recruitmentcourses/removed", () =>
          HttpResponse.json({}),
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
      ],
    },
  },
};

const Template = () => <RecruitmentCoursesPage />;

export const Default = Template.bind({});
