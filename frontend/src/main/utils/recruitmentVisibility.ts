/**
 * Hiding a recruitment from students and instructors (issue #496): the show/hide button beside
 * the trash can on the admin's recruitment card, and what it says.
 */
import type { Recruitment } from "main/components/Recruitments/RecruitmentTable";

/** The button's tooltip and accessible name, as the maintainer worded it. */
export const HIDE_TOOLTIP =
  "This button will show/hide the recruitment from students and instructors.";

/** The badge on a hidden recruitment's card. */
export const HIDDEN_BADGE = "Hidden";

/** PUT here with id and hidden=true|false. */
export const HIDDEN_URL = "/api/admin/recruitments/hidden";

/** Whether the admin has hidden the recruitment; one with no value (older data) is shown. */
export const isHidden = (recruitment: Recruitment): boolean =>
  recruitment.hidden === true;

/** The toast after the button has moved the recruitment to the other state. */
export const hiddenToast = (hidden: boolean): string =>
  hidden
    ? "Recruitment hidden from students and instructors."
    : "Recruitment shown to students and instructors.";
