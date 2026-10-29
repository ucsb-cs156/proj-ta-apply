import React from "react";
import { HttpResponse, http } from "msw";
import AuditTrailPage from "main/pages/Admin/AuditTrailPage";
import auditTrailFixtures from "fixtures/auditTrailFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const common = [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
];

export default {
  title: "pages/Admin/AuditTrailPage",
  component: AuditTrailPage,
};

const Template = () => <AuditTrailPage />;

export const ThreeChanges = Template.bind({});
ThreeChanges.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/audittrail/all", () =>
        HttpResponse.json(auditTrailFixtures.firstPage),
      ),
    ],
  },
};

/** Twenty-five changes: three pages, with the paging controls live. */
export const ThreePages = Template.bind({});
ThreePages.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/audittrail/all", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json({
          content: auditTrailFixtures.threeRows.map((row) => ({
            ...row,
            id: row.id + 10 * page,
          })),
          number: page,
          size: 10,
          totalElements: 25,
          totalPages: 3,
        });
      }),
    ],
  },
};

export const NothingYet = Template.bind({});
NothingYet.parameters = {
  msw: {
    handlers: [
      ...common,
      http.get("/api/admin/audittrail/all", () =>
        HttpResponse.json({
          content: [],
          number: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      ),
    ],
  },
};
