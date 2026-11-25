/**
 * The "Copy emails of applicants with no assignment" button on the admin Assignments page (issue
 * #497): the applicants whose Tentative Assignment is blank, for an email to them.
 */
import type { AssignmentRow } from "main/utils/assignments";

/** The button's label, as the maintainer worded it. */
export const COPY_UNASSIGNED_LABEL =
  "Copy emails of applicants with no assignment";

/** The button's tooltip while there is someone to copy. */
export const COPY_UNASSIGNED_TOOLTIP =
  "Copies the email of every applicant whose Tentative Assignment is blank, each once, in the table's order. Cancelled applications are not included.";

/** The button's tooltip while it is disabled: nobody is left to copy. */
export const EVERY_ASSIGNED_TOOLTIP = "Every applicant has an assignment.";

/**
 * The emails the button copies: each applicant with no tentative assignment, in the table's order,
 * each email once, leaving out an applicant with no email on file. The rows are already only the
 * applications that count, so cancelled and test applications are never among them.
 */
export const unassignedEmails = (rows: AssignmentRow[]): string[] => [
  ...new Set(
    rows
      .filter((row) => row.tentativeAssignment === null)
      .map((row) => row.identity.email)
      .filter((email) => email !== undefined && email !== ""),
  ),
];
