import React from "react";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import InstructorFeedbackPage from "main/pages/Admin/InstructorFeedbackPage";
import { FEEDBACK_COLUMNS_STORAGE_KEY } from "main/utils/instructorFeedbackColumns";
import adminInstructorFeedbackFixtures from "fixtures/adminInstructorFeedbackFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

export default {
  title: "pages/Admin/InstructorFeedbackPage",
  component: InstructorFeedbackPage,
};

// The page reads :qyy from the route, so each story sets its own initial entry. The hidden
// columns are remembered in localStorage; each story starts as a first visit would, all shown.
const Template = () => {
  localStorage.removeItem(FEEDBACK_COLUMNS_STORAGE_KEY);
  return (
    <Routes>
      <Route
        path="/admin/instructorFeedback/:qyy"
        element={<InstructorFeedbackPage />}
      />
    </Routes>
  );
};

const handlers = (rows, missing = []) => [
  http.get("/api/currentUser", () =>
    HttpResponse.json(apiCurrentUserFixtures.adminUser),
  ),
  http.get("/api/systemInfo", () =>
    HttpResponse.json(systemInfoFixtures.showingNeither),
  ),
  http.get("/api/admin/instructorFeedback/missing", () =>
    HttpResponse.json(missing),
  ),
  http.get("/api/admin/instructorFeedback", () => HttpResponse.json(rows)),
];

/**
 * W26 with four records: a course in both recruitments, a TA-only course (ULA Allocation N/A, its
 * unchecked ULA count left out), a ULA-only course whose instructor is not in the instructor list,
 * and a long comment wrapped in the Comments column, which starts at 80% of the window. The
 * headings but Course Name, Instructor and Comments are two lines in the smaller size; the
 * true-or-false columns show ☒ or ☐; each email has its copy icon. Below, the "No Feedback Yet From
 * These Instructors" table, with its copy button and an instructor with no email on file.
 */
export const SeveralRecords = Template.bind({});
SeveralRecords.parameters = {
  reactRouter: { initialEntries: ["/admin/instructorFeedback/W26"] },
  msw: {
    handlers: handlers(
      adminInstructorFeedbackFixtures.severalRecords,
      adminInstructorFeedbackFixtures.missing,
    ),
  },
};

/** Every instructor has answered: the second table is replaced by a short line. */
export const EveryoneResponded = Template.bind({});
EveryoneResponded.parameters = {
  reactRouter: { initialEntries: ["/admin/instructorFeedback/W26"] },
  msw: {
    handlers: handlers(adminInstructorFeedbackFixtures.severalRecords, []),
  },
};

/** A quarter no instructor has given feedback for: everyone is in the second table. */
export const EmptyQuarter = Template.bind({});
EmptyQuarter.parameters = {
  reactRouter: { initialEntries: ["/admin/instructorFeedback/S26"] },
  msw: { handlers: handlers([], adminInstructorFeedbackFixtures.missing) },
};

/** Something in the URL that is not a quarter. */
export const NotAQuarter = Template.bind({});
NotAQuarter.parameters = {
  reactRouter: { initialEntries: ["/admin/instructorFeedback/Fall2026"] },
  msw: { handlers: handlers([]) },
};
