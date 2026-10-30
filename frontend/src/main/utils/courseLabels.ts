/** Course id to the instructors of its lectures, as /api/recruitments/instructors returns it. */
export type CourseInstructors = Record<string, string>;

/**
 * A course as the application form names it (issue #121): the padded id, then the instructors in
 * parentheses when they are known, e.g. "CMPSC   156 (CONRAD P)".
 */
export function courseLabel(
  courseId: string,
  instructors: CourseInstructors | undefined | null,
): string {
  const names = instructors?.[courseId];
  return names ? `${courseId} (${names})` : courseId;
}

/**
 * The same map built from the admin's rows (one per lecture), for the test-application page,
 * which has those rather than the applicant endpoint: distinct names, sorted, joined with commas,
 * leaving out removed rows and blank names.
 */
export function instructorsFromRows(
  rows: { courseId: string; instructor?: string | null; removed?: boolean }[],
): CourseInstructors {
  const names = new Map<string, Set<string>>();
  for (const row of rows) {
    const instructor = (row.instructor ?? "").trim();
    if (row.removed || instructor === "") continue;
    if (!names.has(row.courseId)) names.set(row.courseId, new Set());
    names.get(row.courseId)?.add(instructor);
  }
  const result: CourseInstructors = {};
  for (const [courseId, set] of names) {
    result[courseId] = [...set].sort().join(", ");
  }
  return result;
}
