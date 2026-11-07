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

/** One recruitment, as on a recruitment's own Courses page: one box, "Hiring target". */
const Template = ({ courseCount }) => (
  <FakeAllocationsModal
    recruitments={[{ recruitmentId: 1, courseCount }]}
    onHide={() => {}}
    testIdPrefix="Story"
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

/**
 * Both recruitments of a quarter, as on the Combined Allocation page (issue #358): a box for each
 * type's target, sized to its own courses; the estimates and visibility apply to both.
 */
export const TwoRecruitments = () => (
  <FakeAllocationsModal
    recruitments={[
      { recruitmentId: 5, courseCount: 4, type: "TA" },
      { recruitmentId: 6, courseCount: 2, type: "ULA" },
    ]}
    onHide={() => {}}
    testIdPrefix="Story"
  />
);
