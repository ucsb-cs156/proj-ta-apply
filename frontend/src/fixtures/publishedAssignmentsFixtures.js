/** What GET /api/assignments returns once a recruitment's assignments are published (issue #180). */
const publishedAssignmentsFixtures = {
  /** TA recruitment 1, one row per course: two TAs at most in a course. */
  taByCourse: {
    recruitmentId: 1,
    type: "TA",
    layout: "course",
    headers: ["Course", "Instructor", "Instructor email", "TA", "TA"],
    rows: [
      [
        "CMPSC 8",
        "CONRAD P",
        "pconrad@ucsb.edu",
        "Grace Hopper (grace@ucsb.edu)",
        "Ada Lovelace (ada@ucsb.edu)",
      ],
      ["CMPSC 16", "SMITH J", "Not mapped", "Alan Turing (alan@ucsb.edu)", ""],
      ["CMPSC 130A", "", "Not mapped", "", ""],
    ],
  },

  /** The same table while applications or faculty ranking are open again (issue #237). */
  get taByCourseTentative() {
    return { ...this.taByCourse, tentative: true };
  },

  /** TA recruitment 1, one row per TA. */
  taByStudent: {
    recruitmentId: 1,
    type: "TA",
    layout: "student",
    headers: [
      "First name",
      "Last name",
      "Email",
      "Course assignment",
      "Course instructor",
      "Course instructor email",
    ],
    rows: [
      [
        "Grace",
        "Hopper",
        "grace@ucsb.edu",
        "CMPSC 8",
        "CONRAD P",
        "pconrad@ucsb.edu",
      ],
      [
        "Ada",
        "Lovelace",
        "ada@ucsb.edu",
        "CMPSC 8",
        "CONRAD P",
        "pconrad@ucsb.edu",
      ],
      ["Alan", "Turing", "alan@ucsb.edu", "CMPSC 16", "SMITH J", "Not mapped"],
    ],
  },

  /** ULA recruitment 2, one row per ULA, with the first-time column. */
  ulaByStudent: {
    recruitmentId: 2,
    type: "ULA",
    layout: "student",
    headers: [
      "First name",
      "Last name",
      "Email",
      "Course assignment",
      "Course instructor",
      "Course instructor email",
      "First time ULA",
    ],
    rows: [
      [
        "Bob",
        "Brown",
        "bob@ucsb.edu",
        "CMPSC 1A",
        "CONRAD P",
        "pconrad@ucsb.edu",
        "yes",
      ],
      [
        "Zed",
        "Zhang",
        "zed@ucsb.edu",
        "CMPSC 1A",
        "CONRAD P",
        "pconrad@ucsb.edu",
        "no",
      ],
    ],
  },

  /** ULA recruitment 2, one row per course, nobody assigned anywhere. */
  ulaByCourseEmpty: {
    recruitmentId: 2,
    type: "ULA",
    layout: "course",
    headers: ["Course", "Instructor", "Instructor email"],
    rows: [["CMPSC 1A", "CONRAD P", "pconrad@ucsb.edu"]],
  },
};

export default publishedAssignmentsFixtures;
