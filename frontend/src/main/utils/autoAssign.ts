import type {
  AssignmentCourse,
  AssignmentRow,
  Assignments,
} from "main/utils/assignments";
import { labelCourses } from "main/utils/assignments";

// Automatically Assign No-Conflict Slots (issue #481): the shapes of what the backend answers, and
// how the page puts them into words.

/** One assignment a run made: who, to which lecture, at what rank, in which pass. */
export type AutoAssignMade = {
  applicationId: number;
  recruitmentCourseId: number;
  rank: number;
  pass: number;
};

/** Why a lecture still needing assignments got none in the final pass. */
export type AutoAssignReason =
  | "NO_RANKINGS"
  | "ALL_RANKED_ASSIGNED"
  | "TIE"
  | "NOT_ENTHUSIASTIC"
  | "RANKED_ELSEWHERE"
  // TA only (issue #488): the top remaining candidate may only be assigned by hand.
  | "NOT_PHD"
  | "NOT_CS_MAJOR";

export type AutoAssignSkipped = {
  recruitmentCourseId: number;
  reason: AutoAssignReason;
  /** The candidate the lecture looked at, when there was one. */
  applicationId: number | null;
  rank: number | null;
  /** For RANKED_ELSEWHERE: the other needing lectures that rank that candidate. */
  blockedBy: number[];
};

/** The answer to POST /api/admin/assignments/auto. */
export type AutoAssignOutcome = {
  assignments: Assignments;
  made: AutoAssignMade[];
  skipped: AutoAssignSkipped[];
};

/** The answer to POST /api/admin/assignments/auto/undo. */
export type AutoAssignUndone = {
  assignments: Assignments;
  cleared: number;
};

export const AUTO_ASSIGN_LABEL = "Automatically Assign No-Conflict Slots";

/** The rule in one breath, for the button's tooltip; the TA version adds the PhD rule (issue #488). */
export const autoAssignTooltip = (type: "TA" | "ULA"): string =>
  `Fills every place where there is one clear choice: the top-ranked unassigned candidate who is enthusiastic about the course and wanted by no other lecture that still has places.${type === "TA" ? " Only PhD students in Computer Science are ever assigned automatically; MS students are always assigned by hand." : ""} Can be undone.`;

/** The modal's explanation; the TA version adds the PhD rule (issue #488). */
export const autoAssignExplanation = (type: "TA" | "ULA"): string =>
  `Fills every place where there is one clear choice. A lecture that still has places to fill gets its highest-ranked unassigned candidate when that candidate is enthusiastic about the course (1st Choice, 2nd Choice or Enthusiastic) and no other lecture that still has places to fill has ranked them at all. This repeats until no more such assignments can be made. Applicants marked Not Hired take no part.${type === "TA" ? " Only PhD students whose major is Computer Science are ever assigned automatically; a lecture whose top remaining candidate is an MS student or in another major is left for you, and listed with the reason." : ""} Nothing already assigned is changed, and the run can be undone afterwards.`;

/**
 * The lectures on offer with places still to fill that nobody has ranked anyone for. A run cannot
 * fill them, and they cannot hold anyone back either, so if their instructors have yet to rank,
 * a run now could hand their favourites to other lectures: the admin is warned before running.
 */
export const needingWithoutRankings = (
  page: Pick<Assignments, "courses" | "rows">,
): AssignmentCourse[] =>
  page.courses.filter(
    (course) =>
      !course.historical &&
      course.left > 0 &&
      !page.rows.some(
        (row) =>
          row.rankings[String(course.id)] !== undefined &&
          row.rankings[String(course.id)] !== null,
      ),
  );

/**
 * Whether the faculty ranking deadline is still to come (or was never set), as of {@code today}
 * (an ISO date, "2026-11-24", Pacific like the deadline itself): rankings may still be arriving.
 */
export const deadlinePending = (
  deadline: string | null | undefined,
  today: string,
): boolean => deadline === null || deadline === undefined || deadline >= today;

/**
 * How the page names a lecture in a sentence: its table label ("  8   (0100)") with the aligning
 * spaces collapsed ("8 (0100)"), or its id when the lecture is no longer on the page.
 */
export const lectureNames = (
  courses: readonly AssignmentCourse[],
): ((id: number) => string) => {
  const labels = new Map(
    labelCourses(courses).map((course) => [
      course.id,
      course.label.trim().replace(/\s+/g, " "),
    ]),
  );
  return (id) => labels.get(id) ?? `lecture ${id}`;
};

/** An applicant by name, falling back to their email, then to their id. */
export const applicantNames = (
  rows: readonly AssignmentRow[],
): ((id: number) => string) => {
  const names = new Map(
    rows.map((row) => [
      row.applicationId,
      [row.identity.firstName, row.identity.lastName]
        .filter((part) => part !== undefined && part !== "")
        .join(" ") ||
        row.identity.email ||
        `applicant ${row.applicationId}`,
    ]),
  );
  return (id) => names.get(id) ?? `applicant ${id}`;
};

/** What was done, as a sentence: "Ada Lovelace to 8 (0100), ranked 1 (pass 2)". */
export const madeSentence = (
  made: AutoAssignMade,
  lecture: (id: number) => string,
  applicant: (id: number) => string,
): string =>
  `${applicant(made.applicationId)} to ${lecture(made.recruitmentCourseId)}, ranked ${made.rank} (pass ${made.pass})`;

/** Why a lecture was left unfilled, as a sentence that starts with the lecture's name. */
export const skippedSentence = (
  skipped: AutoAssignSkipped,
  lecture: (id: number) => string,
  applicant: (id: number) => string,
): string => {
  const name = lecture(skipped.recruitmentCourseId);
  // Only the reasons about a candidate name one, and the backend always sends one for them.
  const candidate = () =>
    `${applicant(skipped.applicationId as number)} (ranked ${skipped.rank})`;
  switch (skipped.reason) {
    case "NO_RANKINGS":
      return `${name}: no rankings yet.`;
    case "ALL_RANKED_ASSIGNED":
      return `${name}: every candidate it ranked is already assigned.`;
    case "TIE":
      return `${name}: two or more remaining candidates share its top rank (${skipped.rank}).`;
    case "NOT_ENTHUSIASTIC":
      return `${name}: its top remaining candidate, ${candidate()}, is not enthusiastic about it.`;
    case "RANKED_ELSEWHERE":
      return `${name}: its top remaining candidate, ${candidate()}, is also ranked by ${skipped.blockedBy.map(lecture).join(" and ")}.`;
    case "NOT_PHD":
      return `${name}: its top remaining candidate, ${candidate()}, is an MS student, so is assigned by hand only.`;
    case "NOT_CS_MAJOR":
      return `${name}: its top remaining candidate, ${candidate()}, is not a Computer Science major, so is assigned by hand only.`;
  }
};
