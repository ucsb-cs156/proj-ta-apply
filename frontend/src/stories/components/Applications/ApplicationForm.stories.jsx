import React from "react";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import applicationsFixtures from "fixtures/applicationsFixtures";

import appSettingsFixtures from "fixtures/appSettingsFixtures";

const courses = ["CMPSC     8", "CMPSC    16", "CMPSC   130A", "CMPSC   156"];
const { majors: taMajors, topics: taTopics } = appSettingsFixtures.taOptions;
const { majors: ulaMajors, topics: ulaTopics } = appSettingsFixtures.ulaOptions;

export default {
  title: "components/Applications/ApplicationForm",
  component: ApplicationForm,
};

const Template = (args) => <ApplicationForm {...args} />;

export const TaApplication = Template.bind({});
TaApplication.args = {
  type: "TA",
  courses,
  majors: taMajors,
  topics: taTopics,
  submitAction: (payload) => console.log("submit", payload),
};

export const UlaApplication = Template.bind({});
UlaApplication.args = {
  type: "ULA",
  courses,
  majors: ulaMajors,
  topics: ulaTopics,
  submitAction: (payload) => console.log("submit", payload),
};

/** With nothing to copy from, the names come from the signed-in Google account. */
export const NamesFromTheGoogleAccount = Template.bind({});
NamesFromTheGoogleAccount.args = {
  type: "ULA",
  courses,
  majors: ulaMajors,
  topics: ulaTopics,
  defaultNames: { firstName: "Chris", lastName: "Gaucho" },
  submitAction: (payload) => console.log("submit", payload),
};

/** What a repeat applicant sees: their previous answers, ready to adjust. */
export const PrefilledFromAPreviousApplication = Template.bind({});
PrefilledFromAPreviousApplication.args = {
  type: "TA",
  courses,
  majors: taMajors,
  topics: taTopics,
  initialContents: applicationsFixtures.oneTaApplication,
  buttonLabel: "Update Application",
  submitAction: (payload) => console.log("submit", payload),
};
