import React from "react";
import SoftOfferResultsTable from "main/components/SoftOffers/SoftOfferResultsTable";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import {
  RESULTS_COLUMN_IDS,
  UNASSIGNED_COLUMN_IDS,
  columnChoices,
} from "main/utils/softOfferResultsColumns";

const { three, empty } = softOfferResultsFixtures;
const choices = columnChoices(RESULTS_COLUMN_IDS, three.headers);

export default {
  title: "components/SoftOffers/SoftOfferResultsTable",
  component: SoftOfferResultsTable,
};

const Template = (args) => <SoftOfferResultsTable {...args} />;

/**
 * The main table (issue #494): every column shown, a late answer, an answer for another lecture
 * (muted), and a row with no answer yet. Drag the handle at the right edge of Comments.
 */
export const AssignedUlas = Template.bind({});
AssignedUlas.args = {
  headers: three.headers,
  rows: three.rows,
  columnIds: RESULTS_COLUMN_IDS,
  hiddenColumns: [],
  choices,
  testIdPrefix: "SoftOfferResultsTable",
};

/** The same with the instructor columns hidden, as the Columns menu leaves them. */
export const SomeColumnsHidden = Template.bind({});
SomeColumnsHidden.args = {
  ...AssignedUlas.args,
  hiddenColumns: ["instructor", "instructorEmail", "firstTimeUla"],
};

/** The second table: answers from applicants no longer assigned, with its own column. */
export const Unassigned = Template.bind({});
Unassigned.args = {
  ...AssignedUlas.args,
  headers: three.unassignedHeaders,
  rows: three.unassigned,
  columnIds: UNASSIGNED_COLUMN_IDS,
};

/** Nobody assigned: the headings alone. */
export const Empty = Template.bind({});
Empty.args = {
  ...AssignedUlas.args,
  rows: empty.rows,
};
