// The Hiring Staff role (issue #504): the hiring and financial office staff who process ULA soft
// offers. These are the admin-facing constants of the Admin → Hiring Staff page; what the role
// itself sees is issue #505.

export const HIRING_STAFF_ROLE = "ROLE_HIRING_STAFF";

export const HIRING_STAFF_LABEL = "Hiring Staff";

export const HIRING_STAFF_ALL_URL = "/api/admin/hiringStaff/all";
export const HIRING_STAFF_POST_URL = "/api/admin/hiringStaff/post";
export const HIRING_STAFF_DELETE_URL = "/api/admin/hiringStaff/delete";

export const HIRING_STAFF_PATH = "/admin/hiringStaff";
export const HIRING_STAFF_CREATE_PATH = "/admin/hiringStaff/create";

/** Shown under the names note on the Hiring Staff page. */
export const HIRING_STAFF_NOTE =
  "Hiring Staff see the Soft Offer Results of each ULA recruitment whose soft offers have been released, and nothing else: no Admin menu, no other admin pages.";

/** The toast after adding one. */
export const hiringStaffAddedToast = (email: string): string =>
  `New hiring staff added - email: ${email}`;

// ---- what the role sees (issue #505) ----

/** GET: the ULA recruitments with soft offers released, newest quarter first; admins may read it too. */
export const HIRING_STAFF_RECRUITMENTS_URL = "/api/hiringStaff/recruitments";

export const NO_RELEASED_SOFT_OFFERS_TEXT =
  "No ULA recruitment has released soft offers yet.";
