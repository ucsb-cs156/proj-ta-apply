import React from "react";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
import {
  applicationColumnChoices,
  applicationColumns,
  defaultHiddenColumns,
} from "main/utils/applicationColumns";

export default {
  title: "components/Applications/AdminApplicationTable",
  component: AdminApplicationTable,
};

const Template = (args) => <AdminApplicationTable {...args} />;

export const Empty = Template.bind({});
Empty.args = {
  applications: [],
  type: "TA",
  hiddenColumns: defaultHiddenColumns("TA"),
};

/**
 * A TA round with the default columns: Level, a test application marked beside its id, and one
 * the applicant cancelled, marked in red (issue #322).
 */
export const TaApplications = Template.bind({});
TaApplications.args = {
  applications: [
    applicationsFixtures.oneTaApplication,
    {
      ...applicationsFixtures.oneTaApplication,
      id: 4,
      firstName: "Grace",
      lastName: "Hopper",
      classLevel: "MS",
    },
    applicationsFixtures.oneTestApplication,
    applicationsFixtures.oneCancelledTaApplication,
  ],
  type: "TA",
  hiddenColumns: defaultHiddenColumns("TA"),
};

/** A ULA round with the default columns: Expected Graduation instead of Level. */
export const UlaApplications = Template.bind({});
UlaApplications.args = {
  applications: [applicationsFixtures.oneUlaApplication],
  type: "ULA",
  hiddenColumns: defaultHiddenColumns("ULA"),
};

/** Issue #189: every answer on the TA form as a column, when nothing is hidden. */
export const TaEveryColumn = Template.bind({});
TaEveryColumn.args = {
  applications: [
    applicationsFixtures.oneTaApplication,
    applicationsFixtures.oneCancelledApplication,
  ],
  type: "TA",
  hiddenColumns: [],
};

/** Issue #189: every answer on the ULA form as a column, when nothing is hidden. */
export const UlaEveryColumn = Template.bind({});
UlaEveryColumn.args = {
  applications: [
    applicationsFixtures.oneUlaApplication,
    applicationsFixtures.oneCancelledApplication,
  ],
  type: "ULA",
  hiddenColumns: [],
};

/**
 * Issue #296: the same table, shown for drafts. No Edit column, Last saved in place of Submitted,
 * and links to the drafts' own pages; the Admin Comments column shows the admin's comments on each.
 */
export const TaDrafts = Template.bind({});
TaDrafts.args = {
  applications: [
    draftApplicationsFixtures.adminSavedTaDraft,
    {
      ...draftApplicationsFixtures.adminSavedTaDraft,
      id: 23,
      firstName: "Uma",
    },
  ],
  draft: true,
  type: "TA",
  hiddenColumns: defaultHiddenColumns("TA"),
};

/** A ULA draft with every column shown, one saved and one only just opened. */
export const UlaDraftsEveryColumn = Template.bind({});
UlaDraftsEveryColumn.args = {
  applications: [
    draftApplicationsFixtures.adminSavedUlaDraft,
    draftApplicationsFixtures.adminEmptyUlaDraft,
  ],
  draft: true,
  type: "ULA",
};

const TA_WIDE = [
  "courseInterests",
  "topicProficiencies",
  "prevExperience",
  "comments",
  "postApplicationComments",
  "adminComments",
];
const ULA_WIDE = [...TA_WIDE, "interests"];

/** Every column id of the type except the given ones: what to hide to show only those. */
const allBut = (type, shown) =>
  applicationColumns(type)
    .map((c) => c.id)
    .filter((id) => !shown.includes(id));

/**
 * Issue #342: the long text columns (Other Courses of Interest, Topic Proficiencies, Previous
 * Experience, Anything Else, Post-Application Comments, Admin Comments) are 400px wide with a drag
 * handle at the right edge of the heading, here beside the small hide link of issue #314.
 */
export const TaWideColumnsWithHideLinks = Template.bind({});
TaWideColumnsWithHideLinks.args = {
  applications: [applicationsFixtures.oneTaApplication],
  type: "TA",
  hiddenColumns: allBut("TA", TA_WIDE),
  hideLinks: {
    choices: applicationColumnChoices("TA"),
    onHide: () => {},
  },
};

/** Issue #342: the ULA form's wide columns, which also include Interests. */
export const UlaWideColumns = Template.bind({});
UlaWideColumns.args = {
  applications: [applicationsFixtures.oneUlaApplication],
  type: "ULA",
  hiddenColumns: allBut("ULA", ULA_WIDE),
};
