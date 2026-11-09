import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import RecruitmentDraftApplicationsPage from "main/pages/Admin/RecruitmentDraftApplicationsPage";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import draftConflictsFixtures from "fixtures/draftConflictsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { defaultHiddenColumns } from "main/utils/applicationColumns";

const common = [
  http.get("/api/admin/hiddencolumns", ({ request }) =>
    HttpResponse.json(
      defaultHiddenColumns(
        new URL(request.url).searchParams.get("recruitmentId") === "1"
          ? "TA"
          : "ULA",
      ),
    ),
  ),
  http.put("/api/admin/hiddencolumns/all", () => HttpResponse.json([])),
  http.put("/api/admin/hiddencolumns", () => HttpResponse.json([])),
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/recruitments/all", () =>
    HttpResponse.json(recruitmentsFixtures.threeRecruitments),
  ),
  // Issue #417: normally no one has both a draft and an application, so there is no warning.
  http.get("/api/admin/applications/draftConflicts", () =>
    HttpResponse.json(draftConflictsFixtures.none),
  ),
];

export default {
  title: "pages/Admin/RecruitmentDraftApplicationsPage",
  component: RecruitmentDraftApplicationsPage,
};

/** Rendered under a Route so useParams() sees the id in the story's initialEntries. */
const Template = () => (
  <Routes>
    <Route
      path="/admin/recruitments/:recruitmentId/draft-applications"
      element={<RecruitmentDraftApplicationsPage />}
    />
  </Routes>
);

const routeTo = (recruitmentId) => ({
  initialEntries: [`/admin/recruitments/${recruitmentId}/draft-applications`],
});

/**
 * The TA round with id 1: two drafts, so the "Copy emails of draft applicants to clipboard"
 * button (issue #411) is above the Columns chooser; hover it for the tooltip, which names the
 * recruitment's primary consideration date.
 */
export const TaRound = Template.bind({});
TaRound.parameters = {
  reactRouter: routeTo(1),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/draftApplications/all", () =>
        HttpResponse.json([
          draftApplicationsFixtures.adminSavedTaDraft,
          {
            ...draftApplicationsFixtures.adminSavedTaDraft,
            id: 23,
            firstName: "Uma",
            email: "uma@ucsb.edu",
            adminComments: "Asked to apply to both rounds",
          },
        ]),
      ),
    ],
  },
};

/** The ULA round with id 2: one saved draft with an admin comment, one only just opened. */
export const UlaRound = Template.bind({});
UlaRound.parameters = {
  reactRouter: routeTo(2),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/draftApplications/all", () =>
        HttpResponse.json([
          draftApplicationsFixtures.adminSavedUlaDraft,
          draftApplicationsFixtures.adminEmptyUlaDraft,
        ]),
      ),
    ],
  },
};

/** Issue #421: the six availability columns, which only a ULA table has. */
const AVAILABILITY = [
  "availableForLecturesFirstChoice",
  "availableForDiscussionFirstChoice",
  "availabilityCommentsFirstChoice",
  "availableForLecturesSecondChoice",
  "availableForDiscussionSecondChoice",
  "availabilityCommentsSecondChoice",
];

/**
 * Issue #421: the ULA round's drafts with the availability columns shown, holding what the
 * applicant has answered so far. A TA round's drafts never have them.
 */
export const UlaRoundWithAvailability = Template.bind({});
UlaRoundWithAvailability.parameters = {
  reactRouter: routeTo(2),
  msw: {
    handlers: [
      // Ahead of common's, so these are the hidden columns on file.
      http.get("/api/admin/hiddencolumns", () =>
        HttpResponse.json(
          defaultHiddenColumns("ULA").filter(
            (id) => !AVAILABILITY.includes(id),
          ),
        ),
      ),
      ...common,
      http.get("/api/admin/draftApplications/all", () =>
        HttpResponse.json([
          {
            ...draftApplicationsFixtures.adminSavedUlaDraft,
            availableForLecturesFirstChoice: true,
            availableForDiscussionFirstChoice: false,
            availabilityCommentsFirstChoice: "Mornings only.",
          },
          draftApplicationsFixtures.adminEmptyUlaDraft,
        ]),
      ),
    ],
  },
};

/** No one has started an application: the count is 0, and there is no table and no copy-emails button. */
export const NoDrafts = Template.bind({});
NoDrafts.parameters = {
  reactRouter: routeTo(3),
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/draftApplications/all", () => HttpResponse.json([])),
    ],
  },
};

/**
 * Issue #417: two students with both a draft and an application, which should never happen. The
 * warning sits above everything else on the page, with links to each draft and application.
 */
export const DraftConflicts = Template.bind({});
DraftConflicts.parameters = {
  reactRouter: routeTo(1),
  msw: {
    handlers: [
      // Ahead of common's, so this answer is the one given.
      http.get("/api/admin/applications/draftConflicts", () =>
        HttpResponse.json(draftConflictsFixtures.two),
      ),
      ...common,
      http.get("/api/admin/draftApplications/all", () =>
        HttpResponse.json([
          draftApplicationsFixtures.adminSavedTaDraft,
          {
            ...draftApplicationsFixtures.adminSavedTaDraft,
            id: 23,
            firstName: "Uma",
            email: "uma@ucsb.edu",
          },
        ]),
      ),
    ],
  },
};
