/** Drafts (issue #270): applications as they are being filled in. */

/** What opening the form makes the first time: nothing but who and which recruitment. */
const emptyUlaDraft = {
  id: 21,
  recruitmentId: 2,
  email: "ula@ucsb.edu",
  updatedAt: "2026-01-10T09:00:00",
  version: 0,
  noticeVersionId: null,
  firstName: null,
  middleName: null,
  lastName: null,
  major: null,
  gpaMajor: null,
  gpaOverall: null,
  firstQuarter: false,
  yearInProgram: null,
  graduationDate: null,
  prevExperience: null,
  comments: null,
  firstChoiceCourse: null,
  secondChoiceCourse: null,
  availableForLecturesFirstChoice: null,
  availableForLecturesSecondChoice: null,
  availableForDiscussionFirstChoice: null,
  availableForDiscussionSecondChoice: null,
  availabilityCommentsFirstChoice: null,
  availabilityCommentsSecondChoice: null,
  courseInterests: {},
  topicProficiencies: {},
  interests: {},
  priorCoursework: [],
  residencyStatus: null,
  languageExam: null,
  languageExamDatePassed: null,
  classLevel: null,
  videoLink: null,
  previousServiceAsUla: null,
  permNumber: null,
  bsMsStudent: null,
  studentStatusNextQuarter: null,
  wantsTaEligibility: null,
  otherCampusJob: null,
  priorUcsbEmployment: null,
  employeeId: null,
  i9Appointment: null,
  trainingCommitment: null,
  trainingCommitmentExplanation: null,
  changingMajor: null,
};

/** A draft the form has saved: a name and a few answers, nowhere near complete. */
const savedUlaDraft = {
  ...emptyUlaDraft,
  updatedAt: "2026-01-11T10:30:00",
  version: 4,
  firstName: "Dana",
  middleName: "",
  lastName: "Draft",
  major: "Computer Science",
  gpaMajor: 3.4,
  comments: "Saved before I finished",
  availableForLecturesFirstChoice: false,
  availableForLecturesSecondChoice: false,
  availableForDiscussionFirstChoice: false,
  availableForDiscussionSecondChoice: false,
};

/** Issue #296: how an admin sees them, with their own comments (null until they write some). */
const adminEmptyUlaDraft = { ...emptyUlaDraft, adminComments: null };
const adminSavedUlaDraft = {
  ...savedUlaDraft,
  adminComments: "Ask about the video link",
};

/** A TA draft (recruitment 1 is the TA round), saved with a name, a first quarter marker and a level. */
const adminSavedTaDraft = {
  ...emptyUlaDraft,
  id: 22,
  recruitmentId: 1,
  email: "ta@ucsb.edu",
  updatedAt: "2026-01-12T08:15:00",
  version: 2,
  firstName: "Tess",
  middleName: "A",
  lastName: "Ative",
  major: "Statistics",
  firstQuarter: true,
  classLevel: "MS",
  firstChoiceCourse: "CMPSC   156",
  adminComments: null,
};

const draftApplicationsFixtures = {
  emptyUlaDraft,
  savedUlaDraft,
  adminEmptyUlaDraft,
  adminSavedUlaDraft,
  adminSavedTaDraft,
};

export default draftApplicationsFixtures;
