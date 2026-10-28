const appSettingsFixtures = {
  threeMajors: [
    { name: "Computer Engineering" },
    { name: "Computer Science" },
    { name: "Statistics and Data Science" },
  ],
  twoTopics: [{ name: "Compilers" }, { name: "Web Development" }],
  twoInterests: [{ name: "Grading" }, { name: "Tutoring" }],
  /** What /api/recruitments/options returns for a TA and for a ULA recruitment. */
  taOptions: {
    majors: ["Computer Engineering", "Computer Science", "Statistics"],
    topics: ["Compilers", "Java", "Python", "React"],
    interests: [],
  },
  ulaOptions: {
    majors: ["Computer Science", "Mathematics"],
    topics: ["JavaScript", "React", "Web Development"],
    interests: ["Grading", "Office hours", "Tutoring"],
  },
};

export default appSettingsFixtures;
