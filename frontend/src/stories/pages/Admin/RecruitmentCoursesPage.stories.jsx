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
        http.put("/api/admin/recruitments/totalHiringTarget", () =>
          HttpResponse.json({}),
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

/**
 * The view-only page, which is the default (issue #278): nothing on it can be changed. Since issue
 * #358 neither page has the Enrollment Estimate, Allocation, Unrounded Allocation, Delta or ratio
 * columns, nor "Set enrollment estimates from" or Auto assign: it points to the Combined Allocation
 * page for them.
 */
export const Default = Template.bind({});

const EditTemplate = () => <RecruitmentCoursesPage edit />;

/**
 * The edit page, alone: Populate, Add by enroll code, Remove, the allocation visibility panel and
 * the link back to the view-only page. The hiring target is on the Budget page and the Publish
 * Assignments panel on the Assignments page (issue #358).
 */
export const Editing = EditTemplate.bind({});
Editing.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/7/courses/edit"] },
  msw: {
    handlers: [
      ...(Default.parameters?.msw?.handlers ?? []),
      http.post("/api/recruitmentcourses/heartbeat", () =>
        HttpResponse.json({
          others: [],
          heartbeatSeconds: 5,
          newest: true,
          arrivedAtMillis: 1000,
        }),
      ),
    ],
  },
};

/** Another admin has the same edit page open: the banner names them. This is the older tab. */
export const EditingWithAnotherAdmin = EditTemplate.bind({});
EditingWithAnotherAdmin.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/7/courses/edit"] },
  msw: {
    handlers: [
      ...(Default.parameters?.msw?.handlers ?? []),
      http.post("/api/recruitmentcourses/heartbeat", () =>
        HttpResponse.json({
          others: [
            {
              label: "phtcon@ucsb.edu (Phill Conrad)",
              samePerson: false,
              admin: true,
            },
          ],
          heartbeatSeconds: 5,
          newest: false,
          arrivedAtMillis: 1000,
        }),
      ),
    ],
  },
};

/**
 * Another admin had the edit page open first, so this is the later tab: the banner says they
 * "already have" it open and the question covers the page.
 */
export const EditingAsTheLaterTab = EditTemplate.bind({});
EditingAsTheLaterTab.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/7/courses/edit"] },
  msw: {
    handlers: [
      ...(Default.parameters?.msw?.handlers ?? []),
      http.post("/api/recruitmentcourses/heartbeat", () =>
        HttpResponse.json({
          others: [
            {
              label: "phtcon@ucsb.edu (Phill Conrad)",
              samePerson: false,
              admin: true,
            },
          ],
          heartbeatSeconds: 5,
          newest: true,
          arrivedAtMillis: 1000,
        }),
      ),
    ],
  },
};

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
