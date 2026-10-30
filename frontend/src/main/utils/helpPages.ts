/**
 * The Help menu's pages (issue #140): where each lives, what it is called, and who it is for.
 * The menu and the router both read this list, so adding a page is one entry here plus its file.
 */
export type HelpAudience = "everyone" | "instructor" | "admin";

export type HelpPage = {
  path: string;
  label: string;
  audience: HelpAudience;
};

export const HELP_PAGES: HelpPage[] = [
  { path: "/help/about", label: "About TA Apply", audience: "everyone" },
  {
    path: "/help/ta-applicants",
    label: "For TA Applicants",
    audience: "everyone",
  },
  {
    path: "/help/ula-applicants",
    label: "For ULA Applicants",
    audience: "everyone",
  },
  {
    path: "/help/instructors",
    label: "For Instructors",
    audience: "instructor",
  },
  { path: "/help/admins", label: "For Admins", audience: "admin" },
  {
    path: "/help/csv",
    label: "CSV Upload/Download Formats",
    audience: "admin",
  },
];

/** The Google Doc with the department's instructions for the ULA teaching-demo video. */
export const VIDEO_INSTRUCTIONS_URL =
  "https://docs.google.com/document/d/10b4MzotCXZCAkR1p5vTgBB_4gHyrw6a0AusVEKfoXdI/edit?tab=t.0#heading=h.khi2ca2p71ii";

/** The link text used wherever the video instructions are offered. */
export const VIDEO_INSTRUCTIONS_TEXT = "Instructions for preparing your video";

/** One option on the Admin or Developer menu, with the section below that explains it. */
export type AdminMenuEntry = {
  menu: "Admin" | "Developer" | "Home page";
  label: string;
  path: string;
  /** The id of the section on this page. */
  section: string;
  summary: string;
};

export const ADMIN_MENU_ENTRIES: AdminMenuEntry[] = [
  {
    menu: "Admin",
    label: "Users",
    path: "/admin/users",
    section: "users",
    summary: "Everyone who has ever signed in, with their roles.",
  },
  {
    menu: "Admin",
    label: "Admins",
    path: "/admin/admins",
    section: "admins",
    summary: "Who may use the Admin menu; add or remove an admin by email.",
  },
  {
    menu: "Admin",
    label: "Instructors",
    path: "/admin/instructors",
    section: "instructors",
    summary:
      "Who gets the Instructor section; add by email or CSV, and set catalog names.",
  },
  {
    menu: "Admin",
    label: "Courses",
    path: "/admin/courses",
    section: "courses",
    summary:
      "The course table from the UCSB catalog, and which courses recruit TAs and ULAs.",
  },
  {
    menu: "Home page",
    label: "Recruitments",
    path: "/",
    section: "recruitments",
    summary:
      "Create, open, close and delete recruitments; their courses, test form, CSV and applications.",
  },
  {
    menu: "Admin",
    label: "TA App Settings",
    path: "/admin/settings/ta",
    section: "ta-app-settings",
    summary:
      "The lists and notices behind the TA form, and the legacy TA import.",
  },
  {
    menu: "Admin",
    label: "ULA App Settings",
    path: "/admin/settings/ula",
    section: "ula-app-settings",
    summary:
      "The lists and notices behind the ULA form, and the legacy ULA import.",
  },
  {
    menu: "Admin",
    label: "Legacy TA Application",
    path: "/admin/legacy-ta-application",
    section: "legacy-ta-application",
    summary: "The old PHP application form, for comparison.",
  },
  {
    menu: "Admin",
    label: "Audit Trail",
    path: "/admin/audittrail",
    section: "audit-trail",
    summary: "Every change an admin has made to a student's application.",
  },
  {
    menu: "Developer",
    label: "Jobs",
    path: "/admin/jobs",
    section: "jobs",
    summary:
      "The background jobs that fill the course tables, with their logs.",
  },
  {
    menu: "Developer",
    label: "Developer Info",
    path: "/admin/developer",
    section: "developer-info",
    summary:
      "Which commit is deployed, the API endpoints, and system settings.",
  },
];
