import React from "react";
import ApplicationForm from "main/components/Applications/ApplicationForm";
import applicationsFixtures from "fixtures/applicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import courseInstructorsFixtures from "fixtures/courseInstructorsFixtures";
import coursesFixtures from "fixtures/coursesFixtures";
import { HttpResponse, http } from "msw";

import appSettingsFixtures from "fixtures/appSettingsFixtures";

const courses = ["CMPSC     8", "CMPSC    16", "CMPSC   130A", "CMPSC   156"];
const { majors: taMajors, topics: taTopics } = appSettingsFixtures.taOptions;
const { majors: ulaMajors, topics: ulaTopics } = appSettingsFixtures.ulaOptions;

export default {
  title: "components/Applications/ApplicationForm",
  component: ApplicationForm,
  parameters: {
    // Choosing a course looks up its meeting times; every story answers with the same ones.
    msw: {
      handlers: [
        http.get("/api/recruitments/sections", () =>
          HttpResponse.json(courseSectionsFixtures.cmpsc156),
        ),
        // Add Multiple UCSB CMPSC Courses lists the course table (issue #100).
        http.get("/api/courses/all", () =>
          HttpResponse.json(coursesFixtures.threeCourses),
        ),
      ],
    },
  },
};

const Template = (args) => <ApplicationForm {...args} />;

export const TaApplication = Template.bind({});
TaApplication.args = {
  type: "TA",
  courses,
  // The instructors after the course numbers (issue #121).
  instructors: courseInstructorsFixtures.fourCourses,
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

/** Saving as you go (issue #270): a Save Draft button beside Submit, and a save a few seconds after a change. */
export const SavingADraft = Template.bind({});
SavingADraft.args = {
  type: "TA",
  courses,
  majors: taMajors,
  topics: taTopics,
  submitAction: (payload) => console.log("submit", payload),
  onDraftChange: (payload) => console.log("autosave", payload),
  onSaveDraft: (payload) => console.log("save draft", payload),
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
  recruitmentId: 1,
  majors: taMajors,
  topics: taTopics,
  initialContents: applicationsFixtures.oneTaApplication,
  buttonLabel: "Update Application",
  submitAction: (payload) => console.log("submit", payload),
};

/** Issue #292: a first quarter grad student ticks the box under the GPA fields, which need no values. */
export const TaFirstQuarter = Template.bind({});
TaFirstQuarter.args = {
  type: "TA",
  courses,
  majors: taMajors,
  topics: taTopics,
  initialContents: { firstQuarter: true },
  submitAction: (payload) => console.log("submit", payload),
};

/** Issue #292: the same on the ULA form, with its own wording. */
export const UlaFirstQuarter = Template.bind({});
UlaFirstQuarter.args = {
  type: "ULA",
  courses,
  majors: ulaMajors,
  topics: ulaTopics,
  initialContents: { firstQuarter: true },
  submitAction: (payload) => console.log("submit", payload),
};
