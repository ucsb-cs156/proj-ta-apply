import React from "react";
import { HttpResponse, http } from "msw";
import AdminAssignmentsPage from "main/pages/Admin/AdminAssignmentsPage";
import assignmentsFixtures from "fixtures/assignmentsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

/** The requests the page makes; `after` is what any change to a dropdown comes back with. */
const handlers = (page, after) => [
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
  http.put("/api/admin/assignments/tentative", () => HttpResponse.json(after)),
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

export const NoApplicants = Template.bind({});
NoApplicants.parameters = {
  reactRouter: { initialEntries: ["/admin/recruitments/7/assignments"] },
  msw: {
    handlers: handlers(assignmentsFixtures.empty, assignmentsFixtures.empty),
  },
};
