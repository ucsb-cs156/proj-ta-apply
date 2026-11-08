import React from "react";
import { HttpResponse, http } from "msw";
import FakeRankingsModal from "main/components/Recruitments/FakeRankingsModal";
import { NO_APPLICANTS_NOTE } from "main/utils/fakeRankings";

export default {
  title: "components/Recruitments/FakeRankingsModal",
  component: FakeRankingsModal,
  parameters: {
    msw: {
      handlers: [
        http.post("/api/admin/developer/fakeRankings", () =>
          HttpResponse.json({ id: 1, status: "running" }),
        ),
      ],
    },
  },
};

// No router here: the shared decorator in .storybook/preview.jsx already wraps every story in
// one, and react-router refuses a second.
const Template = (args) => (
  <FakeRankingsModal
    recruitmentId={1}
    onHide={() => {}}
    testIdPrefix="Story"
    {...args}
  />
);

/** The form as it opens: every course without rankings, interested candidates only. */
export const Default = Template.bind({});
Default.args = {};

/**
 * The Assignments page's note when the recruitment has no applicants (issue #385): the job would
 * rank nobody.
 */
export const NoApplicants = Template.bind({});
NoApplicants.args = {
  note: NO_APPLICANTS_NOTE,
};
