import React from "react";
import { HttpResponse, http } from "msw";
import FakeAllocationsModal from "main/components/Recruitments/FakeAllocationsModal";

export default {
  title: "components/Recruitments/FakeAllocationsModal",
  component: FakeAllocationsModal,
  parameters: {
    msw: {
      handlers: [
        http.post("/api/admin/developer/fakeAllocations", () =>
          HttpResponse.json([]),
        ),
      ],
    },
  },
};

const Template = (args) => (
  <FakeAllocationsModal
    recruitmentId={1}
    onHide={() => {}}
    testIdPrefix="Story"
    {...args}
  />
);

/** Four courses: the target starts at four, and may go up to twelve (three per course). */
export const FourCourses = Template.bind({});
FourCourses.args = { courseCount: 4 };

/** One course: the target starts at one, and may go up to three. */
export const OneCourse = Template.bind({});
OneCourse.args = { courseCount: 1 };

/** No courses: there is nothing to allocate to, so the target is flagged and Fake is disabled. */
export const NoCourses = Template.bind({});
NoCourses.args = { courseCount: 0 };
