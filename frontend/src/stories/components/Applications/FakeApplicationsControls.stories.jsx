import React from "react";
import { http, HttpResponse } from "msw";
import FakeApplicationsControls from "main/components/Applications/FakeApplicationsControls";

export default {
  title: "components/Applications/FakeApplicationsControls",
  component: FakeApplicationsControls,
};

const Template = (args) => <FakeApplicationsControls {...args} />;

/** Developer Mode's footer controls for a recruitment with five courses. */
export const Default = Template.bind({});
Default.args = { recruitmentId: "7", courseCount: 5 };
Default.parameters = {
  msw: {
    handlers: [
      http.post("/api/admin/developer/fakeApplications", () =>
        HttpResponse.json({ id: 3, status: "running" }),
      ),
      http.delete("/api/admin/developer/fakeApplications", () =>
        HttpResponse.json({ deleted: 12 }),
      ),
    ],
  },
};

/** With no courses there is nothing to apply to, so Create is disabled. */
export const NoCourses = Template.bind({});
NoCourses.args = { recruitmentId: "7", courseCount: 0 };
