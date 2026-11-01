import React from "react";
import CancelledApplicationsTable from "main/components/Applications/CancelledApplicationsTable";
import cancelledApplicationsFixtures from "fixtures/cancelledApplicationsFixtures";

export default {
  title: "components/Applications/CancelledApplicationsTable",
  component: CancelledApplicationsTable,
};

export const ForFaculty = () => (
  <CancelledApplicationsTable
    cancelled={cancelledApplicationsFixtures.two}
    audience="faculty"
  />
);

export const ForAdmins = () => (
  <CancelledApplicationsTable
    cancelled={cancelledApplicationsFixtures.two}
    audience="admin"
  />
);

export const NobodyCancelled = () => (
  <CancelledApplicationsTable
    cancelled={cancelledApplicationsFixtures.none}
    audience="faculty"
  />
);
