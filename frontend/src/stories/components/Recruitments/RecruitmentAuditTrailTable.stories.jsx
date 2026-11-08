import React from "react";
import RecruitmentAuditTrailTable from "main/components/Recruitments/RecruitmentAuditTrailTable";
import recruitmentAuditTrailFixtures from "fixtures/recruitmentAuditTrailFixtures";

export default {
  title: "components/Recruitments/RecruitmentAuditTrailTable",
  component: RecruitmentAuditTrailTable,
};

const Template = (args) => <RecruitmentAuditTrailTable {...args} />;

export const Empty = Template.bind({});
Empty.args = { rows: [] };

/** A recruitment that was created and then opened. */
export const ThreeChanges = Template.bind({});
ThreeChanges.args = { rows: recruitmentAuditTrailFixtures.threeRows };

/** Issue #391: a quarter's hiring-target changes, from both recruitments, with the Type column. */
export const HiringTargetsWithType = Template.bind({});
HiringTargetsWithType.args = {
  rows: recruitmentAuditTrailFixtures.hiringTargetRows,
  showType: true,
};
