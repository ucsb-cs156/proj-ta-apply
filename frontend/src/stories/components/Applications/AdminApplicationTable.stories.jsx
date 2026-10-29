import React from "react";
import AdminApplicationTable from "main/components/Applications/AdminApplicationTable";
import applicationsFixtures from "fixtures/applicationsFixtures";

export default {
  title: "components/Applications/AdminApplicationTable",
  component: AdminApplicationTable,
};

const Template = (args) => <AdminApplicationTable {...args} />;

export const Empty = Template.bind({});
Empty.args = { applications: [], type: "TA" };

/** A TA round: the Level column, and a test application marked beside its id. */
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
  ],
  type: "TA",
};

/** A ULA round: Expected Graduation instead of Level. */
export const UlaApplications = Template.bind({});
UlaApplications.args = {
  applications: [applicationsFixtures.oneUlaApplication],
  type: "ULA",
};
