/**
 * The words on the admin recruitment card's lifecycle buttons (issue #186): a tooltip on each, and
 * for the actions that change what applicants or faculty can do, the confirmation that explains
 * what is about to happen and links to the longer explanation on Help → For Admins.
 */

export const OPEN_APPLICATIONS_TOOLTIP =
  "Let applicants submit and edit applications for this recruitment";
export const CLOSE_APPLICATIONS_TOOLTIP =
  "Stop accepting applications for this recruitment";
export const OPEN_REVIEWS_TOOLTIP =
  "Let faculty see and rank the candidates for their courses, with a ranking deadline";
export const CLOSE_REVIEWS_TOOLTIP =
  "Stop faculty from changing their rankings; the dates on file are kept";

/** The sections of Help → For Admins that the confirmations link to. */
export const OPEN_CLOSE_APPLICATIONS_HELP =
  "/help/admins#open-close-applications";
export const FACULTY_REVIEWS_HELP = "/help/admins#faculty-reviews";

export type Confirmation = {
  title: string;
  explanation: string;
  helpLink: string;
  yes: string;
  no: string;
};

/**
 * What the Open Applications or Close Applications button asks before acting.
 *
 * @param open whether applications are open now, so the action is to close them
 */
export const statusConfirmation = (open: boolean): Confirmation =>
  open
    ? {
        title: "Close Applications",
        explanation:
          "Applicants will no longer be able to submit or edit applications for this recruitment. The actual closing date is stamped with today's date. Every application already on file is kept, and the recruitment can be opened again later.",
        helpLink: OPEN_CLOSE_APPLICATIONS_HELP,
        yes: "Yes, Close Applications Now",
        no: "No, don't close applications now",
      }
    : {
        title: "Open Applications",
        explanation:
          "Applicants will be able to submit applications for this recruitment, and to edit them until the primary consideration date. The first opening stamps the actual opening date, which is kept even if the recruitment is closed and reopened.",
        helpLink: OPEN_CLOSE_APPLICATIONS_HELP,
        yes: "Yes, Open Applications Now",
        no: "No, don't open applications now",
      };

/** What the Open Faculty Reviews modal explains above its deadline box. */
export const OPEN_REVIEWS_CONFIRMATION: Confirmation = {
  title: "Open Faculty Reviews",
  explanation:
    "Faculty will be able to see the candidates for their courses and enter rankings until the deadline you give here. The first opening stamps the faculty review opening date, which is kept if reviews are reopened; the deadline can be changed later. The change is recorded in the recruitment's change history.",
  helpLink: FACULTY_REVIEWS_HELP,
  yes: "Yes, Open Faculty Reviews Now",
  no: "No, don't open faculty reviews now",
};

/** The link text used in every confirmation. */
export const MORE_ABOUT_TEXT = "More about this action";
