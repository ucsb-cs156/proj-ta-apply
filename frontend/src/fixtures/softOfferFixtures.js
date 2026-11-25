// GET /api/softOffers/mine (issue #486): the W26 ULA recruitment (id 2), application 2 (Chris
// Gaucho), assigned to CMPSC 156 lecture 0100.
const pending = {
  recruitmentId: 2,
  quarter: "20261",
  applicationId: 2,
  releasedAt: "2026-02-20T09:30:00",
  deadline: "2026-02-25T17:00:00",
  notice: {
    id: 2,
    content:
      "# Congratulations\n\nYou have been recommended for a ULA position for ${quarter}.",
  },
  course: {
    recruitmentCourseId: 10,
    courseNumber: "CMPSC 156",
    section: "0100",
    title: "ADV APP PROGRAM",
    instructor: "CONRAD P",
    instructorEmail: "phtcon@ucsb.edu",
    days: "T R",
    beginTime: "14:00",
    endTime: "15:15",
  },
  sections: [
    { section: "0101", days: "W", beginTime: "09:00", endTime: "09:50" },
    { section: "0102", days: "F", beginTime: "09:00", endTime: "09:50" },
    { section: "0103", days: null, beginTime: null, endTime: null },
  ],
  response: null,
};

const softOfferFixtures = {
  pending,
  /** The UCSB API could not be reached, and no notice text is saved. */
  bare: {
    ...pending,
    notice: null,
    sections: null,
    course: {
      ...pending.course,
      instructor: null,
      instructorEmail: null,
      days: null,
      beginTime: null,
      endTime: null,
    },
  },
  /** A lecture the API lists no sections for. */
  noSections: { ...pending, sections: [] },
  proceeded: {
    ...pending,
    response: {
      decision: "PROCEED",
      comments: "Looking forward to it.",
      respondedAt: "2026-02-21T08:05:00",
    },
  },
  declined: {
    ...pending,
    response: {
      decision: "DECLINE",
      comments: null,
      respondedAt: "2026-02-22T19:45:30",
    },
  },
};

export default softOfferFixtures;
