import type { ApiCurrentUser, CurrentUser } from "main/utils/currentUser";

export const apiCurrentUserFixtures = {
  userOnly: {
    user: { email: "cgaucho@ucsb.edu", givenName: "Gaucho" },
    roles: [{ authority: "ROLE_USER" }],
  },
  adminUser: {
    user: { email: "admin@ucsb.edu", givenName: "Admin" },
    roles: [
      { authority: "ROLE_USER" },
      { authority: "ROLE_ADMIN" },
      { authority: "ROLE_INSTRUCTOR" },
    ],
  },
  instructorUser: {
    user: { email: "diba@ucsb.edu", givenName: "Diba" },
    roles: [{ authority: "ROLE_USER" }, { authority: "ROLE_INSTRUCTOR" }],
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
  adminUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.adminUser,
      rolesList: ["ROLE_USER", "ROLE_ADMIN", "ROLE_INSTRUCTOR"],
    },
  },
  instructorUser: {
    loggedIn: true as const,
    root: {
      ...apiCurrentUserFixtures.instructorUser,
      rolesList: ["ROLE_USER", "ROLE_INSTRUCTOR"],
    },
  },
} satisfies Record<string, CurrentUser>;
