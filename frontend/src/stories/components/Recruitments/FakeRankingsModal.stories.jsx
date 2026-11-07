import React from "react";
import { HttpResponse, http } from "msw";
import FakeRankingsModal from "main/components/Recruitments/FakeRankingsModal";
import { fakeRankingsNote } from "main/utils/fakeRankings";

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
    recruitmentIds={[1]}
    onHide={() => {}}
    testIdPrefix="Story"
    {...args}
  />
);

/** The form as it opens: every course without rankings, interested candidates only. */
export const Default = Template.bind({});
Default.args = {};

/** The Combined Allocation page (issue #358) with both reviews Open: one job per recruitment. */
export const TwoRecruitments = Template.bind({});
TwoRecruitments.args = {
  recruitmentIds: [5, 6],
  note: fakeRankingsNote(["TA", "ULA"], []),
};

/** The Combined Allocation page when only the TA review is Open: the ULA recruitment is left alone. */
export const OnlyOneOpen = Template.bind({});
OnlyOneOpen.args = {
  recruitmentIds: [5],
  note: fakeRankingsNote(["TA"], ["ULA"]),
};
