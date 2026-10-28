const priorCourseworkFixtures = {
  ucsbCourse: {
    id: 11,
    ucsbCourse: true,
    otherSchool: null,
    courseNumber: "CMPSC 263",
    courseTitle: "Runtime Systems",
    term: "F25",
    grade: "A",
  },
  inProgress: {
    id: 12,
    ucsbCourse: true,
    otherSchool: null,
    courseNumber: "CMPSC 290A",
    courseTitle: "Compilers Seminar",
    term: "W26",
    grade: "IP",
  },
  elsewhere: {
    id: 13,
    ucsbCourse: false,
    otherSchool: "Another University",
    courseNumber: "CS 143",
    courseTitle: "Compilers",
    term: "Spring 2024",
    grade: "A-",
  },
};

priorCourseworkFixtures.threeCourses = [
  priorCourseworkFixtures.ucsbCourse,
  priorCourseworkFixtures.inProgress,
  priorCourseworkFixtures.elsewhere,
];

export default priorCourseworkFixtures;
