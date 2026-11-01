import React from "react";
import { HttpResponse, http } from "msw";
import HelpRecruitmentStepsPage from "main/pages/Help/HelpRecruitmentStepsPage";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Help/HelpRecruitmentStepsPage",
  component: HelpRecruitmentStepsPage,
};

const Template = () => <HelpRecruitmentStepsPage />;

const handlersFor = (apiUser) => ({
  msw: {
    handlers: [
      http.get("/api/currentUser", () => HttpResponse.json(apiUser)),
      http.get("/api/systemInfo", () =>
        HttpResponse.json(systemInfoFixtures.showingNeither),
      ),
    ],
  },
});

/** An admin: every step has a More link into Help → For Admins. */
export const ForAnAdmin = Template.bind({});
ForAnAdmin.parameters = handlersFor(apiCurrentUserFixtures.adminUser);

/** An instructor: the same steps and diagram, without links to admin-only pages. */
export const ForAnInstructor = Template.bind({});
ForAnInstructor.parameters = handlersFor(apiCurrentUserFixtures.instructorUser);
