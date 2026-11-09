import React from "react";
import { fn } from "storybook/test";
import AssignmentsTable from "main/components/Assignments/AssignmentsTable";
import assignmentsFixtures from "fixtures/assignmentsFixtures";

export default {
  title: "components/Assignments/AssignmentsTable",
  component: AssignmentsTable,
  args: { onAssign: fn() },
};

const Template = (args) => <AssignmentsTable {...args} />;

/**
 * Issue #415: each lecture column is 100px wide, its heading shows Allocation, Assigned and To
 * Assign in a smaller font, and the cell of the lecture each row is pencilled into (Ada's CMPSC 8,
 * Grace's and Alan's CMPSC 16) has a thick black outline. The cells' colours are classes, not inline
 * styles. CMPSC 24 is no longer offered, so its heading carries the badge.
 */
export const Default = Template.bind({});
Default.args = { data: assignmentsFixtures.taPage };

/**
 * Issue #355 and #415: nine lectures, with two sections each of CMPSC 8 and CMPSC 190DD, so the
 * longest name the page can produce, "190DD (0100)" (12 characters), is on show. It fits on one line
 * in its 100px column because the name is shown at 80% of the heading size.
 */
export const ManyCourses = Template.bind({});
ManyCourses.args = { data: assignmentsFixtures.taPageManyCourses };

/** A ULA recruitment: its own identity columns, and nobody assigned yet, so no cell is outlined. */
export const UlaRecruitment = Template.bind({});
UlaRecruitment.args = { data: assignmentsFixtures.ulaPage };

/** Nothing to show: headings alone. */
export const Empty = Template.bind({});
Empty.args = { data: assignmentsFixtures.empty };
