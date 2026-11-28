import type {
  AssignmentCourse,
  AssignmentRow,
  Assignments,
} from "main/utils/assignments";
import { labelCourses } from "main/utils/assignments";

// Propose assignments (issues #481 and #515): the shapes of what the backend answers, and how the
// page puts them into words. The endpoints keep "auto" in their paths.

/** One proposed (or made) assignment: who, to which lecture, at what rank, in which pass. */
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

/**
 * The answer to GET /api/admin/assignments/auto/preview: the plan on the current state, and the
 * assignments version it was computed from, which Proceed sends back.
 */
export type AutoAssignPreview = {
  version: number;
  made: AutoAssignMade[];
  skipped: AutoAssignSkipped[];
};

/** Why a selected proposal was not made: the state had moved since the preview. */
export type AutoAssignNotMadeReason =
  "ALREADY_ASSIGNED" | "LECTURE_GONE" | "APPLICANT_GONE";

export type AutoAssignNotMade = {
  assignment: AutoAssignMade;
  reason: AutoAssignNotMadeReason;
};

/** The answer to POST /api/admin/assignments/auto/apply. */
export type AutoAssignApplied = {
  assignments: Assignments;
  made: AutoAssignMade[];
  notMade: AutoAssignNotMade[];
};

/** The answer to POST /api/admin/assignments/auto/undo. */
export type AutoAssignUndone = {
  assignments: Assignments;
  cleared: number;
};

export const PROPOSE_LABEL = "Propose assignments:";
export const PREVIEW_LABEL = "Preview";

/**
 * What the top-ranked unassigned candidate must be for a lecture to get a proposal, one condition
 * per entry; the TA version adds the PhD rule (issue #488). The tooltip is built from this list so
 * the two versions cannot drift.
 */
export const proposeConditions = (type: "TA" | "ULA"): string[] => {
  const conditions = [
    "is enthusiastic about the course",
    "is wanted by no other lecture that still has places",
  ];
  if (type === "TA") {
    conditions.push(
      "is a PhD student in Computer Science (MS students and other majors are always assigned by hand)",
    );
  }
  return conditions;
};

/** The Preview button's tooltip: the conditions in one sentence, and that nothing is made unseen. */
export const proposeTooltip = (type: "TA" | "ULA"): string => {
  const [first, ...rest] = proposeConditions(type);
  const conditions = rest.reduce(
    (text, condition, i) =>
      `${text}${i === 0 ? " and " : ", and "}${condition}`,
    first,
  );
  return `Propose assignments to courses where there is one clear choice: the top-ranked unassigned candidate ${conditions}. All proposed assignments are shown first and you can control which ones are made.`;
};

/**
 * The lectures on offer with places still to fill that nobody has ranked anyone for. Nothing can
 * be proposed for them, and they cannot hold anyone back either, so if their instructors have yet
 * to rank, a proposal now could hand their favourites to other lectures: the admin is warned.
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

/** One row of the Proposed assignments table, in the page's words. */
export type ProposedRow = {
  applicationId: number;
  recruitmentCourseId: number;
  applicant: string;
  lecture: string;
  rank: number;
  /** The applicant's interest in the lecture (1st Choice, 2nd Choice or Enthusiastic). */
  preference: string;
  pass: number;
  /** TA only: the page's Class Level and Major, so the PhD/CS rule is visible. */
  classLevel: string;
  major: string;
};

/**
 * The proposals as table rows. The preference, class level and major are read off the page's own
 * rows (the backend's preview carries ids only), blank for an applicant no longer on the page.
 */
export const proposedRows = (
  made: readonly AutoAssignMade[],
  page: Pick<Assignments, "courses" | "rows">,
): ProposedRow[] => {
  const lecture = lectureNames(page.courses);
  const applicant = applicantNames(page.rows);
  return made.map((m) => {
    const row = page.rows.find((r) => r.applicationId === m.applicationId);
    return {
      applicationId: m.applicationId,
      recruitmentCourseId: m.recruitmentCourseId,
      applicant: applicant(m.applicationId),
      lecture: lecture(m.recruitmentCourseId),
      rank: m.rank,
      preference: row?.preferences[String(m.recruitmentCourseId)] ?? "",
      pass: m.pass,
      classLevel: row?.identity.classLevel ?? "",
      major: row?.identity.major ?? "",
    };
  });
};

/** Why a lecture got no proposal, without the lecture's name (its own column carries that). */
export const skippedReason = (skipped: AutoAssignSkipped): string => {
  switch (skipped.reason) {
    case "NO_RANKINGS":
      return "No rankings yet.";
    case "ALL_RANKED_ASSIGNED":
      return "Every candidate it ranked is already assigned.";
    case "TIE":
      return `Two or more remaining candidates share its top rank (${skipped.rank}).`;
    case "NOT_ENTHUSIASTIC":
      return "Its top remaining candidate is not enthusiastic about it.";
    case "RANKED_ELSEWHERE":
      return "Its top remaining candidate is also ranked by another lecture that still has places.";
    case "NOT_PHD":
      return "Its top remaining candidate is an MS student, so is assigned by hand only.";
    case "NOT_CS_MAJOR":
      return "Its top remaining candidate is not a Computer Science major, so is assigned by hand only.";
  }
};

/** One row of the Not proposed table. */
export type NotProposedRow = {
  recruitmentCourseId: number;
  lecture: string;
  /** The lecture's places still to fill; null for a lecture no longer on the page. */
  left: number | null;
  reason: string;
  /** The candidate the lecture looked at, with their rank, or blank when there was none. */
  candidate: string;
  /** For RANKED_ELSEWHERE: the other needing lectures that rank the candidate. */
  alsoRankedBy: string;
};

/** The lectures left unfilled as table rows, in the page's words. */
export const notProposedRows = (
  skipped: readonly AutoAssignSkipped[],
  page: Pick<Assignments, "courses" | "rows">,
): NotProposedRow[] => {
  const lecture = lectureNames(page.courses);
  const applicant = applicantNames(page.rows);
  return skipped.map((s) => ({
    recruitmentCourseId: s.recruitmentCourseId,
    lecture: lecture(s.recruitmentCourseId),
    left:
      page.courses.find((c) => c.id === s.recruitmentCourseId)?.left ?? null,
    reason: skippedReason(s),
    candidate:
      s.applicationId === null
        ? ""
        : `${applicant(s.applicationId)} (ranked ${s.rank})`,
    alsoRankedBy: s.blockedBy.map(lecture).join(", "),
  }));
};

/** "2 assignments made." / "1 assignment made." / "No assignments were made." */
export const madeCountText = (n: number): string =>
  n === 0
    ? "No assignments were made."
    : `${n} assignment${n === 1 ? "" : "s"} made.`;

/** Why a selected proposal could not be made, as the end of a sentence. */
export const notMadeReason = (reason: AutoAssignNotMadeReason): string => {
  switch (reason) {
    case "ALREADY_ASSIGNED":
      return "already assigned meanwhile";
    case "LECTURE_GONE":
      return "the lecture is no longer on offer";
    case "APPLICANT_GONE":
      return "the application is no longer in this recruitment";
  }
};

/** "Ada Lovelace to 8: already assigned meanwhile." */
export const notMadeSentence = (
  notMade: AutoAssignNotMade,
  lecture: (id: number) => string,
  applicant: (id: number) => string,
): string =>
  `${applicant(notMade.assignment.applicationId)} to ${lecture(notMade.assignment.recruitmentCourseId)}: ${notMadeReason(notMade.reason)}.`;
