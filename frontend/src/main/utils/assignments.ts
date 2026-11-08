/** One lecture of the recruitment as the admin Assignments page lists it (issue #179). */
export type AssignmentCourse = {
  id: number;
  courseId: string;
  section: string | null;
  enrollCode: string | null;
  allocation: number;
  assigned: number;
  left: number;
  /** No longer offered (removed, stale or cancelled) but kept for its rankings or assignee. */
  historical: boolean;
};

/** One real, uncancelled applicant: identity text by header, the pencilled-in lecture, ranks. */
export type AssignmentRow = {
  applicationId: number;
  identity: Record<string, string>;
  tentativeAssignment: number | null;
  /** Each lecture's rank for this applicant, keyed by recruitment course id; absent if unranked. */
  rankings: Record<string, number | null>;
  /**
   * The applicant's interest in each lecture ("1st Choice", "2nd Choice", "Enthusiastic" or
   * "Would Consider"), keyed by recruitment course id; absent means Not Interested (issue #199).
   */
  preferences: Record<string, string>;
};

/** The payload of GET /api/admin/assignments. */
export type Assignments = {
  recruitmentId: number;
  type: "TA" | "ULA";
  identityHeaders: string[];
  courses: AssignmentCourse[];
  rows: AssignmentRow[];
  /**
   * The recruitment's assignments version (issue #280): a tentative assignment sends back the one
   * its page last saw, and is refused with a 409 if the assignments have changed since.
   */
  version: number;
};

/** The column headings for the rankings CSV's identity fields. */
export const IDENTITY_LABELS: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  major: "Major",
  classLevel: "Class Level",
  yearInProgram: "Year in Program",
  graduationDate: "Graduation Date",
  gpaMajor: "GPA (Major)",
  gpaOverall: "GPA (Overall)",
  previousServiceAsUla: "Previous ULA Quarters",
};

/** A heading for an identity field; a field with no label of its own is shown by its name. */
export const identityLabel = (header: string): string =>
  IDENTITY_LABELS[header] ?? header;

// ---- how the page names a lecture (issue #355) ----

/** What naming a lecture needs: its course id ("CMPSC     8") and its section ("0100"). */
export type CourseName = Pick<AssignmentCourse, "id" | "courseId" | "section">;

/** A lecture with the label the page shows for it. */
export type LabelledCourse<T extends CourseName> = T & { label: string };

/**
 * The longest label the rule below produces for a UCSB course: three digits, a two-letter suffix
 * and a section. The Tentative Assignment column, its dropdown and each lecture column are sized
 * to it (and not to the longest label actually present), so the columns are the same width on
 * every recruitment and nothing moves when a lecture is added.
 */
export const LONGEST_COURSE_LABEL = "190DD (0100)";

/** The width of that label in the monospace font the labels are shown in. */
export const COURSE_LABEL_WIDTH = `${LONGEST_COURSE_LABEL.length}ch`;

/** How far the digits are padded: the UCSB listing's width of three ("  8", " 16", "130"). */
const DIGIT_WIDTH = 3;

/** The number field's width when a section follows: three digits and two letters ("190DD"). */
const NUMBER_WIDTH = LONGEST_COURSE_LABEL.indexOf(" ");

/**
 * "CMPSC     8" → "8": the course number without its subject, as the rankings CSV heads a column
 * (AssignmentsService.headings on the backend). An id with no subject is used as it is: once
 * trimmed, the first run of whitespace is the one after the subject, if there is one.
 */
export const courseNumber = (courseId: string): string =>
  courseId.trim().replace(/\S+\s+/, "");

/** "190DD" → "190": the leading digits of a course number. */
const digitsOf = (number: string): string => {
  const end = number.search(/\D/);
  return end === -1 ? number : number.slice(0, end);
};

/**
 * The lectures with their labels (issue #355): the course number alone, its digits right-aligned
 * in a field of three so the letters line up as in the UCSB listing ("  5A", "  8", " 16", "130A",
 * "190DD"), and the section in parentheses only when the list has more than one section of the
 * course, with the number padded to five so the parentheses line up too ("  8   (0100)",
 * "190DD (0100)"). The section rule is the rankings CSV's (bare course number; section only when
 * a course has several), so the page and the export name a lecture alike. The labels are plain
 * spaces: show them in a monospace font with `white-space: pre`.
 */
export const labelCourses = <T extends CourseName>(
  courses: readonly T[],
): LabelledCourse<T>[] => {
  const numbers = courses.map((course) => courseNumber(course.courseId));
  // The course numbers that appear more than once: every occurrence after the first.
  const repeated = new Set(
    numbers.filter((number, i) => numbers.indexOf(number) !== i),
  );
  return courses.map((course, i) => {
    const number = numbers[i];
    const digits = digitsOf(number);
    const aligned = digits.padStart(DIGIT_WIDTH) + number.slice(digits.length);
    const label = repeated.has(number)
      ? `${aligned.padEnd(NUMBER_WIDTH)} (${course.section ?? ""})`
      : aligned;
    return { ...course, label };
  });
};

/**
 * The dropdown's text for a lecture, flagging one that is no longer offered. Browsers show an
 * option's text with its ASCII whitespace stripped and collapsed whatever CSS it has (that is the
 * HTML specification's label of an option, and a native menu on macOS has no CSS anyway), so the
 * spaces that align the labels are non-breaking ones, which are kept.
 */
export const courseOptionLabel = (course: {
  label: string;
  historical: boolean;
}): string =>
  (course.historical
    ? `${course.label} - no longer offered`
    : course.label
  ).replaceAll(" ", "\u00a0");

/** The lecture a row is pencilled into, or null when there is none or it is no longer listed. */
export const assignedCourse = <T extends Pick<AssignmentCourse, "id">>(
  row: AssignmentRow,
  courses: T[],
): T | null =>
  courses.find((course) => course.id === row.tentativeAssignment) ?? null;

/** The applicant's interest in a lecture, or undefined when they marked none (issue #199). */
export const preferenceFor = (
  row: AssignmentRow,
  course: AssignmentCourse,
): string | undefined => row.preferences[String(course.id)];

/** A lecture's rank for a row, or undefined when it has not ranked them (sorted last). */
export const rankFor = (
  row: AssignmentRow,
  course: AssignmentCourse,
): number | undefined => row.rankings[String(course.id)] ?? undefined;
