import React from "react";
import SoftOfferResultsTable from "main/components/SoftOffers/SoftOfferResultsTable";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";
import { fundingSourcesFixtures } from "fixtures/fundingSourcesFixtures";
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

/** The hiring columns' data (issue #509): the fixture's records, and a save that only logs. */
const hiring = {
  applicationIds: three.applicationIds,
  records: three.hiring,
  fundingSources: fundingSourcesFixtures.threeSources,
  onChange: (change) => console.log("save", change),
  pending: null,
};

/**
 * The main table (issue #494): every column shown, a late answer, an answer for another lecture
 * (muted), and a row with no answer yet. Drag the handle at the right edge of Comments. When the
 * table is wider than the canvas, scroll it sideways: First name and Last name stay put while the
 * other columns pass under them (issue #510). The Funding dropdown and the eight staff columns
 * (issues #509 and #512) hold controls; a change is logged to the console here, since there is no
 * backend to save it.
 */
export const AssignedUlas = Template.bind({});
AssignedUlas.args = {
  headers: three.headers,
  rows: three.rows,
  columnIds: RESULTS_COLUMN_IDS,
  hiddenColumns: [],
  choices,
  testIdPrefix: "SoftOfferResultsTable",
  hiring,
};

/** The same with the instructor columns hidden, as the Columns menu leaves them. */
export const SomeColumnsHidden = Template.bind({});
SomeColumnsHidden.args = {
  ...AssignedUlas.args,
  hiddenColumns: ["instructor", "instructorEmail", "firstTimeUla"],
};

/** Ada's Formal Offer Accepted is being saved: its box is disabled until the answer comes. */
export const Saving = Template.bind({});
Saving.args = {
  ...AssignedUlas.args,
  hiring: {
    ...hiring,
    pending: {
      applicationId: 12,
      field: "FORMAL_OFFER_ACCEPTED",
      value: "false",
    },
  },
};

/** The second table: answers from applicants no longer assigned, with its own column. */
export const Unassigned = Template.bind({});
Unassigned.args = {
  ...AssignedUlas.args,
  headers: three.unassignedHeaders,
  rows: three.unassigned,
  columnIds: UNASSIGNED_COLUMN_IDS,
  hiring: undefined,
};

/** Nobody assigned: the headings alone. */
export const Empty = Template.bind({});
Empty.args = {
  ...AssignedUlas.args,
  rows: empty.rows,
  hiring: { ...hiring, applicationIds: [], records: {} },
};
