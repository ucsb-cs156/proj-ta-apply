import React from "react";
import AuditTrailTable from "main/components/AuditTrail/AuditTrailTable";
import auditTrailFixtures from "fixtures/auditTrailFixtures";

export default {
  title: "components/AuditTrail/AuditTrailTable",
  component: AuditTrailTable,
};

const Template = (args) => <AuditTrailTable {...args} />;

export const Empty = Template.bind({});
Empty.args = { rows: [] };

/** A short value, a JSON row added (long, with [See value]), and a long comment blanked. */
export const ThreeRows = Template.bind({});
ThreeRows.args = { rows: auditTrailFixtures.threeRows };
