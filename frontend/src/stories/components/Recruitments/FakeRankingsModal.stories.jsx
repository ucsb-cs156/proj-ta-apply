import React from "react";
import { MemoryRouter } from "react-router";
import { HttpResponse, http } from "msw";
import FakeRankingsModal from "main/components/Recruitments/FakeRankingsModal";

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

const Template = (args) => (
  <MemoryRouter>
    <FakeRankingsModal
      recruitmentId={1}
      onHide={() => {}}
      testIdPrefix="Story"
      {...args}
    />
  </MemoryRouter>
);

/** The form as it opens: every course without rankings, interested candidates only. */
export const Default = Template.bind({});
Default.args = {};
