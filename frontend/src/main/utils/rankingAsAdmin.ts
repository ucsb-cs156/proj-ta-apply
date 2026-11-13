/**
 * Issue #439: what the ranking page tells an admin who may change a course's rankings only because
 * they are an admin (they do not teach it, or faculty reviews are closed), so that they know whose
 * rankings they are changing. The last sentence depends on whether the instructor still can.
 */
export const rankingAsAdminText = (reviewStatus: string): string =>
  "You can enter and change the rankings for this course because you are an " +
  "admin. What you save here is the course's faculty ranking, the same one " +
  "its instructor sees. " +
  (reviewStatus === "Closed"
    ? "Faculty reviews are closed, so the instructor can no longer change it."
    : "Faculty reviews are open, so the instructor can change it too.");
