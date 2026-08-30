import type { ApiCurrentUser, CurrentUser } from "main/utils/currentUser";

// ROLE_ADMIN, ROLE_INSTRUCTOR and ROLE_GRAD_STUDENT are independent: there is no role hierarchy,
// so an admin does NOT implicitly hold the other two. Every signed-in user has ROLE_USER.
export const apiCurrentUserFixtures = {
  // A UCSB address with no other role: the backend grants ROLE_UNDERGRAD.
  userOnly: {
    user: { email: "cgaucho@ucsb.edu", givenName: "Gaucho" },
    roles: [{ authority: "ROLE_USER" }, { authority: "ROLE_UNDERGRAD" }],
  },
  // A non-UCSB address gets no undergrad role.
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
  gradStudentUser: {
    user: { email: "grad@ucsb.edu", givenName: "Grad" },
    roles: [{ authority: "ROLE_USER" }, { authority: "ROLE_GRAD_STUDENT" }],
  },
  instructorAndGradStudentUser: {
    user: { email: "both@ucsb.edu", givenName: "Both" },
    roles: [
      { authority: "ROLE_USER" },
      { authority: "ROLE_INSTRUCTOR" },
      { authority: "ROLE_GRAD_STUDENT" },
    ],
  },
} satisfies Record<string, ApiCurrentUser>;

export const currentUserFixtures = {
  notLoggedIn: { loggedIn: false as const, root: null },
  userOnly: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.userOnly,
      rolesList: ["ROLE_USER", "ROLE_UNDERGRAD"],
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
  gradStudentUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.gradStudentUser,
      rolesList: ["ROLE_USER", "ROLE_GRAD_STUDENT"],
    },
  },
  instructorAndGradStudentUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.instructorAndGradStudentUser,
      rolesList: ["ROLE_USER", "ROLE_INSTRUCTOR", "ROLE_GRAD_STUDENT"],
    },
  },
} satisfies Record<string, CurrentUser>;
