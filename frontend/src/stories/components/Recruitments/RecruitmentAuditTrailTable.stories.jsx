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
