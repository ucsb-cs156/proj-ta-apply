import React from "react";
import { HttpResponse, http } from "msw";
import AdminAssignmentsPage from "main/pages/Admin/AdminAssignmentsPage";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
import cancelledApplicationsFixtures from "fixtures/cancelledApplicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

/** The requests the page makes; `after` is what any change to a dropdown comes back with. */
const handlers = (page, after, others, hidden = []) => [
  http.get("/api/admin/hiddencolumns", () => HttpResponse.json(hidden)),
  http.put("/api/admin/hiddencolumns", () => HttpResponse.json(hidden)),
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json([
      { ...recruitmentsFixtures.threeRecruitments[0], id: 7 },
      recruitmentsFixtures.threeRecruitments[1],
    ]),
  ),
  http.get("/api/admin/assignments", () => HttpResponse.json(page)),
  http.get("/api/admin/assignments/cancelled", () =>
    HttpResponse.json(cancelledApplicationsFixtures.two),
  ),
  http.put("/api/admin/assignments/tentative", () => HttpResponse.json(after)),
  http.post("/api/admin/assignments/heartbeat", () =>
    HttpResponse.json({
      others: others ?? [],
      heartbeatSeconds: 5,
      newest: false,
      arrivedAtMillis: 1000,
    }),
  ),
];

export default {
  title: "pages/Admin/AdminAssignmentsPage",
  component: AdminAssignmentsPage,
  parameters: {
    // The page reads :recruitmentId from the route.
    reactRouter: { initialEntries: ["/admin/recruitments/7/assignments"] },
    msw: {
      // Any change moves Ada from CMPSC 8 to CMPSC 24, so the counts visibly change.
      handlers: handlers(
        assignmentsFixtures.taPage,
        assignmentsFixtures.taPageAfterMove,
      ),
    },
  },
};

const Template = () => <AdminAssignmentsPage />;

export const Default = Template.bind({});

export const UlaRecruitment = Template.bind({});
UlaRecruitment.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/2/assignments"] },
  msw: {
    handlers: handlers(
      assignmentsFixtures.ulaPage,
      assignmentsFixtures.ulaPage,
    ),
  },
};

/**
 * Issue #358: the Publish Assignments panel is at the top of this page. Here the assignments are
 * already published, so the line and its link to the published page show instead of the button.
 */
export const Published = Template.bind({});
Published.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/7/assignments"] },
  msw: {
    handlers: [
      http.get("/api/admin/recruitments/all", () =>
        HttpResponse.json([
          {
            ...recruitmentsFixtures.threeRecruitments[0],
            id: 7,
            assignmentsPublished: true,
          },
        ]),
      ),
      ...handlers(
        assignmentsFixtures.taPage,
        assignmentsFixtures.taPageAfterMove,
      ),
    ],
  },
};

/**
 * Issue #355: nine lectures, with two sections each of CMPSC 8 and CMPSC 190DD. The lecture
 * headings, the Tentative Assignment dropdown and the Columns menu name them "  5A", "  8   (0100)",
 * " 16", "130A", "190DD (0200)": no CMPSC, the digits aligned, the section only where a course has
 * two. Each lecture column is as wide as "190DD (0100)", and so is the dropdown.
 */
export const ManyCourses = Template.bind({});
ManyCourses.parameters = {
  msw: {
    handlers: handlers(
      assignmentsFixtures.taPageManyCourses,
      assignmentsFixtures.taPageManyCourses,
    ),
  },
};

export const NoApplicants = Template.bind({});
NoApplicants.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/7/assignments"] },
  msw: {
    handlers: handlers(assignmentsFixtures.empty, assignmentsFixtures.empty),
  },
};

/** Another admin has the same page open: the banner names them (the older tab sees no modal). */
export const AnotherAdminHasItOpen = Template.bind({});
AnotherAdminHasItOpen.parameters = {
  msw: {
    handlers: handlers(
      assignmentsFixtures.taPage,
      assignmentsFixtures.taPageAfterMove,
      [
        {
          label: "phtcon@ucsb.edu (Phill Conrad)",
          samePerson: false,
          admin: true,
        },
      ],
    ),
  },
};

/**
 * Issue #385: with developer mode on, the footer has Create Fake Rankings (moved here from the
 * Courses edit page). The handlers for a recruitment whose faculty review has the given status.
 */
const developerModeHandlers = (
  reviewStatus,
  page = assignmentsFixtures.taPage,
) => [
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.developerModeAvailable),
  ),
  http.get("/api/developerMode", () =>
    HttpResponse.json({ available: true, on: true }),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json([
      { ...recruitmentsFixtures.threeRecruitments[0], id: 7, reviewStatus },
    ]),
  ),
  http.post("/api/admin/developer/fakeRankings", () =>
    HttpResponse.json({ id: 1, status: "running" }),
  ),
  ...handlers(page, assignmentsFixtures.taPageAfterMove),
];

/** Faculty ranking is Open and there are courses: the button is red and opens the modal. */
export const DeveloperMode = Template.bind({});
DeveloperMode.parameters = {
  msw: { handlers: developerModeHandlers("Open") },
};

/**
 * Faculty ranking is not started: the button is a grey outline, disabled, and hovering over it
 * says to open faculty ranking from the recruitment's card first.
 */
export const DeveloperModeRankingNotOpen = Template.bind({});
DeveloperModeRankingNotOpen.parameters = {
  msw: { handlers: developerModeHandlers("NotStarted") },
};

/** Ranking is Open but the recruitment has no course: the tooltip is about the courses instead. */
export const DeveloperModeNoCourses = Template.bind({});
DeveloperModeNoCourses.parameters = {
  msw: { handlers: developerModeHandlers("Open", assignmentsFixtures.empty) },
};

/** Two applicant columns and a lecture hidden: the Columns button counts them, each can be shown again. */
export const SomeColumnsHidden = Template.bind({});
SomeColumnsHidden.parameters = {
  msw: {
    handlers: handlers(
      assignmentsFixtures.taPage,
      assignmentsFixtures.taPageAfterMove,
      [],
      ["major", "classLevel", "course-20"],
    ),
  },
};
