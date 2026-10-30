const roleEmailFixtures = {
  oneItem: {
    email: "instructor1@example.com",
  },
  // Names come from the users table, so only someone who has logged in has them.
  threeItems: [
    {
      email: "instructor1@example.com",
      givenName: "Ina",
      familyName: "Structor",
      catalogName: "STRUCTOR I",
    },
    {
      email: "admin1@example.com",
      givenName: null,
      familyName: null,
      catalogName: null,
    },
    {
      email: "instructor2@example.com",
      givenName: "Second",
      familyName: "Teacher",
      catalogName: null,
    },
  ],
  /** The catalog names the Populate Courses job has collected (issue #120). */
  catalogNames: ["CONRAD P", "STRUCTOR I", "TEACHER S"],
  threeItemsWithIsInAdminEmailField: [
    {
      email: "instructor1@example.com",
      isInAdminEmails: true,
      givenName: "Ina",
      familyName: "Structor",
    },
    {
      email: "admin1@example.com",
      isInAdminEmails: false,
      givenName: null,
      familyName: null,
    },
    {
      email: "instructor2@example.com",
      isInAdminEmails: false,
      givenName: "Second",
      familyName: "Teacher",
    },
  ],
};

export { roleEmailFixtures };
