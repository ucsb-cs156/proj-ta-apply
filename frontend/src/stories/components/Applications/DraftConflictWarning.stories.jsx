import React from "react";
import { http, HttpResponse } from "msw";
import DraftConflictWarning from "main/components/Applications/DraftConflictWarning";
import draftConflictsFixtures from "fixtures/draftConflictsFixtures";

export default {
  title: "components/Applications/DraftConflictWarning",
  component: DraftConflictWarning,
};

const Template = (args) => <DraftConflictWarning {...args} />;

const answering = (conflicts) => ({
  msw: {
    handlers: [
      http.get("/api/admin/applications/draftConflicts", () =>
        HttpResponse.json(conflicts),
      ),
    ],
  },
});

/** Issue #417: two students with both a draft and an application; the ids link to each. */
export const TwoConflicts = Template.bind({});
TwoConflicts.args = { recruitmentId: "1" };
TwoConflicts.parameters = answering(draftConflictsFixtures.two);

/** The example in the issue: one student. */
export const OneConflict = Template.bind({});
OneConflict.args = { recruitmentId: "1" };
OneConflict.parameters = answering(draftConflictsFixtures.one);

/** The normal case: no one has both, so nothing at all is shown. */
export const NoConflicts = Template.bind({});
NoConflicts.args = { recruitmentId: "1" };
NoConflicts.parameters = answering(draftConflictsFixtures.none);
