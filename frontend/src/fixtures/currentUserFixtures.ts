import type { ApiCurrentUser, CurrentUser } from "main/utils/currentUser";

// ROLE_ADMIN and ROLE_INSTRUCTOR are independent: there is no role hierarchy, so an admin does
// NOT implicitly hold the other. Every signed-in user has ROLE_USER, and a user with nothing else
// is an applicant.
export const apiCurrentUserFixtures = {
  // A UCSB address with no other role: an applicant.
  userOnly: {
    user: { email: "cgaucho@ucsb.edu", givenName: "Gaucho" },
    roles: [{ authority: "ROLE_USER" }],
  },
  // An outside address in the admin or instructor table may sign in; one in neither cannot.
  nonUcsbUser: {
    user: { email: "someone@gmail.com", givenName: "Outsider" },
    roles: [{ authority: "ROLE_USER" }],
  },
  adminUser: {
    user: { email: "admin@ucsb.edu", givenName: "Admin" },
    roles: [{ authority: "ROLE_USER" }, { authority: "ROLE_ADMIN" }],
  },
  instructorUser: {
    user: { email: "diba@ucsb.edu", givenName: "Diba" },
    roles: [{ authority: "ROLE_USER" }, { authority: "ROLE_INSTRUCTOR" }],
  },
  adminAndInstructorUser: {
    user: { email: "both@ucsb.edu", givenName: "Both" },
    roles: [
      { authority: "ROLE_USER" },
      { authority: "ROLE_ADMIN" },
      { authority: "ROLE_INSTRUCTOR" },
    ],
  },
} satisfies Record<string, ApiCurrentUser>;

export const currentUserFixtures = {
  notLoggedIn: { loggedIn: false as const, root: null },
  userOnly: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.userOnly,
      rolesList: ["ROLE_USER"],
    },
  },
  nonUcsbUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.nonUcsbUser,
      rolesList: ["ROLE_USER"],
    },
  },
  adminUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.adminUser,
      rolesList: ["ROLE_USER", "ROLE_ADMIN"],
    },
  },
  instructorUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.instructorUser,
      rolesList: ["ROLE_USER", "ROLE_INSTRUCTOR"],
    },
  },
  adminAndInstructorUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.adminAndInstructorUser,
      rolesList: ["ROLE_USER", "ROLE_ADMIN", "ROLE_INSTRUCTOR"],
    },
  },
} satisfies Record<string, CurrentUser>;
