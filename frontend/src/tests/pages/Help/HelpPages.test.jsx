import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import HelpTaApplicantsPage from "main/pages/Help/HelpTaApplicantsPage";
import HelpUlaApplicantsPage from "main/pages/Help/HelpUlaApplicantsPage";
import HelpInstructorsPage from "main/pages/Help/HelpInstructorsPage";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import HelpDeveloperPage from "main/pages/Help/HelpDeveloperPage";
import HelpNoticeFieldsPage from "main/pages/Help/HelpNoticeFieldsPage";
import {
  NOTICE_FIELD_EXAMPLES,
  QUARTER_NOTICE_FIELDS,
} from "main/utils/noticeFields";
import {
  ADMIN_MENU_ENTRIES,
  DEVELOPER_MENU_ENTRIES,
  VIDEO_INSTRUCTIONS_URL,
} from "main/utils/helpPages";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);
axiosMock.onGet("/api/currentUser").reply(200, apiCurrentUserFixtures.userOnly);
axiosMock
  .onGet("/api/systemInfo")
  .reply(200, systemInfoFixtures.showingNeither);

const renderPage = (page, initialEntries = ["/"]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={initialEntries}>{page}</MemoryRouter>
    </QueryClientProvider>,
  );

/**
 * The last section of the instructor and admin pages (issue #279): "Simultaneous Editing" for the
 * faculty rankings, with the warning as it appears (names included), what it means, the question
 * put to the newer tab, and what to do.
 */
function expectRankingSimultaneousEditingSection(page, intro) {
  const root = screen.getByTestId(page);
  const heading = screen.getByRole("heading", {
    level: 2,
    name: "Simultaneous Editing",
  });
  expect(heading).toHaveAttribute("id", "simultaneous-editing");
  // It ends the page: no other section follows it.
  const headings = [...root.querySelectorAll("h2")];
  expect(headings[headings.length - 1]).toBe(heading);
  const lead = screen.getByTestId(`${page}-simultaneous-editing-ranking`);
  expect(lead).toHaveTextContent(intro);

  // A faithful picture of the warning, with a name: the shared banner for a ranking.
  const example = screen.getByTestId(`${page}-simultaneous-editing-example`);
  expect(example).toHaveTextContent(
    "phtcon@ucsb.edu (Phill Conrad) is also editing this ranking. We recommend that only one admin edits this page at a time.",
  );
  expect(example).toHaveClass("alert", "alert-warning");
  // It is a picture and not a warning about anything, so it is not announced.
  expect(screen.queryByRole("alert")).toBeNull();

  const meaning = screen.getByTestId(`${page}-simultaneous-editing-meaning`);
  expect(meaning).toHaveTextContent(
    "What it means. The rankings of the same course are open somewhere else",
  );
  expect(meaning).toHaveTextContent(
    "This applies to the Candidate Ranking page",
  );
  expect(meaning).toHaveTextContent(
    "Rankings for this course changed while you were editing; your change has not been saved.",
  );
  expect(meaning).toHaveTextContent("press Save again");
  expect(meaning).toHaveTextContent(
    "from a copy of the list that is out of date, and say Rankings for this course changed",
  );
  expect(meaning).toHaveTextContent(
    "your change has not been saved. The table is then read again",
  );
  expect(meaning).toHaveTextContent(
    "Rankings of a different course never cause a warning",
  );
  const modal = screen.getByTestId(`${page}-simultaneous-editing-modal`);
  expect(modal).toHaveTextContent(
    "The tab or window you opened last also asks what you want to do",
  );
  expect(modal).toHaveTextContent(
    "The one you opened first only shows the warning",
  );
  expect(modal).toHaveTextContent(
    "already have this ranking open for editing in other windows or tabs.",
  );
  const choices = screen.getByTestId(`${page}-simultaneous-editing-choices`);
  expect(
    [...choices.querySelectorAll("li > strong")].map((b) => b.textContent),
  ).toEqual([
    "Leave this page",
    "Wait for the other tabs or windows to close, then resume here",
    "Continue anyway",
  ]);
  expect(choices).toHaveTextContent("Your rankings are safe in the other one");
  expect(choices).toHaveTextContent("then resume here keeps the page covered");
  expect(choices).toHaveTextContent("closes by itself within a few seconds");
  expect(choices).toHaveTextContent("The box does not come back");
  const todo = screen.getByTestId(`${page}-simultaneous-editing-ranking-todo`);
  expect(todo).toHaveTextContent(
    "What to do. Close all the other tabs or windows that have this course's rankings open",
  );
  expect(todo).toHaveTextContent("about twenty seconds");
  expect(lead.nextElementSibling).toBe(example);
  expect(example.nextElementSibling).toBe(meaning);
  expect(meaning.nextElementSibling).toBe(modal);
  expect(modal.nextElementSibling).toBe(choices);
  expect(choices.nextElementSibling).toBe(todo);
  // Issue #302: on the admin page, editing a student's application follows it. Then comes the
  // refresh section from #281, which still ends the page.
  const application = screen.queryByTestId(
    `${page}-simultaneous-editing-application`,
  );
  // Issue #280: then the Assignments page, a paragraph, its picture of the warning and a paragraph.
  const assignmentsDetail = screen.queryByTestId(
    `${page}-simultaneous-editing-assignments-detail`,
  );
  // Issue #277: then the Budget page, a paragraph, its picture, a paragraph and a paragraph.
  const budgetConflict = screen.queryByTestId(
    `${page}-simultaneous-editing-budget-conflict`,
  );
  const after = budgetConflict ?? assignmentsDetail ?? application ?? todo;
  if (application !== null) {
    expect(todo.nextElementSibling).toBe(application);
    expect(application.nextElementSibling).toBe(
      screen.getByTestId(`${page}-simultaneous-editing-assignments`),
    );
  }
  // Issue #278: then the Courses pages, a paragraph, its picture and a paragraph (admins only).
  const coursesMeaning = screen.queryByTestId(
    `${page}-simultaneous-editing-courses-meaning`,
  );
  // Issue #358: then the Combined Allocation page, a paragraph, its picture and a paragraph.
  const combinedMeaning = screen.queryByTestId(
    `${page}-simultaneous-editing-combined-meaning`,
  );
  if (coursesMeaning !== null) {
    expect(coursesMeaning.nextElementSibling).toBe(
      screen.getByTestId(`${page}-simultaneous-editing-combined`),
    );
  }
  expect((combinedMeaning ?? after).nextElementSibling).toBe(
    screen.getByTestId(`${page}-simultaneous-editing-todo`),
  );
}

/**
 * The last section of each applicant page (issue #273): "Simultaneous Editing", a picture of the
 * warning, what it means and what to do.
 */
function expectSimultaneousEditingSection(page) {
  const root = screen.getByTestId(page);
  const heading = screen.getByRole("heading", {
    level: 2,
    name: "Simultaneous Editing",
  });
  // It ends the page: no other section follows it.
  const headings = [...root.querySelectorAll("h2")];
  expect(headings[headings.length - 1]).toBe(heading);

  expect(heading.nextElementSibling).toHaveTextContent(
    "If you try to edit the same application in more than one tab or window, you may get a warning that looks like this:",
  );
  // A faithful picture of the warning: the same banner, and the 'You are also editing' message.
  const example = screen.getByTestId(`${page}-simultaneous-editing-example`);
  expect(example).toHaveTextContent(
    "You are also editing this application in another tab or window. Please know that this is risky; we recommend closing all but one of these.",
  );
  expect(example).toHaveClass("alert", "alert-warning");
  // It is a picture and not a warning about anything, so it is not announced.
  expect(screen.queryByRole("alert")).toBeNull();

  const meaning = screen.getByTestId(`${page}-simultaneous-editing-meaning`);
  expect(meaning).toHaveTextContent(
    "What it means. The same draft is open somewhere else",
  );
  expect(meaning).toHaveTextContent(
    "one copy can overwrite the other's changes",
  );
  expect(meaning).toHaveTextContent(
    "the system will refuse a save from a copy that is out of date and ask you to reload",
  );
  const todo = screen.getByTestId(`${page}-simultaneous-editing-todo`);
  expect(todo).toHaveTextContent(
    "What to do. Close all the other tabs or windows, and keep just one.",
  );
  expect(todo).toHaveTextContent("If the form asks you to reload, reload it");
  // Issue #284: the question put to the newer tab, and its three choices.
  const modal = screen.getByTestId(`${page}-simultaneous-editing-modal`);
  expect(modal).toHaveTextContent(
    "The tab or window you opened last also asks what you want to do",
  );
  expect(modal).toHaveTextContent(
    "The one you opened first only shows the warning",
  );
  expect(modal).toHaveTextContent(
    "You already have this application open for editing in another tab or window.",
  );
  const choices = screen.getByTestId(`${page}-simultaneous-editing-choices`);
  expect(
    [...choices.querySelectorAll("li > strong")].map((b) => b.textContent),
  ).toEqual([
    "Leave this page",
    "Wait for the other tabs or windows to close, then resume here",
    "Continue anyway",
  ]);
  expect(choices).toHaveTextContent(
    "takes this tab or window to the home page",
  );
  expect(choices).toHaveTextContent("then resume here keeps the form covered");
  expect(choices).toHaveTextContent("closes by itself within a few seconds");
  expect(choices).toHaveTextContent("The box does not come back");
  expect(todo).toHaveTextContent(
    "within a few seconds after the other copies are closed",
  );
  // In order, and last on the page.
  expect(heading.nextElementSibling.nextElementSibling).toBe(example);
  expect(example.nextElementSibling).toBe(meaning);
  expect(meaning.nextElementSibling).toBe(modal);
  expect(modal.nextElementSibling).toBe(choices);
  expect(choices.nextElementSibling).toBe(todo);
  // Issue #281: the refresh that keeps applications open or closed current ends the section.
  const refresh = screen.getByTestId(`${page}-simultaneous-editing-refresh`);
  // Issue #302: what the applicant sees when an admin has the application open comes first.
  const admin = screen.getByTestId(`${page}-simultaneous-editing-admin`);
  expect(todo.nextElementSibling).toBe(admin);
  expect(admin.nextElementSibling).toBe(refresh);
  expect(admin).toHaveTextContent(
    "Admin jane@ucsb.edu (Jane Doe) has this application open for editing. We recommend that you close this window and try again in a few minutes. If this message persists, please reach out to jane@ucsb.edu",
  );
  expect(admin).toHaveTextContent("refuses your save");
  expect(root.lastElementChild).toBe(refresh);
  expect(refresh).toHaveTextContent(
    "Applications opening and closing. The home page and the application form refresh by themselves, without reloading, about every 15 seconds (somewhere between 10 and 20)",
  );
  expect(refresh).toHaveTextContent("There is no warning for that.");
  expect(refresh).toHaveTextContent(
    "your draft is kept, as of its last automatic save, but it can no longer be submitted",
  );
  expect(refresh).toHaveTextContent(
    "If a page looks out of date, switch back to it, or reload it.",
  );
  // The tip that used to carry this warning is gone.
  expect(screen.queryByTestId(`${page}-one-window`)).toBeNull();
}

describe("Help pages (issue #140)", () => {
  test("admin help distinguishes rankings CSV and explains historical export policy", async () => {
    renderPage(<HelpAdminsPage />);
    expect(
      await screen.findByRole("heading", {
        name: "Download Rankings CSV",
      }),
    ).toHaveAttribute("id", "rankings-csv");
    expect(
      screen.getByText(/This is separate from/, { exact: false }),
    ).toHaveTextContent(
      /every real applicant.*no interests or rankings.*test applications are excluded.*Unset rankings are blank, not zero, and ties are preserved/,
    );
    // Issue #234: where the two CSV downloads now are.
    expect(
      screen.getByText(/This is separate from/, { exact: false }),
    ).toHaveTextContent(
      "On a recruitment's card on the home page, in the bottom row of buttons and once faculty reviews have been opened, Download Rankings CSV saves that recruitment's faculty rankings as a spreadsheet-ready file. This is separate from Download Applications as CSV on its Applications page, which exports application answers.",
    );
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /TA columns are first name, last name, email, major, class level, year in program and expected graduation/,
    );
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /ticked the first quarter box has no GPAs, and both columns read .First quarter./,
    );
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /ULA columns are first name, last name, email, major, year in program, expected graduation, GPA in major, overall GPA and quarters of previous ULA service/,
    );
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /No video links or admin comments are exported.*headed by the bare course number \(16, 5A\); the section is added only when the recruitment has more than one section of that course.*Removed, stale and cancelled sections remain/,
    );
  });

  test("the TA applicants page says what a former ULA's first TA form starts with (issue #307)", async () => {
    renderPage(<HelpTaApplicantsPage />);
    const section = await screen.findByTestId("HelpTaApplicantsPage-from-ula");
    expect(section).toHaveTextContent(
      "never applied to be a TA but you did apply to be a ULA",
    );
    expect(section).toHaveTextContent(
      "most recent TA application is used instead",
    );
    expect(section).toHaveTextContent(
      "Copied from your most recent ULA application: your name, your major",
    );
    expect(section).toHaveTextContent("Not copied: your GPAs");
  });

  test("the TA applicants page lists what is asked for, at a high level", async () => {
    renderPage(<HelpTaApplicantsPage />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "For TA Applicants",
      }),
    ).toBeInTheDocument();
    expectSimultaneousEditingSection("HelpTaApplicantsPage");
    const items = [
      ...screen
        .getByTestId("HelpTaApplicantsPage-asked-for")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(items).toHaveLength(9);
    expect(items[1]).toMatch(
      /major, whether you are a PhD or MS student, your year in the program, your GPA/,
    );
    // Issue #292: the box that stands in for the GPAs of a first quarter grad student.
    expect(items[1]).toMatch(
      /first quarter grad student.*check the box under the two GPA fields/,
    );
    expect(items[2]).toMatch(/residency status.*language exam/);
    expect(items[3]).toMatch(/courses you have taken, at UCSB or elsewhere/);
    expect(items[4]).toMatch(/self-assessment.*5 \(highest\) to 1 \(lowest\)/);
    expect(items[5]).toMatch(/previous teaching experience/);
    expect(items[6]).toMatch(/first and second choice courses/);
    expect(items[7]).toMatch(/every other course offered.*level of interest/);
    expect(items[8]).toMatch(/Anything else/);
    expect(
      screen.getByText(/edit your application as often as you like/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/notices, terms and conditions for TA applications/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/video/)).toBeNull();
  });

  test("the ULA applicants page lists what is asked for, and links the video instructions", async () => {
    renderPage(<HelpUlaApplicantsPage />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "For ULA Applicants",
      }),
    ).toBeInTheDocument();
    const items = [
      ...screen
        .getByTestId("HelpUlaApplicantsPage-asked-for")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(items).toHaveLength(13);
    expect(items[0]).toMatch(/perm number/);
    // Issue #292: the box that stands in for the GPAs of a first quarter student.
    expect(items[1]).toMatch(
      /first quarter at UCSB.*check the box under the two GPA fields/,
    );
    expect(items[2]).toMatch(/served as a ULA before/);
    expect(items[3]).toMatch(/video with a teaching demonstration/);
    expect(items[5]).toMatch(/employee ID.*I-9/);
    expect(items[6]).toMatch(/training/);
    expect(items[8]).toMatch(
      /how interested you are, from 5 \(very\) to 1 \(not\)/,
    );
    expect(items[10]).toMatch(/lectures and discussion sections/);
    expect(items[11]).toMatch(/B or better/);
    const link = screen.getByTestId("HelpUlaApplicantsPage-video-instructions");
    expect(link).toHaveTextContent("Instructions for preparing your video");
    expect(link).toHaveAttribute("href", VIDEO_INSTRUCTIONS_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(
      screen.getByText(/notices, terms and conditions for ULA applications/),
    ).toBeInTheDocument();
  });

  test("the instructors page ends with Simultaneous Editing for the rankings (issue #279)", async () => {
    renderPage(<HelpInstructorsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Instructors" });

    expectRankingSimultaneousEditingSection(
      "HelpInstructorsPage",
      "If you, or another instructor of the same course, or an admin who teaches it, is ranking the same course at the same time, you may get a warning that looks like this:",
    );
  });

  test("the admins page ends with Simultaneous Editing for the rankings (issue #279)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    expectRankingSimultaneousEditingSection(
      "HelpAdminsPage",
      "If you, or another admin, or an instructor, is ranking the same course at the same time, you may get a warning that looks like this:",
    );
  });

  test("the instructors page explains the Instructor section and the catalog name", async () => {
    renderPage(<HelpInstructorsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Instructors" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Instructor/, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/CONRAD P/)).toBeInTheDocument();
    // Issue #311: the tie warning sits under the tied rows, not under the table.
    expect(
      screen.getByText(
        /a red warning appears directly under the last row of each group of tied candidates/,
        { exact: false },
      ),
    ).toBeInTheDocument();
    // Issue #265: the ranking table opens in the default sort and has a button for it.
    expect(
      screen.getByText(/The table always opens in the default sort/, {
        exact: false,
      }),
    ).toHaveTextContent(
      "by your ranking (1 first, unranked last), then by course preference (first choice, second choice, enthusiastic, then would consider), then in the order the applications were submitted. The Default Sort button returns to it",
    );
    // Issue #312: the ranking table's Columns menu and hide links.
    expect(
      screen.getByTestId("HelpInstructorsPage-ranking-columns"),
    ).toHaveTextContent(
      "The ranking table has a Columns menu, like the other tables, to hide the columns you do not need: untick a column to hide it and tick it again to bring it back, or use Show All and Show None. Each column heading also has a small hide link above it that hides that column. The Ranking, First Name and Last Name columns cannot be hidden, so you can always rank and see whom you are ranking. Your choice is remembered in this browser for all the courses of the recruitment (separately for TA and ULA recruitments). The warning under tied rankings always spans whichever columns are showing.",
    );
    // Issue #364: the home page is one card per quarter, with a TA and/or ULA card per course.
    expect(
      screen.getByTestId("HelpInstructorsPage-home-cards"),
    ).toHaveTextContent(
      "your home page has an Instructor section with one card per quarter, newest first, for each quarter in which you teach a course that is in a TA or ULA recruitment. The card's header is the quarter; under it is a drop-down for each of your courses in that quarter's recruitments (a course in both the TA and the ULA recruitment appears once). Open a course to see its enrollment table (Section, Enrolled, Max, Enrollment Estimate, TA Allocation and ULA Allocation, always all six; the Enrollment Estimate reads TBD until an admin releases the allocations of either recruitment, an Allocation cell reads TBD until that recruitment's allocations are released, and N/A when the course is not in a recruitment of that type), a note where you will one day be able to comment on your allocations, and then a TA card and/or a ULA card: one for each recruitment the course is in, with that recruitment's status and dates.",
    );
    // Issue #410: the card shows the review dates only; the allocation columns are always there.
    expect(
      screen.getByTestId("HelpInstructorsPage-card-dates"),
    ).toHaveTextContent(
      "Each TA or ULA card shows whether applications are open, whether faculty reviews are NotStarted, Open, or Closed, the date reviews were first opened, and the faculty ranking deadline. The application dates themselves (tentative opening, primary consideration, actual opening and closing) are not shown on the card; they are separate from the review dates and status.",
    );
    // Issue #178: what an instructor sees once allocations are shown.
    const allocations = screen.getByTestId("HelpInstructorsPage-allocations");
    expect(allocations).toHaveTextContent(
      "Once an admin lets faculty see a recruitment's allocations, the quarter's Enrollment Estimate and that recruitment's TA Allocation or ULA Allocation in the course's enrollment table change from TBD to the number, and the TA or ULA card gains a small table, also shown at the top of the ranking page: the Hiring Target (how many TAs or ULAs were allocated to the course; the same number as the allocation), the Ranking Target (how many candidates you are asked to rank: twice the hiring target, or every interested candidate if there are fewer), Candidates Ranked so far and Rankings Still Needed. The ranking button sits in the first column of that table.",
    );
    expect(allocations).toHaveTextContent(
      "If you have concerns about your course's target, raise them with the admin once you see it. Until the admin does, nothing about it is shown. The read-only Courses page, listing every course of a recruitment with its instructor, enrollment and meeting times, is being phased out and is no longer linked from the home page.",
    );
    // Issue #364: the Courses button is gone from the home page, so it is no longer described.
    expect(allocations).not.toHaveTextContent(/Courses button/);
    // Issue #366: the all-courses setting is no longer offered, so it is no longer described.
    expect(allocations).not.toHaveTextContent(/all courses to all faculty/);
    expect(screen.getByText(/faculty ranking deadline/)).toBeInTheDocument();
    // Issue #199: interest colours, the not-interested opt-in and cancelled applications.
    const interest = screen.getByTestId("HelpInstructorsPage-interest");
    expect(interest).toHaveTextContent(
      "light green for a first or second choice (marked ➊ or ➋) or Enthusiastic (✓), pale yellow for Would Consider (▬) and pale red for Not Interested/Not Applicable (✖)",
    );
    expect(interest).toHaveTextContent(
      'until you tick Include candidates that marked my course with "Not Interested/Not Applicable" under the table; a red warning then asks you to consider whether you should rank them at all.',
    );
    // Issue #221: the box cannot be cleared while one of those candidates is ranked.
    expect(interest).toHaveTextContent(
      "Once you have ranked one of them, the box stays ticked and cannot be cleared, so a ranked candidate is never hidden; clear that ranking and you can untick it again.",
    );
    expect(interest).toHaveTextContent(
      "the Cancelled applications table at the bottom of the page lists them with their reason",
    );
    // Issue #180: the published assignments page.
    const assignments = screen.getByTestId("HelpInstructorsPage-assignments");
    expect(assignments).toHaveTextContent(
      "the recruitment's TA or ULA card, in each of your courses, gains an Assignments Published badge and an Assignments button. The page it opens is read-only and covers every course in the recruitment, not just yours",
    );
    expect(assignments).toHaveTextContent(
      "not just yours: choose One Row per course to see each course with its instructor and the TAs (or ULAs) assigned to it, or One Row per TA/ULA to see each person with their course. Either view can be saved as a CSV file with the Download CSV buttons.",
    );
  });

  test("the admins page explains the interest colours and cancelled applications (issue #199)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const cells = screen.getByTestId("HelpAdminsPage-interest-cells");
    expect(cells).toHaveTextContent(
      "Each lecture's ranking cell is right-aligned and coloured by the applicant's own interest in that lecture: light green for a first or second choice (marked ➊ or ➋) or Enthusiastic (✓), pale yellow for Would Consider (▬) and pale red for Not Interested/Not Applicable (✖)",
    );
    expect(cells).toHaveTextContent(
      "the Cancelled applications table at the bottom of the page lists them with their reason.",
    );
    expect(
      screen
        .getByTestId("HelpAdminsPage-assignments")
        .compareDocumentPosition(cells) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the admins page explains the prerequisites of releasing hiring decisions and the Tentative note (issue #237)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const release = screen.getByTestId(
      "HelpAdminsPage-release-hiring-decisions",
    );
    expect(release.id).toBe("release-hiring-decisions");
    expect(release).toHaveTextContent(
      "Releasing hiring decisions has three prerequisites, checked in this order: faculty ranking is closed, applications are closed, and at least one candidate is assigned to a course.",
    );
    expect(release).toHaveTextContent(
      "“Close Faculty Ranking before releasing hiring decisions.”, and nothing is published; the Yes button is greyed out when the card already shows that ranking or applications are open. Taking published assignments back is never refused.",
    );
    expect(release).toHaveTextContent(
      "Tentative; part of the hiring process has been reopened. When both are closed again the note goes away. Nothing is ever marked final, since reopening is always possible.",
    );
    expect(
      screen
        .getByTestId("HelpAdminsPage-publish-assignments")
        .compareDocumentPosition(release) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the admins page explains publishing assignments (issue #180)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const publish = screen.getByTestId("HelpAdminsPage-publish-assignments");
    expect(publish.id).toBe("publish-assignments");
    expect(publish).toHaveTextContent(
      "the top of the recruitment's Assignments page, where the assignments are made, has Publish Assignments. It asks you to confirm: publishing creates a read-only Assignments page for admins and faculty",
    );
    // Issue #358 follow-up: the panel moved from the bottom of the Courses edit page.
    expect(publish).toHaveTextContent(
      "Once published, the top of the Assignments page says so instead, with a link to the published page; the recruitment card shows an Assignments Published badge beside its View Assignments button",
    );
    // Issue #317: the button is View Assignments, and it is there before publishing too.
    expect(publish).not.toHaveTextContent("Published Assignments button");
    expect(publish).toHaveTextContent(
      "button (instructors see an Assignments button on their card), and publishing is written to the recruitment's change history.",
    );
    expect(publish).not.toHaveTextContent("Courses page");
    expect(publish).toHaveTextContent(
      "Assignments can still be changed afterwards, and the page always shows the current ones, but it is best to wait until most are settled.",
    );
    expect(publish).toHaveTextContent("Download CSV (row per student)");
    expect(
      document.getElementById("assignments").compareDocumentPosition(publish) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const buttons = screen.getByTestId("HelpAdminsPage-recruitment-buttons");
    const published = [...buttons.querySelectorAll("li")].find((li) =>
      li.textContent.startsWith("View Assignments."),
    );
    expect(published).toHaveTextContent(
      "until Publish Assignments has been clicked at the top of the Assignments page it says the assignments are not published yet",
    );
    expect(
      within(published).getByRole("link", { name: "publishing" }),
    ).toHaveAttribute("href", "#publish-assignments");
    expect(
      [...buttons.querySelectorAll("li")].some((li) =>
        li.textContent.startsWith("Published Assignments."),
      ),
    ).toBe(false);
  });

  test("the admins page explains the Budget for Quarter page and its three lines", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const heading = document.getElementById("budget");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveTextContent("Budget for Quarter");
    // The menu table's anchor, the hiring-target paragraph's pointer (issue #358), then the
    // section's link to the page itself, then the Combined Allocation page's pointer.
    expect(
      screen
        .getAllByRole("link", { name: "Budget for Quarter" })
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "#budget",
      "/#budget",
      "/admin/budget/selectQuarter",
      "/#budget",
    ]);
    expect(
      screen.getByText(
        /where the hiring for the quarter is planned holistically/,
      ),
    ).toBeInTheDocument();
    // Issue #358, part 3: the hiring targets are entered here; the allocations are adjusted on the
    // Combined Allocation page.
    expect(heading.nextElementSibling).toHaveTextContent(
      "The hiring targets of both recruitments are entered here, beside what has been allocated to courses so far; when the two do not agree, the page says so and links to that recruitment's Courses page. The allocations themselves are adjusted on the Combined Allocation page, which the Combined allocations link at the top of the Budget page opens.",
    );
    const lines = screen.getByTestId("HelpAdminsPage-budget-lines");
    expect(lines.id).toBe("budget-lines");
    expect(lines).toHaveTextContent(
      "any of the three may be zero in a given quarter. The other funds available for ASEs, such as gift funds, are a fourth line, counted with the three in the total funds. For planning, the restricted money is spent first",
    );
    // Issue #388: the cost per ULA is computed, and the other funds count in the total.
    expect(heading.nextElementSibling).toHaveTextContent(
      "the estimated cost per ULA per quarter, which is not entered but computed, the rate times the hours",
    );
    // Issue #384: a new quarter's budget is copied from the most recent earlier quarter's.
    expect(heading.nextElementSibling).toHaveTextContent(
      "A new quarter's budget starts as a copy of the most recent earlier quarter's: its costs, funds and conversion factor, and each recruitment's hiring target from the same type of recruitment in that quarter; change whatever differs.",
    );
    // Issue #391: the Audit Trail card of the hiring targets.
    expect(heading.nextElementSibling).toHaveTextContent(
      "At the bottom of the page, a closed Audit Trail card (“Track changes to hiring targets”) opens to list every change to the quarter's TA and ULA hiring targets, newest first, with who made it, the old and new values and the Type of recruitment; the same rows appear in each recruitment's own change history.",
    );
    expect(lines).toHaveTextContent(
      "its estimated cost per position (for ULAs, the computed rate times hours), the funds are the four lines added",
    );
    expect(lines).toHaveTextContent(
      "the bottom line is funds minus expenses, shown green with a plus sign when there is money to spare, red with a minus sign when the plan is over budget, and black when it comes out even.",
    );
    expect(
      heading.compareDocumentPosition(document.getElementById("recruitments")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the admins page describes the Combined Allocation page, its columns and the conversion factor (issue #358)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const heading = document.getElementById("combined-allocations");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveTextContent("Combined Allocation page");
    const page = screen.getByTestId("HelpAdminsPage-combined-allocations");
    expect(page).toHaveTextContent("/admin/allocations/QXX");
    expect(page).toHaveTextContent(
      "a section that is in both recruitments is one row, found by its enroll code",
    );
    expect(page).toHaveTextContent(
      "is the section's one estimate for the quarter, kept once and shared by the TA and ULA recruitments, and every ratio on the page uses it",
    );
    expect(page).toHaveTextContent(
      "whichever recruitment's row the page saves it under, both recruitments see the same value",
    );
    expect(page).toHaveTextContent(
      "is where a quarter's enrollment estimates and its TA and ULA allocations are edited, side by side. You reach it from the Allocate TA and ULA slots to Courses button on the quarter's card on your home page (Allocate TA slots to Courses or Allocate ULA slots to Courses when the quarter has one recruitment), from the Allocations link of step 3 and the (see allocations) link of step 5 of each recruitment card's diagram, from the Combined allocations link at the top of the Budget for Quarter page, and from the pointer on each recruitment's view-only Courses page.",
    );
    expect(page).toHaveTextContent(
      "Allocation (how many TAs or ULAs of that recruitment the section gets; a whole number, saved as you type it, against the recruitment of that type)",
    );
    expect(page).toHaveTextContent(
      "against the recruitment of that type), Unrounded Allocation, Delta and the TA:student or ULA:student ratio, so a quarter with only one recruitment shows only that type's columns.",
    );
    // Issue #358, part 3: the guide columns are explained here now, not in the Courses section.
    const guide = screen.getByTestId(
      "HelpAdminsPage-combined-allocations-guide",
    );
    expect(guide).toHaveTextContent(
      "Those three columns guide the allocation of each type: Unrounded Allocation is how many positions each section would get if positions could be split into fractions and were shared out by enrollment estimate alone (hover its heading for the note); Delta is that share minus the allocation, green with a plus sign when a section is owed positions and red when it has more than its share; and the TA:student (or ULA:student) ratio is the estimated students per position, 1:N, a dash when there is no estimate or no positions.",
    );
    expect(page.nextElementSibling).toBe(guide);
    expect(page).toHaveTextContent("Delta");
    expect(page).toHaveTextContent("TA:student or ULA:student ratio");
    const columns = screen.getByTestId(
      "HelpAdminsPage-combined-allocations-columns",
    );
    ["TA Rankings", "ULA Rankings", "Email", "Status", "Max"].forEach((name) =>
      expect(columns).toHaveTextContent(name),
    );
    expect(columns).toHaveTextContent(
      "The table also has the descriptive columns of the Courses pages: TA Rankings and ULA Rankings",
    );
    expect(columns).toHaveTextContent(
      "A column that starts with TA is not shown when the quarter has no TA recruitment, and one that starts with ULA is not shown when it has no ULA recruitment.",
    );
    expect(columns).toHaveTextContent(
      "just wide enough for the longest CMPSC course number, 11 characters (such as CMPSC 190DD)",
    );
    expect(columns).toHaveTextContent(
      "Each type's Allocation, Unrounded Allocation and Delta headings are stacked, TA or ULA over the other words in smaller type",
    );
    expect(columns).toHaveTextContent("Summer Session");
    expect(columns).toHaveTextContent("Total Course Count");
    expect(page).toHaveTextContent(
      "whichever recruitment's row the page saves it under, both recruitments see the same value",
    );
    expect(columns).toHaveTextContent("Show All, Show None");
    expect(columns).toHaveTextContent(
      "remembered in this browser, separately for each quarter",
    );
    const controls = screen.getByTestId(
      "HelpAdminsPage-combined-allocations-controls",
    );
    expect(controls).toHaveTextContent(
      "Above the table are two controls. Set enrollment estimates from: max, actual sets every section's Enrollment Estimate",
    );
    expect(controls).toHaveTextContent("in every recruitment of the quarter");
    expect(controls).toHaveTextContent("Auto assign TA allocations");
    expect(controls).toHaveTextContent("Auto assign ULA allocations");
    expect(controls).toHaveTextContent(
      "hover one for its note, Automatically allocate the N TAs across courses based on enrollment)",
    );
    // Issue #358, part 3: the algorithm and the purpose, moved from the Courses section.
    expect(controls).toHaveTextContent(
      "When there are at least as many positions as sections, every section gets at least one, and the rest are given out one at a time to the section furthest under its share, so that the biggest gap between any section's allocation and its share is as small as it can be. When there are fewer positions than sections, each section gets its share rounded",
    );
    expect(controls).toHaveTextContent(
      "The purpose of this feature is to give admins a way to make a first-cut allocation based on enrollment, as close to fair as the numbers allow; it should not necessarily be considered the final allocation. Admins have the flexibility to adjust it up or down based on the particular needs of specific courses and other relevant factors.",
    );
    expect(controls).toHaveTextContent(
      "The total hiring target of each recruitment is not entered here: it is on the Budget for Quarter page.",
    );
    const both = screen.getByTestId("HelpAdminsPage-combined-allocations-both");
    expect(both).toHaveTextContent("Cost per TA");
    expect(both).toHaveTextContent("Cost per ULA");
    expect(both).toHaveTextContent("TA Cost/ULA Cost");
    expect(both).toHaveTextContent(
      "Nominal TA to ULA conversion factor, which is 3 until you change it. It must be greater than zero",
    );
    expect(
      screen.getByTestId("HelpAdminsPage-conversion-factor"),
    ).toHaveTextContent(
      "When computing overall ASE:Student ratio, how many ULAs count as 1 TA? You can set this to the ratio of their costs (computed above), or the ratio of the number of hours they put in (20 for TAs vs. 10 for ULAs) or whatever basis makes the most sense.",
    );
    expect(both).toHaveTextContent("ASE:Student Ratio");
    expect(
      document.getElementById("budget").compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the developer page explains the Developer Mode switch (issue #217, moved by #266)", async () => {
    renderPage(<HelpDeveloperPage />);
    await screen.findByRole("heading", { level: 1, name: "For Developers" });

    const heading = document.getElementById("developer-mode");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveTextContent("Developer Mode");
    const section = screen.getByTestId("HelpDeveloperPage-developer-mode");
    expect(section).toHaveTextContent(
      "is a switch for test instances only. It exists only where the instance was started with ENABLE_DEVELOPER_MODE=true;",
    );
    expect(section).toHaveTextContent(
      "a red Developer Mode badge appears in the footer of every page, for everyone,",
    );
    expect(section).toHaveTextContent(
      "Page-specific controls for creating that data appear in the footer too, in red, just to the left of the badge, and never among the page's own buttons.",
    );
    expect(section).toHaveTextContent(
      "Flipping the switch is not recorded in any change history.",
    );
    expect(
      screen
        .getAllByRole("link", { name: "Developer Mode" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#developer-mode", "/admin/developer-mode"]);
    // Issue #266: the Admin page no longer carries these sections.
    // Issue #218: the Auto Create Recruitments button.
    const autoCreate = screen.getByTestId(
      "HelpDeveloperPage-auto-create-recruitments",
    );
    expect(autoCreate).toHaveTextContent(
      "While developer mode is on, the footer of the home page has a red Auto Create Recruitments button. It proposes the quarter after the current one, skipping Summer (and lets you pick another: the four quarters before the current one up to the next one, or the next two in Spring, since only those have courses to fill in),",
    );
    expect(autoCreate).toHaveTextContent(
      "with the tentative opening date a week from today and the primary consideration date a week after that. If both exist already there is nothing to create.",
    );
    expect(autoCreate).toHaveTextContent(
      "If both exist already there is nothing to create. Create Recruitments then creates them exactly as the Create New Recruitment button would,",
    );
    expect(autoCreate).toHaveTextContent(
      "nothing is opened, and no hiring target is set.",
    );
    expect(
      heading.compareDocumentPosition(autoCreate) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #225: the Fake Hiring Targets and Allocations button.
    const fake = screen.getByTestId("HelpDeveloperPage-fake-allocations");
    expect(fake).toHaveTextContent(
      "While developer mode is on, the footer of a recruitment's Courses page has a Fake Hiring Targets and Allocations button.",
    );
    expect(fake).toHaveTextContent(
      "one position per course unless you choose another number, up to three per course",
    );
    expect(fake).toHaveTextContent(
      "from the schedule's maximum enrollment, from current enrollment, or leaves the ones already entered",
    );
    expect(fake).toHaveTextContent(
      "auto-assigns the allocations across the courses, exactly as the Combined Allocation page's Auto assign allocations button does.",
    );
    expect(fake).toHaveTextContent(
      "A checkbox, ticked by default, also sets allocation visibility to Faculty see their own courses, recorded in the change history like any other visibility change.",
    );
    // Issue #358: the same button on the Combined Allocation page, for both recruitments.
    expect(fake).toHaveTextContent(
      "The footer of the Combined Allocation page (/admin/allocations/QXX) has the same button for the whole quarter: its modal has a hiring target box for each of the quarter's recruitments that has a course (TA hiring target, ULA hiring target), and one click does the above for both, with the same estimate source and visibility choice.",
    );
    expect(
      autoCreate.compareDocumentPosition(fake) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #220: the Create Fake Rankings button; issue #385 moved it to the Assignments page.
    const rankings = screen.getByTestId("HelpDeveloperPage-fake-rankings");
    expect(rankings).toHaveTextContent(
      "While developer mode is on, the footer of a recruitment's Assignments page (/admin/recruitments/:id/assignments) has a red Create Fake Rankings button. That is the only page in the app with it: until issue #385 it was on the Courses edit page, and the Combined Allocation page had a version that ranked the quarter's TA and ULA recruitments at once, which was removed; fake rankings are added to each recruitment separately. It can be used only while the recruitment's faculty ranking is Open, the only time instructors rank, and the recruitment has at least one course on offer.",
    );
    expect(rankings).not.toHaveTextContent("Courses page also has");
    // Issue #385's new criterion: no whole-quarter button on the Combined Allocation page.
    expect(rankings).not.toHaveTextContent(
      "has the same button for the whole quarter",
    );
    // The tooltip's words, exactly as the button says them.
    expect(rankings).toHaveTextContent(
      'Otherwise the button is a grey outline, and hovering over it says what must happen first: "Faculty ranking must be Open for this recruitment; it is not started. Open it from the recruitment\'s card on the home page (Recruitment Steps, step 6: Open Faculty Ranking), which asks for a faculty ranking deadline." or "The recruitment must have at least one course on offer to rank; it has none. Fill its course list with Populate on its Courses page." (both, when both apply).',
    );
    expect(rankings).toHaveTextContent(
      "The job ranks the recruitment's applicants, so when there are none the modal adds: \"This recruitment has no applicants yet, so the job would rank nobody. Create fake applications on the recruitment's Applications page first.\"",
    );
    expect(rankings).toHaveTextContent(
      "for every course that has no rankings yet or for a random part of them.",
    );
    // Issue #414: ranked by interest tier, Would Consider only to fill the target.
    expect(rankings).toHaveTextContent(
      "Each course gets as many interested candidates as its ranking target asks for, ranked by interest tier as an instructor would (issue #414): applicants whose first choice the course is come first, then second choice, then Enthusiastic, then Would Consider, in a random order within each tier.",
    );
    expect(rankings).toHaveTextContent(
      "The target is filled from the top tiers down, so Would Consider applicants are ranked only when the first three tiers together hold fewer applicants than the target, and only enough of them to make up the difference.",
    );
    expect(rankings).toHaveTextContent(
      "A checkbox also ranks one or two applicants who did not express interest; they go last, after every interested applicant.",
    );
    expect(rankings).toHaveTextContent(
      "Courses that already have rankings are never changed.",
    );
    expect(
      fake.compareDocumentPosition(rankings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      document
        .getElementById("developer-info")
        .compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the admins page no longer carries the Developer sections, and points to their page (issue #266)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });
    ["jobs", "developer-info", "developer-mode"].forEach((id) =>
      expect(document.getElementById(id)).toBeNull(),
    );
    expect(screen.queryByTestId("HelpAdminsPage-developer-mode")).toBeNull();
    expect(
      screen.queryByTestId("HelpAdminsPage-auto-create-recruitments"),
    ).toBeNull();
    expect(screen.queryByTestId("HelpAdminsPage-fake-allocations")).toBeNull();
    expect(screen.queryByTestId("HelpAdminsPage-fake-rankings")).toBeNull();
    expect(
      screen.getByTestId("HelpAdminsPage-developer-help"),
    ).toHaveTextContent(
      "The Developer menu and Developer Mode are described on their own page, For Developers.",
    );
    expect(
      screen.getByRole("link", { name: "For Developers" }),
    ).toHaveAttribute("href", "/help/developer");
  });

  test("the developer page explains where the Courses columns are kept and how the instructor rule is enforced (issue #300)", async () => {
    renderPage(<HelpDeveloperPage />);
    await screen.findByRole("heading", { level: 1, name: "For Developers" });

    const text = screen.getByTestId("HelpDeveloperPage-courses-columns");
    expect(text).toHaveTextContent("browser's local storage");
    expect(text).toHaveTextContent("recruitmentCourses.hiddenColumns.<id>");
    expect(text).toHaveTextContent(
      "GET /api/instructor/recruitments/:id/courses",
    );
    expect(text).toHaveTextContent(
      "enrollmentEstimate, allocation and unroundedAllocation are left out of the JSON unless the recruitment's allocation visibility is ALL_COURSES (a value that still exists in the backend but is no longer selectable in the user interface, issue #366), and the table omits the matching columns (AllocationsRelatedColumns) instead of hiding them.",
    );
    // Issue #358, part 3: the admin's own pages omit them too.
    expect(text).toHaveTextContent(
      "Since issue #358 the admin's own view-only and edit pages omit those five columns too (omitColumns, and adminColumnChoices leaves them out of the Columns menu): the admin edits them on the Combined Allocation page, and the faculty Courses page is the only table that still shows them, as text.",
    );
  });

  test("the developer page explains simultaneous editing under the hood, with a table of where it is used (issue #273)", async () => {
    renderPage(<HelpDeveloperPage />);
    await screen.findByRole("heading", { level: 1, name: "For Developers" });

    // Pointed to from the top, and a section of its own.
    expect(screen.getByTestId("HelpDeveloperPage-more")).toHaveTextContent(
      "Not on the menu, but for developers: Simultaneous Editing explains, under the hood,",
    );
    expect(
      screen.getByRole("link", { name: "Simultaneous Editing" }),
    ).toHaveAttribute("href", "#simultaneous-editing");
    const heading = document.getElementById("simultaneous-editing");
    expect(heading.tagName).toBe("H2");
    expect(heading.textContent).toBe("Simultaneous Editing");

    const text = (id) =>
      screen.getByTestId(`HelpDeveloperPage-simultaneous-${id}`).textContent;
    // The two mechanisms and where the design is written down.
    expect(text("editing")).toMatch(/version check/);
    expect(text("editing")).toMatch(/multi-tab warning/);
    expect(text("editing")).toMatch(
      /docs\/design\/ConcurrentEditMitigationDesign\.md/,
    );
    // The version check.
    expect(text("version")).toMatch(/409 Conflict/);
    expect(text("version")).toMatch(/optimistic locking/);
    // Issue #280: the recruitment-level version of the assignments.
    expect(text("version")).toMatch(/assignmentsVersion/);
    expect(text("version")).toMatch(/assignments_version =/);
    expect(text("version")).toMatch(
      /on every tentative assignment, on publishing or taking back, and on an applicant cancelling/,
    );
    expect(text("version")).toMatch(/without repeating the click/);
    // The client id and the heartbeat.
    expect(text("heartbeat")).toMatch(/crypto\.randomUUID\(\)/);
    expect(text("heartbeat")).toMatch(/X-Client-Id/);
    expect(text("heartbeat")).toMatch(
      /POST \/api\/draftApplications\/heartbeat\?id=/,
    );
    expect(text("heartbeat")).toMatch(
      /changes nothing, not even the draft's version/,
    );
    // The detector and its identity.
    expect(text("detector")).toMatch(/ClientActivityDetector/);
    expect(text("detector")).toMatch(/edu\.ucsb\.cs\.taapply\.concurrency/);
    expect(text("detector")).toMatch(/draft:<draftId>/);
    expect(text("detector")).toMatch(/email \(Full Name\)/);
    expect(text("detector")).toMatch(/one entry for each other person/);
    expect(text("detector")).toMatch(
      /Names are in the body and not in headers/,
    );
    expect(text("detector")).toMatch(/200 characters/);
    expect(text("detector")).toMatch(/never as markup/);
    // The "already" form and the admin audience (issue #298).
    expect(text("detector")).toMatch(/who is already there/);
    expect(text("detector")).toMatch(/A already has this page open/);
    expect(text("detector")).toMatch(/A and B already have this page open/);
    expect(text("detector")).toMatch(/audience/);
    expect(text("detector")).toMatch(
      /only one admin edits this page at a time/,
    );
    // Authorization.
    expect(text("authorization")).toMatch(/before it records the caller/);
    expect(text("authorization")).toMatch(/403/);
    expect(text("authorization")).toMatch(
      /Every future use must make the same check first/,
    );
    // The goodbye (issue #284).
    expect(text("goodbye")).toMatch(
      /POST \/api\/draftApplications\/leave\?id=/,
    );
    expect(text("goodbye")).toMatch(/pagehide/);
    expect(text("goodbye")).toMatch(/unmounts/);
    expect(text("goodbye")).toMatch(/keepalive: true/);
    expect(text("goodbye")).toMatch(/sendBeacon/);
    expect(text("goodbye")).toMatch(/pageshow/);
    expect(text("goodbye")).toMatch(/Delivery is not guaranteed/);
    // The words run together right, across the elements they are built from.
    for (const phrase of [
      "says so, with POST /api/draftApplications/leave?id= and the same X-Client-Id, so that",
      "(not beforeunload or unload,",
      "It uses fetch with keepalive: true, not sendBeacon,",
      "After pagehide the tab stops its heartbeats",
      "(pageshow with persisted), it announces",
    ]) {
      expect(text("goodbye")).toContain(phrase);
    }
    // The modal and how the newer tab is chosen.
    expect(text("detector")).toMatch(/newest/);
    expect(text("detector")).toMatch(/arrivedAtMillis/);
    expect(text("modal")).toMatch(/arrived after every other active client/);
    expect(text("modal")).toMatch(/ordered by their identifiers/);
    expect(text("modal")).toMatch(/Leave this page/);
    expect(text("modal")).toMatch(
      /Wait for the other tabs or windows to close, then resume here/,
    );
    expect(text("modal")).toMatch(/Continue anyway/);
    for (const phrase of [
      "The answer says newest and arrivedAtMillis.",
      "with three choices: Leave this page (says goodbye",
      "window.close()), Wait for the other tabs or windows to close, then resume here (the page stays covered",
    ]) {
      expect(text("modal")).toContain(phrase);
    }
    expect(text("modal")).toMatch(/older tabs keep only the banner/);
    expect(text("modal")).toMatch(/Enter is ignored for the first second/);
    // Timing, and its two environment variables.
    expect(text("timing")).toMatch(/15 seconds by default/);
    expect(text("timing")).toMatch(/about 15 to 20 seconds/);
    const timingRows = [
      ...screen
        .getByTestId("HelpDeveloperPage-simultaneous-timing-table")
        .querySelectorAll("tbody tr"),
    ].map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
    expect(timingRows).toEqual([
      [
        "CLIENT_HEARTBEAT_INTERVAL_SEC",
        "5",
        "How often an open tab sends a heartbeat.",
      ],
      [
        "CLIENT_TIMEOUT_MISSED_HEARTBEATS",
        "3",
        "A tab is considered gone after this many heartbeat intervals with no word from it.",
      ],
    ]);
    expect(text("limits")).toMatch(/one server process only/);
    expect(text("limits")).toMatch(/hidden tabs/);
    expect(text("limits")).not.toMatch(/CONCURRENCY_WINDOW_SECONDS/);
    // Issue #281: the refresh that keeps recruitment state fresh, in place of a warning.
    expect(text("refresh")).toMatch(
      /no version check, no detector and no banner/,
    );
    expect(text("refresh")).toMatch(/without a page reload/);
    expect(text("refresh")).toMatch(/a repeated Close does not stamp/);
    expect(text("refresh-how")).toMatch(/useRefreshingBackend/);
    expect(text("refresh-how")).toMatch(/refetchInterval/);
    expect(text("refresh-how")).toMatch(/freshly drawn random time/);
    expect(text("refresh-how")).toMatch(/uniform between base minus jitter/);
    expect(text("refresh-how")).toMatch(/synchronized waves of requests/);
    expect(text("refresh-how")).toMatch(/nextRefreshMs\(timing, random\)/);
    expect(text("refresh-how")).toMatch(/even one who is also an instructor/);
    expect(text("refresh-how")).toMatch(/hidden tab does not refresh/);
    const refreshTable = screen.getByTestId(
      "HelpDeveloperPage-simultaneous-refresh-table",
    );
    expect(
      [...refreshTable.querySelectorAll("tbody tr")].map((tr) =>
        [...tr.querySelectorAll("td")].map((td) => td.textContent),
      ),
    ).toEqual([
      ["ADMIN_REFRESH_SEC", "5", "Mean seconds between refreshes for admins."],
      [
        "ADMIN_REFRESH_JITTER",
        "3",
        "Admins wait uniformly between 5 - 3 and 5 + 3 seconds (2 to 8).",
      ],
      [
        "NON_ADMIN_REFRESH",
        "15",
        "Mean seconds between refreshes for instructors and students.",
      ],
      [
        "NON_ADMIN_JITTER",
        "5",
        "Instructors and students wait uniformly between 15 - 5 and 15 + 5 seconds (10 to 20).",
      ],
    ]);
    expect(text("refresh-rules")).toMatch(
      /below 1 second is replaced by its default/,
    );
    expect(text("refresh-rules")).toMatch(/larger than its mean/);
    expect(text("refresh-rules")).toMatch(
      /no wait is ever shorter than 1 second/,
    );
    expect(text("refresh-deploy")).toMatch(/build-time variables only/);
    expect(text("refresh-deploy")).toMatch(/\/api\/systemInfo/);
    expect(text("refresh-deploy")).toMatch(
      /restart the server: no rebuild is needed/,
    );
    expect(text("refresh-pages")).toMatch(/HOME_PAGE_QUERY_KEYS/);
    expect(text("refresh-pages")).toMatch(
      /\/api\/admin\/recruitments\/\{id\}\/steps/,
    );
    expect(text("refresh-pages")).toMatch(
      /faculty ranking page's header state/,
    );
    expect(text("refresh-pages")).toMatch(/never asks an admin endpoint/);
    expect(text("refresh-input")).toMatch(
      /never replaces what a person is typing/,
    );
    expect(text("refresh-input")).toMatch(/no longer be submitted/);
    // Issue #282: the Instructors and Courses pages.
    expect(text("refresh-admin-pages")).toMatch(
      /refresh instead of warning, with the same hook/,
    );
    expect(text("refresh-admin-pages")).toMatch(
      /\/api\/admin\/instructors\/get/,
    );
    expect(text("refresh-admin-pages")).toMatch(/\/api\/courses\/all/);
    expect(text("refresh-admin-pages")).toMatch(
      /\/api\/recruitmentcourses\/all/,
    );
    expect(text("refresh-admin-pages")).toMatch(/guarded by a warning instead/);
    expect(text("refresh-admin-pages")).toMatch(
      /only the view-only page refreshes in the background; the edit page does not/,
    );
    expect(text("refresh-admin-pages")).toMatch(
      /Catalog Name dropdown keeps showing what it showed/,
    );

    // Only what has landed is in the table.
    const table = screen.getByTestId("HelpDeveloperPage-simultaneous-table");
    expect(
      [...table.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual(["Page", "Scope", "Key", "PR"]);
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(9);
    expect(
      [...rows[0].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Application form draft",
      "One applicant's draft for one recruitment",
      "draft:<draftId>",
      "#283, #285",
    ]);
    expect(text("editing")).toMatch(
      /the assignments page, the Budget page and the Courses edit page use them/,
    );
    expect(text("compare")).toMatch(/expected/);
    expect(text("compare")).toMatch(/409 Conflict/);
    expect(text("compare")).toMatch(/Use theirs and Overwrite/);
    expect(text("compare")).toMatch(
      /otherwise nothing changes and the answer is 409 Conflict with the current value/,
    );
    expect(text("compare")).toMatch(/and offers Use theirs and Overwrite/);
    expect(rows[0].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/283",
    );
    expect(rows[0].querySelectorAll("a")[1]).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/285",
    );
    // Issue #281: a refresh, so no key.
    expect(
      [...rows[1].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Recruitment settings and steps, for admins, instructors and students",
      "Background refresh; no warning, no version check, no detector",
      "None (refresh, not a key)",
      "#286",
    ]);
    expect(rows[1].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/286",
    );
    // Issue #279: faculty rankings.
    expect(
      [...rows[2].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Faculty rankings",
      "One recruitment course's ranking list",
      "ranking:<recruitmentCourseId>",
      "#287",
    ]);
    expect(rows[2].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/287",
    );
    // Issue #302: a submitted application, edited by its applicant or by an admin.
    expect(
      [...rows[3].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Student apply page when editing a submitted application, and the Admin application edit page",
      "One application, edited by its applicant or by an admin",
      "application:<applicationId>",
      "#308",
    ]);
    expect(rows[3].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/308",
    );
    // Issue #280: the whole assignments page.
    expect(
      [...rows[4].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Assignments (admin)",
      "The whole assignments page for one recruitment",
      "assignments:<recruitmentId>",
      "#289",
    ]);
    expect(rows[4].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/289",
    );
    // Issue #277: the Budget page.
    expect(
      [...rows[5].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Budget",
      "One quarter's budget (compare-and-set for a recruitment's hiring target, keyed recruitment:<id>)",
      "budget:<quarter>",
      "#290",
    ]);
    expect(rows[5].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/290",
    );
    // Issue #278: the Courses edit page.
    expect(
      [...rows[6].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Courses edit page (Populate, Remove, visibility; the allocations and estimated enrollments are edited under this key from the Combined Allocation page); the view-only page never warns",
      "The whole edit page for one recruitment",
      "courses-edit:<recruitmentId>",
      "#288",
    ]);
    expect(rows[6].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/288",
    );
    // Issue #358: the Combined Allocation page, under the edit pages' keys.
    expect(
      [...rows[7].querySelectorAll("td")].map((td) =>
        td.textContent.replace(/\s+/g, " "),
      ),
    ).toEqual([
      "Combined Allocation page (allocations and estimates of both recruitments of a quarter)",
      "The Courses edit page of every recruitment of the quarter: one heartbeat per recruitment under that page's key, with one client id, so the combined page and the edit pages warn each other",
      "courses-edit:<recruitmentId> (one per recruitment)",
      "#373",
    ]);
    expect(rows[7].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/373",
    );
    // Issue #282: also a refresh, so no key.
    expect(
      [...rows[8].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Instructors page and the view-only Courses page",
      "Background refresh plus a refetch after each save; no warning, no version check, no detector",
      "None (refresh, not a key)",
      "#291",
    ]);
    expect(rows[8].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/291",
    );
    // Issue #358: the Combined Allocation page's paragraph follows the Courses pages'.
    const combined = text("combined");
    expect(combined.replace(/\s+/g, " ")).toBe(
      "The Combined Allocation page (issue #358). /admin/allocations/QXX edits the same allocations and estimates as the Courses edit pages of the quarter's TA and ULA recruitments, so it has no key of its own: it heartbeats POST /api/recruitmentcourses/heartbeat?recruitmentId= once for each recruitment of the quarter (two heartbeats when it has both), under that page's key courses-edit:<recruitmentId>, with one X-Client-Id for both (useClientActivity takes a clientId to share), and says goodbye at /leave for each. So the combined page and the edit pages warn each other about the same allocations. The two answers are put together by mergeStandings: everyone named by either, each person once; the tab is the newest only if both say so, so of two tabs that share a recruitment only the later one is asked and none waits on another that waits on it; and the arrival is the later of the two. The banner and the modal use the noun \"quarter's allocations\"; Leave this page goes to the quarter's Budget page. The allocation, estimate, fill-estimates and Auto Allocate saves name the tab; the conversion factor save, which is PUT /api/admin/budget, does not, because the page does not heartbeat budget:<quarter>: that field is guarded by a version check of its own (the budget row's conversionVersion, issue #375, counted apart from the version of the three budget lines, so the two pages never refuse each other's saves), and a save that named a tab the Budget page never hears a heartbeat from would make that page warn about a tab that is not there.",
    );
    expect(
      screen.getByTestId("HelpDeveloperPage-simultaneous-courses")
        .nextElementSibling,
    ).toBe(screen.getByTestId("HelpDeveloperPage-simultaneous-combined"));
    const courses = text("courses");
    expect(courses.replace(/\s+/g, " ")).toBe(
      `The Courses pages. A recruitment's Courses page is split in two. The view-only page (/admin/recruitments/:id/courses) is the default, edits nothing, and neither heartbeats nor warns. The edit page (/admin/recruitments/:id/courses/edit) heartbeats POST /api/recruitmentcourses/heartbeat?recruitmentId=, says goodbye at /leave, and shows the banner and the modal with the noun "page"; Leave this page goes to the view-only page. Since issue #358 the edit page keeps Populate, Add by enroll code, Remove and allocation visibility, none of which name the tab (the hiring target is on the Budget page and Publish Assignments on the Assignments page); the allocation, estimate, fill-estimates and Auto Allocate saves, which name the tab in the X-Client-Id header, are made from the Combined Allocation page (next) under this same key. Only an admin may heartbeat, and the recruitment must exist, before anything is recorded. The version check is not a JPA version, since the course refresh also writes the row (and so did the estimates, until issue #363 moved them to budget_courses): a separate allocation_version column on recruitment_courses is counted by each allocation edit, and allocation_bulk_version on recruitments is counted by Auto Allocate. An allocation edit sends both as expectedVersion and expectedBulkVersion and gets 409 when either moved; after a bulk conflict the page reads everything again.`,
    );
    expect(courses).toMatch(/view-only page/);
    expect(courses).toMatch(/\/admin\/recruitments\/:id\/courses\/edit/);
    expect(courses).toMatch(
      /POST \/api\/recruitmentcourses\/heartbeat\?recruitmentId=/,
    );
    expect(courses).toMatch(/Leave this page goes to the view-only page/);
    expect(courses).toMatch(/allocation_version column on recruitment_courses/);
    expect(courses).toMatch(/allocation_bulk_version on recruitments/);
    expect(courses).toMatch(/expectedVersion and expectedBulkVersion/);
    expect(courses).toMatch(/409/);
    expect(text("editing")).toMatch(/and the Courses edit page use them/);
    for (const phrase of [
      "bumped by every rank edit and by the Developer Mode fake rankings job",
      "no row means version 0",
      "a rank save names it as ?version=",
      "single compare-and-set statement",
      "only one is accepted",
      "409 Conflict with the current version",
      "keeps what the instructor typed in its box and offers Save again",
      "never wrongly accepted",
      "an instructor of another course, or an admin who does not teach the course, gets 403 and is neither recorded nor told who is there",
      "ranking:<recruitmentCourseId>",
    ]) {
      expect(text("ranking")).toContain(phrase);
    }
  });

  /** Issue #281: the last section of the admin and instructor pages. */
  test.each([
    [
      "HelpAdminsPage",
      HelpAdminsPage,
      "If you, or another admin, is editing the same thing at the same time, you may get a warning on some pages",
      "about every 5 seconds (somewhere between 2 and 8, chosen at random each time)",
    ],
    [
      "HelpInstructorsPage",
      HelpInstructorsPage,
      "Where a recruitment is in the process",
      "about every 15 seconds (somewhere between 10 and 20, chosen at random each time)",
    ],
  ])(
    "%s ends with a Simultaneous Editing section about the refresh",
    async (page, Page, opening, interval) => {
      renderPage(<Page />);
      const heading = await screen.findByRole("heading", {
        level: 2,
        name: "Simultaneous Editing",
      });
      const root = screen.getByTestId(page);
      const headings = [...root.querySelectorAll("h2")];
      expect(headings[headings.length - 1]).toBe(heading);
      expect(heading).toHaveAttribute("id", "simultaneous-editing");

      const refresh = screen.getByTestId(
        `${page}-simultaneous-editing-refresh`,
      );
      expect(refresh).toHaveTextContent(opening);
      expect(refresh.textContent).toMatch(
        /refreshes by itself|refresh by themselves/,
      );
      expect(refresh).toHaveTextContent(interval);
      expect(refresh).toHaveTextContent("no warning");
      const todo = screen.getByTestId(`${page}-simultaneous-editing-todo`);
      expect(todo).toHaveTextContent("What to do. If a page looks out of date");
      expect(todo).toHaveTextContent(
        "switch back to it and it updates at once",
      );
      expect(todo).toHaveTextContent("reload the page");
      expect(heading.nextElementSibling).toBe(refresh);
      expect(root.lastElementChild).toBe(todo);
    },
  );

  test("the admin section says the Instructors and course pages refresh (issue #282)", async () => {
    renderPage(<HelpAdminsPage />);
    const pages = await screen.findByTestId(
      "HelpAdminsPage-simultaneous-editing-admin-pages",
    );
    expect(pages).toHaveTextContent(
      "the Instructors page and the view-only Courses page: they refresh by themselves every few seconds",
    );
    expect(pages).toHaveTextContent("appears on its own");
    expect(pages).toHaveTextContent("There is no warning for these pages.");
    expect(pages).toHaveTextContent("is not replaced");
    expect(pages).toHaveTextContent(
      "The Courses edit page does not refresh by itself",
    );
    expect(
      screen.getByTestId("HelpAdminsPage-simultaneous-editing-refresh")
        .nextElementSibling,
    ).toBe(pages);
  });

  test("the admin section says what is safe and when about 15 seconds applies", async () => {
    renderPage(<HelpAdminsPage />);
    const safe = await screen.findByTestId(
      "HelpAdminsPage-simultaneous-editing-safe",
    );
    expect(safe).toHaveTextContent(
      "closing applications that are already closed changes nothing",
    );
    expect(safe).toHaveTextContent(
      "a step whose prerequisites are not met is refused",
    );
    expect(safe).toHaveTextContent("it closes itself and tells you");
    expect(safe).toHaveTextContent(
      "A date you are typing is never replaced by a refresh.",
    );
    expect(
      screen.getByTestId("HelpAdminsPage-simultaneous-editing-refresh"),
    ).toHaveTextContent(
      "and so do instructors and students, about every 15 seconds",
    );
  });

  test("the admin section describes editing a student's application (issue #302)", async () => {
    renderPage(<HelpAdminsPage />);
    const note = await screen.findByTestId(
      "HelpAdminsPage-simultaneous-editing-application",
    );
    expect(note).toHaveTextContent(
      "chris@ucsb.edu (Chris Student) already has this application open for editing. We recommend that you wait a few minutes or ask them to close it.",
    );
    expect(note).toHaveTextContent(
      "We recommend that only one admin edits this page at a time.",
    );
    expect(note).toHaveTextContent(
      "Applications of different students never cause a warning.",
    );
    expect(note.nextElementSibling).toBe(
      screen.getByTestId("HelpAdminsPage-simultaneous-editing-assignments"),
    );
  });

  test("the admin section describes the Assignments page's warning, with the shared admin wording, and its version check (issue #280)", async () => {
    renderPage(<HelpAdminsPage />);
    const intro = await screen.findByTestId(
      "HelpAdminsPage-simultaneous-editing-assignments",
    );
    expect(intro).toHaveTextContent(
      "The Assignments page. The whole Assignments page of one recruitment counts as one thing",
    );
    expect(intro).toHaveTextContent(
      "Only one tab or window, and one admin, should have it open at a time.",
    );
    const example = screen.getByTestId(
      "HelpAdminsPage-simultaneous-editing-assignments-example",
    );
    expect(example).toHaveTextContent(
      "phtcon@ucsb.edu (Phill Conrad) is also editing this assignments page. We recommend that only one admin edits this page at a time.",
    );
    expect(example).toHaveClass("alert", "alert-warning");
    // A picture of the warning, not a warning about anything, so it is not announced.
    expect(screen.queryByRole("alert")).toBeNull();
    const detail = screen.getByTestId(
      "HelpAdminsPage-simultaneous-editing-assignments-detail",
    );
    expect(detail).toHaveTextContent(
      "the warning only appears for the Assignments page of the same recruitment",
    );
    expect(detail).toHaveTextContent(
      "Assignments changed while you were working. The page has been refreshed; please check the placement and try again.",
    );
    expect(detail).toHaveTextContent("Your click is not repeated for you.");
    // It sits inside the one Simultaneous Editing section, which still ends the page.
    expect(
      screen.getAllByRole("heading", {
        level: 2,
        name: "Simultaneous Editing",
      }),
    ).toHaveLength(1);
    expect(intro.nextElementSibling).toBe(example);
    expect(example.nextElementSibling).toBe(detail);
    expect(detail.nextElementSibling).toBe(
      screen.getByTestId("HelpAdminsPage-simultaneous-editing-budget"),
    );
  });

  test("the admin section describes the Budget page's warning with the shared admin wording, and its refused saves (issue #277)", async () => {
    renderPage(<HelpAdminsPage />);
    const page = "HelpAdminsPage-simultaneous-editing";
    const intro = await screen.findByTestId(`${page}-budget`);
    expect(intro).toHaveTextContent(
      "The Budget for Quarter page. One quarter's budget counts as one thing.",
    );
    const example = screen.getByTestId(`${page}-budget-example`);
    expect(example).toHaveTextContent(
      "phtcon@ucsb.edu (Phill Conrad) is also editing this budget page. We recommend that only one admin edits this page at a time.",
    );
    expect(example).toHaveClass("alert", "alert-warning");
    expect(screen.queryByRole("alert")).toBeNull();
    const names = screen.getByTestId(`${page}-budget-names`);
    expect(names).toHaveTextContent('up to three and then "and 2 others"');
    expect(names).toHaveTextContent(
      "You are also editing this budget page in another tab or window.",
    );
    expect(names).toHaveTextContent(
      "You and phtcon@ucsb.edu (Phill Conrad) are also editing this budget page in other windows or tabs.",
    );
    expect(names).toHaveTextContent(
      "Two admins on different quarters never see it.",
    );
    expect(names).toHaveTextContent(
      "The tab or window opened last also asks the same question as for rankings (Leave this page, wait, or Continue anyway)",
    );
    expect(names).toHaveTextContent(
      'says "already has" instead of "is also editing"',
    );
    const conflict = screen.getByTestId(`${page}-budget-conflict`);
    expect(conflict).toHaveTextContent(
      "The TAs-only budget was changed in another tab or window. It is now $45,000.00; you entered $40,000.00.",
    );
    expect(conflict).toHaveTextContent(
      "Choose Use theirs to keep what is stored",
    );
    expect(conflict).toHaveTextContent(
      "or Overwrite to save what you typed over it",
    );
    // Still one section, which still ends the page.
    expect(
      screen.getAllByRole("heading", {
        level: 2,
        name: "Simultaneous Editing",
      }),
    ).toHaveLength(1);
    expect(intro.nextElementSibling).toBe(example);
    expect(example.nextElementSibling).toBe(names);
    expect(names.nextElementSibling).toBe(conflict);
    expect(conflict.nextElementSibling).toBe(
      screen.getByTestId(`${page}-courses`),
    );
  });

  test("the admin section covers the view-only and edit Courses pages with the shared admin wording (issue #278)", async () => {
    renderPage(<HelpAdminsPage />);
    const page = "HelpAdminsPage-simultaneous-editing";
    const intro = await screen.findByTestId(`${page}-courses`);
    expect(intro).toHaveTextContent(
      "any number of tabs or windows may show it, for you or for other admins, without any warning",
    );
    expect(intro).toHaveTextContent(
      "Its Edit button, beside the words \u201cClick Edit to: populate the course list, add a lecture by enroll code, remove a course, or release allocations to faculty\u201d, takes you to the edit page, where you use Populate and the other controls; it has a link back to the view-only page. The estimated enrollments and the allocations are edited on the Combined Allocation page, which counts as a tab of this edit page (below).",
    );
    expect(intro).toHaveTextContent(
      "Only one tab or window should have a given recruitment's edit page open at a time, and edit pages of different recruitments never warn each other.",
    );
    const example = screen.getByTestId(`${page}-courses-example`);
    expect(example).toHaveTextContent(
      "phtcon@ucsb.edu (Phill Conrad) is also editing this page. We recommend that only one admin edits this page at a time.",
    );
    expect(example).toHaveClass("alert", "alert-warning");
    expect(screen.queryByRole("alert")).toBeNull();
    const meaning = screen.getByTestId(`${page}-courses-meaning`);
    expect(meaning).toHaveTextContent(
      "use the view-only page in as many tabs as you like",
    );
    expect(meaning).toHaveTextContent(
      "If you go on and change an allocation on the combined page, the system refuses a change made from a copy that is out of date, tells you, and reads the numbers again; whatever you typed there is lost. The tab or window opened last also asks the same question as for rankings",
    );
    expect(meaning).toHaveTextContent(
      "there Leave this page takes you to the view-only Courses page",
    );
    expect(intro).toHaveTextContent(
      "The Courses pages. A recruitment's Courses page comes in two forms. The view-only page",
    );
    expect(meaning).toHaveTextContent(
      "says \u201calready has\u201d instead of \u201cis also editing\u201d",
    );
    // Still one section, which still ends the page.
    expect(
      screen.getAllByRole("heading", {
        level: 2,
        name: "Simultaneous Editing",
      }),
    ).toHaveLength(1);
    expect(intro.nextElementSibling).toBe(example);
    expect(example.nextElementSibling).toBe(meaning);
    expect(meaning.nextElementSibling).toBe(
      screen.getByTestId(`${page}-combined`),
    );
  });

  test("the admin section describes the Combined Allocation page's warning, shared with the edit pages (issue #358)", async () => {
    renderPage(<HelpAdminsPage />);
    const page = "HelpAdminsPage-simultaneous-editing";
    const intro = await screen.findByTestId(`${page}-combined`);
    expect(intro).toHaveTextContent(
      "The Combined Allocation page. The Combined Allocation page edits the same allocations and estimates as the edit pages of the quarter's TA and ULA recruitments, so it counts as having both of those edit pages open.",
    );
    expect(intro).toHaveTextContent(
      "or the edit page of either of its recruitments, you get a warning that looks like this, and so do they:",
    );
    expect(
      within(intro).getByRole("link", { name: "Combined Allocation page" }),
    ).toHaveAttribute("href", "/#combined-allocations");
    const example = screen.getByTestId(`${page}-combined-example`);
    expect(example).toHaveTextContent(
      "phtcon@ucsb.edu (Phill Conrad) is also editing this quarter's allocations. We recommend that only one admin edits this page at a time.",
    );
    expect(example).toHaveClass("alert", "alert-warning");
    expect(screen.queryByRole("alert")).toBeNull();
    const meaning = screen.getByTestId(`${page}-combined-meaning`);
    expect(meaning).toHaveTextContent(
      "It names everyone who has either recruitment's allocations open, each person once.",
    );
    expect(meaning).toHaveTextContent(
      "on this page Leave this page takes you to the quarter's Budget page",
    );
    expect(meaning).toHaveTextContent(
      "The Nominal TA to ULA conversion factor is a budget figure, not an allocation, and is guarded the Budget page's way instead",
    );
    expect(meaning).toHaveTextContent(
      "Having the Budget page open does not by itself cause this warning, nor does the combined page cause the Budget page's.",
    );
    expect(intro.nextElementSibling).toBe(example);
    expect(example.nextElementSibling).toBe(meaning);
    expect(meaning.nextElementSibling).toBe(screen.getByTestId(`${page}-todo`));
    // The page's own section points here, and at the developer buttons.
    const warning = screen.getByTestId(
      "HelpAdminsPage-combined-allocations-warning",
    );
    expect(warning).toHaveTextContent(
      "Only one tab or window should edit a quarter's allocations at a time; the page warns when another one, or either recruitment's Edit Courses page, is open",
    );
    expect(warning).toHaveTextContent(
      "its footer has the Edit Courses page's fake data buttons, acting on both recruitments at once; see Developer Mode on the developer help page.",
    );
    expect(
      within(warning).getByRole("link", { name: "Simultaneous Editing" }),
    ).toHaveAttribute("href", "/#simultaneous-editing");
    expect(
      within(warning).getByRole("link", { name: "Developer Mode" }),
    ).toHaveAttribute("href", "/help/developer#developer-mode");
    expect(
      screen.getByTestId("HelpAdminsPage-combined-allocations-both")
        .nextElementSibling,
    ).toBe(warning);
  });

  test("the developer page starts with a table of every Developer menu option linking to its section (issue #266)", async () => {
    renderPage(<HelpDeveloperPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Developers" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("HelpDeveloperPage-intro")).toHaveTextContent(
      "The Developer menu is offered to admins. For the rest of the admin's handbook, see For Admins.",
    );
    expect(screen.getByRole("link", { name: "For Admins" })).toHaveAttribute(
      "href",
      "/help/admins",
    );
    const table = screen.getByTestId("HelpDeveloperPage-menu");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(
      DEVELOPER_MENU_ENTRIES.length,
    );
    DEVELOPER_MENU_ENTRIES.forEach((entry) => {
      const row = screen.getByTestId(`HelpDeveloperPage-menu-${entry.section}`);
      const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
      expect(cells).toEqual([entry.label, entry.summary]);
      expect(row.querySelector("a")).toHaveAttribute(
        "href",
        `#${entry.section}`,
      );
      const section = document.getElementById(entry.section);
      expect(section.tagName).toBe("H2");
      expect(section.textContent).toBe(entry.label);
    });
    expect(
      screen
        .getAllByRole("link", { name: "Jobs" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#jobs", "/admin/jobs"]);
    expect(
      screen
        .getAllByRole("link", { name: "Developer Info" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#developer-info", "/admin/developer"]);
  });

  test("arriving at the developer page with a hash scrolls to that section (issue #266)", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderPage(<HelpDeveloperPage />, ["/help/developer#developer-mode"]);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Developers" }),
    ).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(
      document.getElementById("developer-mode"),
    );
  });

  test("the admins page starts with a table of every menu option linking to its section", async () => {
    renderPage(<HelpAdminsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Admins" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "The flow of a recruitment",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("HelpAdminsPage-flow").querySelectorAll("li"),
    ).toHaveLength(4);

    const table = screen.getByTestId("HelpAdminsPage-menu");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(
      ADMIN_MENU_ENTRIES.length,
    );
    ADMIN_MENU_ENTRIES.forEach((entry) => {
      const row = screen.getByTestId(`HelpAdminsPage-menu-${entry.section}`);
      const cells = [...row.querySelectorAll("td")].map((td) => td.textContent);
      expect(cells).toEqual([entry.menu, entry.label, entry.summary]);
      const link = row.querySelector("a");
      expect(link).toHaveAttribute("href", `#${entry.section}`);
      // Each option has a section with that id, headed by its name.
      const section = document.getElementById(entry.section);
      expect(section).not.toBeNull();
      expect(section.tagName).toBe("H2");
      expect(section.textContent).toContain(entry.label);
    });
    // The first option's section links to the page it describes.
    expect(
      screen
        .getAllByRole("link", { name: "Users" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#users", "/admin/users"]);
    expect(
      screen
        .getByTestId("HelpAdminsPage-recruitment-buttons")
        .querySelectorAll("li"),
    ).toHaveLength(11);
    expect(
      screen.getByText(/first open stamps the actual opening date/),
    ).toBeInTheDocument();
    // Issue #233: the live Recruitment Steps diagram on each card (nested since issue #379).
    const cardIntro = screen.getByText(/Open, the card shows the recruitment/);
    expect(cardIntro).toHaveTextContent(
      "Open, the card shows the recruitment's dates, and under the dates the live Recruitment Steps diagram (collapsed to a one-line summary on older recruitments, expanded on the latest TA and ULA recruitments).",
    );
    expect(
      within(cardIntro).getByRole("link", { name: "Recruitment Steps" }),
    ).toHaveAttribute("href", "/help/recruitment-steps");
    // Issue #186: the confirmations on the cards link to these two items.
    const openClose = screen.getByTestId(
      "HelpAdminsPage-open-close-applications",
    );
    expect(openClose.id).toBe("open-close-applications");
    expect(openClose.tagName).toBe("LI");
    expect(openClose).toHaveTextContent(
      "Each button first asks Are you sure? with a short account of what will happen, so a stray click changes nothing. Opening is step 2 of the diagram and closing is step 4.",
    );
    const reviews = screen.getByTestId("HelpAdminsPage-faculty-reviews");
    expect(reviews.id).toBe("faculty-reviews");
    expect(reviews).toHaveTextContent(
      /^Open Faculty Reviews \/ Close Faculty Reviews\. Faculty can see and rank the candidates for their courses only while reviews are Open\./,
    );
    expect(reviews).toHaveTextContent(
      "Opening and closing, and deadline changes, are recorded in the recruitment's change history.",
    );
    // Issue #211: the proposed deadline and the closing confirmation.
    expect(reviews).toHaveTextContent(
      "the box proposes five working days (Monday to Friday) from today, which you may change.",
    );
    expect(reviews).toHaveTextContent(
      "Closing also asks first, and warns you if the stated deadline has not passed yet;",
    );
    expect(
      openClose.compareDocumentPosition(reviews) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #179: the Assignments page and the planning rows of the rankings CSV.
    const assignments = screen.getByTestId("HelpAdminsPage-assignments");
    expect(document.getElementById("assignments").tagName).toBe("H2");
    expect(assignments).toHaveTextContent(
      "Assignments on a recruitment card opens a table with the same fields as the rankings CSV",
    );
    // Issue #355: how the page names a lecture.
    expect(assignments).toHaveTextContent(
      "A lecture is named by its course number alone (16, 5A), with the section added only when the recruitment has more than one section of that course (8 (0100), 8 (0200)), as in the rankings CSV; the headings, the dropdown and the Columns menu all use these names, in a fixed-width font with the numbers lined up.",
    );
    // The spaces around the bold words are real (a mutant that drops one joins the words).
    expect(assignments).toHaveTextContent(
      "who each applicant is, a Tentative Assignment dropdown, then one column per lecture",
    );
    expect(assignments).toHaveTextContent(
      "Under each lecture's name the heading shows its Allocation, how many applicants are Assigned to it so far",
    );
    // Issue #315: the progress thermometer.
    expect(assignments).toHaveTextContent(
      "A progress thermometer under the page heading shows how many assignments have been made against the recruitment's hiring target (entered on the Budget page), as a filled bar with the numbers and percentage: green when the target is met, red when more have been assigned than the target, and an empty bar saying so when no target is set yet.",
    );
    const assignmentColumns = screen.getByTestId(
      "HelpAdminsPage-assignment-columns",
    );
    expect(assignmentColumns).toHaveTextContent(
      "The Columns menu above the table hides and shows columns while you work",
    );
    expect(assignmentColumns).toHaveTextContent(
      "Each of those columns also has a small hide link at the top right of its heading",
    );
    expect(assignmentColumns).toHaveTextContent(
      "Tentative Assignment is always shown, and is wide enough for a full lecture name.",
    );
    expect(assignments).toHaveTextContent(
      "Sorting by a lecture uses the same order as the faculty ranking page: the ranked applicants first, from rank 1 down, then the unranked ones by the student's preference (1st choice, 2nd choice, Enthusiastic, Would Consider, then Not Interested/Not Applicable); applicants who tie stay in the order they applied. Clicking the heading again reverses that order.",
    );
    expect(assignments).toHaveTextContent(
      "Allocation, how many applicants are Assigned to it so far, and how many places are still To Assign, in red when more have been assigned than allocated; those numbers stay put when you sort. In each row, the cell of the lecture chosen in the Tentative Assignment dropdown has a thick black outline.",
    );
    expect(
      screen.getByTestId("HelpAdminsPage-tentative-assignment"),
    ).toHaveTextContent(
      "saves at once and updates the counts. A tentative assignment is planning only: it is not shown to applicants or to faculty at this stage",
    );
    expect(
      screen.getByTestId("HelpAdminsPage-rankings-csv-planning"),
    ).toHaveTextContent(
      "a tentativeAssignment column after the identity columns (the lecture each applicant is pencilled into, blank if none), and three rows directly under the header, labelled Allocation, Assigned and Left to assign in the first column",
    );
    expect(
      within(
        screen.getByTestId("HelpAdminsPage-recruitment-buttons"),
      ).getByRole("link", { name: "Assignments" }),
    ).toHaveAttribute("href", "#assignments");
    expect(screen.getByText(/ADMIN_EMAILS/)).toBeInTheDocument();
    // Issues #150 and #153: a pointer to the Notices Fields page, which has the details.
    const pointer = screen.getByTestId("HelpAdminsPage-notice-fields");
    expect(pointer.id).toBe("notice-fields");
    expect(pointer).toHaveTextContent(
      "its quarter, its primary consideration date, and every date of that quarter from the Quarters calendar. They are all listed, with examples, on Help → Notices Fields.",
    );
    expect(
      within(pointer).getByRole("link", { name: "Help → Notices Fields" }),
    ).toHaveAttribute("href", "/help/notice-fields");
    expect(screen.getByRole("link", { name: "fields" })).toHaveAttribute(
      "href",
      "#notice-fields",
    );
    // Issue #192: Markdown basics, linked from the TA App Settings paragraph.
    const markdownHeading = document.getElementById("markdown");
    expect(markdownHeading.tagName).toBe("H2");
    expect(markdownHeading).toHaveTextContent("Markdown");
    expect(screen.getByRole("link", { name: "Markdown" })).toHaveAttribute(
      "href",
      "#markdown",
    );
    const markdown = screen.getByTestId("HelpAdminsPage-markdown");
    expect(markdown).toHaveTextContent(
      "a line starting with # is a heading (## a smaller one); *emphasis* is italic and **strong** is bold;",
    );
    expect(markdown).toHaveTextContent(
      "lines starting with - make a bulleted list and with 1. a numbered one; [text](https://example.com) makes a link; a blank line starts a new paragraph",
    );
    expect(markdown).toHaveTextContent(
      "the fields such as ${quarter} are described under Help → Notices Fields.",
    );
    expect(
      screen.getByRole("link", { name: "Markdown" }).parentElement,
    ).toHaveTextContent(
      "It is written in Markdown with a live preview, filled in for the quarter chosen above the editor",
    );
    expect(
      within(markdown).getByRole("link", { name: "Help → Notices Fields" }),
    ).toHaveAttribute("href", "/help/notice-fields");
    expect(
      screen.getByText(
        /filled in for the quarter chosen above the editor \(by default the quarter after the current one\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "CSV Upload/Download Formats" }),
    ).toHaveAttribute("href", "/help/csv");
    // Issue #185: the Columns menu and the other table tweaks, in the Courses section.
    const columns = screen.getByTestId("HelpAdminsPage-course-columns");
    expect(columns.id).toBe("course-columns");
    expect(columns).toHaveTextContent(
      "the Columns menu above it lists every column but the course number, and unticking one hides it, heading, cells and totals alike, until you tick it again. Show All and Show None at the top of the menu show or hide every column at once.",
    );
    expect(columns).toHaveTextContent(
      "Each of those columns also has a small hide link at the top right of its heading: one click hides that column without opening the menu, exactly as unticking it there does.",
    );
    expect(columns).toHaveTextContent(
      "A recruitment's table starts with only the Course Number, Instructor, Enrolled and Max columns shown, on the view-only page and the edit page alike; tick the others (Rankings once reviews have started, Section, Title, Email, Days, Time, Room, Status, and the Remove / Unremove button) in the Columns menu when you need them. The budget columns (Enrollment Estimate, Allocation, Unrounded Allocation, Delta and the TA:student or ULA:student ratio) are not on these pages and not in their Columns menu: they are on the Combined Allocation page, which both pages point to.",
    );
    expect(
      within(columns).getByRole("link", { name: "Combined Allocation page" }),
    ).toHaveAttribute("href", "/#combined-allocations");
    expect(columns).toHaveTextContent(
      "Your choice is kept in this browser, for that recruitment and for both pages, so it is the same on your next visit from the same browser; it is not shared with other admins or other browsers.",
    );
    expect(columns).toHaveTextContent(
      "sorting by course number follows the padded course id exactly as it is shown, so CMPSC 5A comes before CMPSC 130A.",
    );
    expect(
      document.getElementById("courses").compareDocumentPosition(columns) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #189: the applications table's column order and Columns menu, under Applications.
    const applicationColumns = screen.getByTestId(
      "HelpAdminsPage-application-columns",
    );
    expect(applicationColumns.id).toBe("application-columns");
    expect(applicationColumns).toHaveTextContent(
      "The table shows the id, View, Edit and Name first, then Submitted and the other answers, and takes only the width it needs.",
    );
    expect(applicationColumns).toHaveTextContent(
      "or click the small hide link at the top right of a column's heading",
    );
    expect(applicationColumns).toHaveTextContent(
      "the columns the table has always had start shown and the rest start hidden, and the choice is kept for that recruitment, for all admins.",
    );
    // Issue #342: the long text columns are wide and resizable.
    expect(applicationColumns).toHaveTextContent(
      "are wide, 400 pixels to start with. Drag the thin bar at the right edge of such a heading to widen or narrow the column (never narrower than 200 pixels; there is no upper limit), or tab to the bar and press the left and right arrow keys.",
    );
    expect(applicationColumns.closest("li")).toHaveTextContent(
      "Applications. The list of applications",
    );
    // Issue #296: the Draft Applications button and page.
    const draftApplications = screen.getByTestId(
      "HelpAdminsPage-draft-applications",
    );
    expect(draftApplications.id).toBe("draft-applications");
    expect(draftApplications).toHaveTextContent(
      "Draft Applications. The applications students have started but not yet submitted, which are not considered until they are.",
    );
    expect(draftApplications).toHaveTextContent(
      "except that there is no Edit column, since an admin may not change what a student has written, and Submitted is replaced by Last saved.",
    );
    expect(draftApplications).toHaveTextContent(
      "When the student submits, the draft leaves this page and your comments are copied to the new application's Admin Comments.",
    );
    expect(draftApplications).toHaveTextContent(
      "There is no CSV download of drafts",
    );
    // Issue #411: the button that copies the draft applicants' emails.
    expect(draftApplications).toHaveTextContent(
      "Above the table, when there are drafts, a Copy emails of draft applicants to clipboard button copies the email address of everyone with a draft, one per line, so that a day or two before applications close you can paste them into an email reminding those students to log in and submit before the primary consideration date, since drafts are not considered.",
    );
    // Issue #417: the warning about a student with both a draft and an application.
    expect(draftApplications).toHaveTextContent(
      "A student never has both a draft and a submitted application to the same recruitment (one who cancelled may start a new draft). If one ever does, which would be a bug, a red WARNING at the top of this page and of the Applications page lists them, with links to the draft and the application.",
    );
    expect(
      screen.getByTestId("HelpAdminsPage-recruitment-buttons"),
    ).toHaveTextContent("Draft Applications. The applications students");
    expect(applicationColumns.closest("li").previousElementSibling).toBe(
      draftApplications,
    );
    // Issue #174: the hiring target and per-course allocations, in the Courses section.
    const hiring = screen.getByTestId("HelpAdminsPage-hiring-target");
    expect(hiring.id).toBe("hiring-target");
    // Issue #358 follow-up: the target is entered on the Budget page; the view page shows it.
    expect(hiring).toHaveTextContent(
      "The hiring target, the total number of TAs (or ULAs) expected to be hired, is entered on the Budget for Quarter page, beside the money; it must be at least 1. The view-only Courses page shows it, read-only, with a running count of how many positions are allocated so far and how many are left to assign, and warns when the allocations add up to more than the target; the edit page does not show it. Each lecture's share of it, its Allocation, is given on the Combined Allocation page.",
    );
    expect(hiring).toHaveTextContent(
      "Combined Allocation page. Removed lectures keep their number but do not count. These are planning figures",
    );
    expect(
      document.getElementById("courses").compareDocumentPosition(hiring) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #175: the refresh on opening and the enrollment estimates.
    const estimates = screen.getByTestId("HelpAdminsPage-enrollment-estimates");
    expect(estimates.id).toBe("enrollment-estimates");
    expect(estimates).toHaveTextContent(
      "Opening the page also refreshes every lecture's enrollment and maximum enrollment from the UCSB schedule while you wait",
    );
    expect(estimates).toHaveTextContent(
      "Your own estimate of how many students each lecture will have, the Enrollment Estimate, and the Set enrollment estimates from: max, actual control that fills it from the schedule used to be on this page; they are on the Combined Allocation page now, where the estimate is shared by the quarter's TA and ULA recruitments.",
    );
    expect(
      hiring.compareDocumentPosition(estimates) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #176: the guide columns and the auto assign button.
    const auto = screen.getByTestId("HelpAdminsPage-auto-assign");
    expect(auto.id).toBe("auto-assign");
    // Issue #358, part 3: what left the Courses pages, and that everything else stays.
    expect(auto).toHaveTextContent(
      "Auto assign TA allocations (or ULA), and the Unrounded Allocation, Delta and TA:student ratio columns that guided it, have moved to the Combined Allocation page too, where they are explained. In all, what left the Courses pages is: the Enrollment Estimate, Allocation, Unrounded Allocation, Delta and TA:student / ULA:student ratio columns, Set enrollment estimates from: max, actual, and Auto assign allocations; and from the edit page alone,",
    );
    expect(auto).toHaveTextContent(
      "and from the edit page alone, the hiring target block (the target is entered on the Budget for Quarter page), the paragraph explaining Populate, and the Publish Assignments panel, which is now at the top of the recruitment's Assignments page. Everything else stays: Populate, Add by enroll code, Remove / Unremove and Show removed courses, the refresh from the UCSB schedule and the last-refreshed line, the allocation visibility panel, Copy emails of faculty with zero rankings, the Summer Session column, the warning about other tabs, the developer buttons, and the totals row with its Total Course Count and the sums of Enrolled and Max; the view-only page also keeps the read-only hiring target and the pointer to the Combined Allocation page.",
    );
    expect(
      estimates.compareDocumentPosition(auto) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #178: showing or hiding allocations to faculty.
    const visibility = screen.getByTestId(
      "HelpAdminsPage-allocation-visibility",
    );
    expect(visibility.id).toBe("allocation-visibility");
    expect(visibility).toHaveTextContent(
      "Who may see the allocations is one setting for the recruitment, shown under the hiring target as Allocation visibility; choose Change to pick one of two states. Admins only is where every recruitment starts: no faculty member sees any allocation.",
    );
    expect(visibility).toHaveTextContent(
      "Faculty see their own courses is what Release Allocations to Faculty means: each faculty member sees the allocations for the courses they teach, as a small table on their home page card and at the top of each ranking page: the Hiring Target (the allocation), the Ranking Target (twice the allocation, but never more than the candidates who expressed interest in the course), Candidates Ranked so far and Rankings Still Needed.",
    );
    // Issue #366: the third state is no longer described.
    expect(visibility).toHaveTextContent(
      "The read-only Courses page that each of their courses offers shows faculty no allocation figures: those are not even sent to their browser. Move off Admins only once the numbers are mostly final; you can still change an allocation afterwards, and faculty see the change immediately. Every change of state is recorded in the recruitment's change history.",
    );
    expect(visibility).not.toHaveTextContent(/all courses/i);
    expect(visibility).not.toHaveTextContent(/three/);
    expect(
      auto.compareDocumentPosition(visibility) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /** The words either side of each JSX line break stay separated by a space. */
  test("the pages' sentences read across their line breaks", async () => {
    renderPage(<HelpAdminsPage />);
    const flow = [
      ...(await screen.findByTestId("HelpAdminsPage-flow")).querySelectorAll(
        "li",
      ),
    ].map((li) => li.textContent);
    expect(flow[0]).toMatch(/under TA App Settings and ULA App Settings\./);
    expect(flow[1]).toMatch(
      /check it with Courses, try the form with Test Application \(on the Applications page\), then open applications from step 2 of the diagram\./,
    );
    expect(flow[2]).toMatch(
      /The Applications page and its Download Applications as CSV show what has come in/,
    );
    expect(
      document.getElementById("instructors").nextElementSibling.textContent,
    ).toMatch(
      /Add one with Add New Instructor, or many at once by uploading a CSV of emails \(the format is on the CSV Upload\/Download Formats page\); Download Instructors \(CSV\) saves the whole list in a shape the upload accepts, so it can be moved from one deployment to another\./,
    );
    const buttons = [
      ...screen
        .getByTestId("HelpAdminsPage-recruitment-buttons")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(buttons[0]).toMatch(
      /^Open Applications \/ Close Applications\. Recruitments do not open/,
    );
    // Issue #358, part 3: the Courses item points to the Combined Allocation page.
    expect(buttons[2]).toMatch(
      /the page says when the list was last refreshed\. Enrollment estimates and allocations are not on this page: it points to the Combined Allocation page, where they are edited for TAs and ULAs together\.$/,
    );
    expect(buttons[0]).toMatch(
      /primary consideration date\. Closing keeps every application on file, and a closed recruitment can be opened again\. Each button first asks/,
    );
    // Issue #186: the faculty reviews item sits between applications and Courses.
    expect(buttons[1]).toMatch(
      /^Open Faculty Reviews \/ Close Faculty Reviews\. Faculty can see and rank/,
    );
    expect(buttons[1]).toMatch(
      /ranking deadline, after a short account of what will happen; the box proposes five working days/,
    );
    expect(buttons[2]).toMatch(/from the schedule\. Populate re-runs the job/);
    expect(buttons[2]).toMatch(/finds it again\. Remove takes a lecture out/);
    expect(buttons[5]).toMatch(
      /^Draft Applications\. The applications students have started but not yet submitted/,
    );
    expect(buttons[6]).toMatch(/Each has a View page \(everything/);
    expect(buttons[7]).toMatch(
      /^Assignments\. The faculty rankings of every real applicant side by side, one column per lecture, with a Tentative Assignment dropdown on each row/,
    );
    // Issue #317: the card's Make Assignments and View Assignments buttons.
    expect(buttons[7]).toMatch(
      /The card's Make Assignments button opens it, as does step 8 of the diagram\.$/,
    );
    expect(buttons[8]).toMatch(
      /^View Assignments\. The read-only assignments page that admins and faculty share, with its two CSV downloads \(see publishing above\)\. The card's View Assignments button and step 9 of the diagram open it; until Publish Assignments has been clicked at the top of the Assignments page it says the assignments are not published yet\.$/,
    );
    // Issue #390: the card's Change History button and page.
    expect(buttons[9]).toBe(
      "Change History. Every change to the recruitment itself, newest first: when it was created, each time applications or faculty reviews were opened or closed, each date or setting that changed, and (Changed By) who made the change. The button is at the right end of the card's row of buttons, apart from the others, and opens the recruitment's own Change History page, which shows the recruitment's row above the list and has a page-size control and Previous and Next buttons. Changes to individual applications are not here but in the Audit Trail.",
    );
    expect(buttons[10]).toMatch(/^Delete\. Removes the recruitment/);
    expect(buttons).toHaveLength(11);
    const changeHistory = screen.getByTestId("HelpAdminsPage-change-history");
    expect(changeHistory).toHaveAttribute("id", "change-history");
    expect(
      within(changeHistory).getByRole("link", { name: "Audit Trail" }),
    ).toHaveAttribute("href", "#audit-trail");
    // The Audit Trail section says where the recruitment's own changes went.
    const auditTrail =
      document.getElementById("audit-trail").nextElementSibling;
    expect(auditTrail).toHaveTextContent(
      "A recruitment's own changes (its creation, opening, closing and dates) are not here: they are on its own Change History page, opened by the Change History button at the right end of its card's row of buttons on the home page, with the same Changed By column.",
    );
    expect(auditTrail).not.toHaveTextContent("Applications page");
    expect(
      document.getElementById("ta-app-settings").nextElementSibling.textContent,
    ).toMatch(/the Majors list and the Topics list \(the areas/);
    expect(
      document.getElementById("ula-app-settings").nextElementSibling
        .textContent,
    ).toMatch(/its Majors, Topics and Interests lists \(the areas/);
    expect(
      document.getElementById("legacy-ta-application").nextElementSibling
        .textContent,
    ).toMatch(/^Legacy TA Application shows the old PHP app/);

    cleanup();
    renderPage(<HelpInstructorsPage />);
    expect(
      (await screen.findByTestId("HelpInstructorsPage")).querySelector("p")
        .textContent,
    ).toMatch(
      /your home page has an Instructor section with one card per quarter/,
    );

    cleanup();
    renderPage(<HelpUlaApplicantsPage />);
    expect(
      (await screen.findByTestId("HelpUlaApplicantsPage")).querySelector("p")
        .textContent,
    ).toMatch(/While a recruitment is open it shows an Apply to be a ULA link/);
    expect(screen.getByTestId("HelpUlaApplicantsPage").textContent).toMatch(
      /saves a draft every few seconds as you go/,
    );
    expect(screen.getByTestId("HelpUlaApplicantsPage").textContent).toMatch(
      /Continue editing draft application/,
    );
    expectSimultaneousEditingSection("HelpUlaApplicantsPage");
    expect(screen.getByTestId("HelpUlaApplicantsPage").textContent).toMatch(
      /View submitted application/,
    );
    const items = [
      ...screen
        .getByTestId("HelpUlaApplicantsPage-asked-for")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(items[3]).toMatch(/See the Instructions for preparing your video\./);
    // Issue #332: the double major hint, next to where the major is described.
    expect(items[1]).toMatch(/If you are a double major/);
    expect(
      screen.getByTestId("HelpUlaApplicantsPage-double-major"),
    ).toHaveTextContent(
      'If you are a double major, select "Other" under Major and enter both majors in the field that appears.',
    );
  });

  /** Issue #153: every field on one admin-only page, each shown with a sample value. */
  test("the Notices Fields page lists every field with an example, and the issue's examples filled in", async () => {
    renderPage(<HelpNoticeFieldsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Notices Fields" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("HelpNoticeFieldsPage-field-quarter").textContent,
    ).toBe("${quarter}The recruitment's quarter, written outFall 2021");
    expect(
      screen.getByTestId("HelpNoticeFieldsPage-field-primaryConsiderationDate")
        .textContent,
    ).toBe(
      "${primaryConsiderationDate}Its primary consideration dateSeptember 20, 2021",
    );
    const rows = screen
      .getByTestId("HelpNoticeFieldsPage-quarter-fields")
      .querySelectorAll("tbody tr");
    expect(rows).toHaveLength(QUARTER_NOTICE_FIELDS.length);
    expect(
      screen.getByTestId("HelpNoticeFieldsPage-field-firstDayOfClasses")
        .textContent,
    ).toBe("${firstDayOfClasses}First day of classesOctober 1, 2021");
    expect(
      screen.getByTestId("HelpNoticeFieldsPage-field-pass1Begin").textContent,
    ).toBe("${pass1Begin}Pass 1 beginsMay 10, 2021 at 9:00 AM");
    expect(
      screen.getByTestId("HelpNoticeFieldsPage-field-qyy").textContent,
    ).toBe("${qyy}The quarter in short form, e.g. F21F21");
    for (const { key } of QUARTER_NOTICE_FIELDS) {
      const cells = screen
        .getByTestId(`HelpNoticeFieldsPage-field-${key}`)
        .querySelectorAll("td");
      expect(cells[0].textContent).toBe("${" + key + "}");
      expect(cells[2].textContent).not.toContain("${");
      expect(cells[2].textContent).not.toBe("");
    }
    const examples = [
      ...screen
        .getByTestId("HelpNoticeFieldsPage-examples")
        .querySelectorAll("li"),
    ];
    expect(examples).toHaveLength(NOTICE_FIELD_EXAMPLES.length + 1);
    expect(examples[0].querySelector("code").textContent).toBe(
      NOTICE_FIELD_EXAMPLES[0],
    );
    expect(examples[0].querySelector("em").textContent).toBe(
      "If you are a BS/MS student, and you will be in graduate status during Fall 2021, please apply to be a TA instead of applying to be a ULA.",
    );
    expect(examples[1].querySelector("em").textContent).toMatch(
      /^Applications received by September 20, 2021 will be given full consideration\./,
    );
    expect(examples[2].querySelector("em").textContent).toBe(
      "Classes begin on October 1, 2021; the last day to add a course is October 18, 2021.",
    );
    expect(screen.getByRole("link", { name: "Quarters" })).toHaveAttribute(
      "href",
      "/admin/quarters",
    );
    expect(
      screen.getByText(/The examples are for FALL 2021\./),
    ).toBeInTheDocument();
    // The sentences read across the JSX line breaks.
    const paragraphs = [
      ...screen.getByTestId("HelpNoticeFieldsPage").querySelectorAll("p"),
    ].map((p) => p.textContent);
    expect(paragraphs[0]).toMatch(
      /text on the TA and ULA App Settings pages can carry fields, written as \$\{name\}, that are filled in/,
    );
    expect(paragraphs[0]).toMatch(
      /Anything else between \$\{ and \} is left exactly as typed, and so is a field whose value is not on file\./,
    );
    expect(paragraphs[1]).toMatch(
      /These come from the Quarters calendar, for the recruitment's quarter\./,
    );
    expect(examples[2].querySelector("code")).toHaveTextContent(
      "Classes begin on ${firstDayOfClasses}; the last day to add a course is ${lastDayToAddUnderGrad}.",
    );
  });

  test("arriving at the admins page with a hash scrolls to that section", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderPage(<HelpAdminsPage />, ["/help/admins#courses"]);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Admins" }),
    ).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(
      document.getElementById("courses"),
    );
  });

  test("a hash that names no section, or no hash, scrolls nowhere", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderPage(<HelpAdminsPage />, ["/help/admins#nowhere"]);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Admins" }),
    ).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test("the admins page's recruitment flow mentions releasing allocations before opening reviews (issue #224)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const steps = screen
      .getByTestId("HelpAdminsPage-flow")
      .querySelectorAll("li");
    expect(steps).toHaveLength(4);
    expect(steps[3]).toHaveTextContent(
      "Afterwards: Close Applications, plan the hiring on the Budget for Quarter and Combined Allocation pages, release each lecture's allocation to its instructor, then Open Faculty Reviews.",
    );
  });

  test("the admins page links to the Recruitment Steps page above its flow (issue #232)", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const paragraph = screen.getByTestId("HelpAdminsPage-steps-link");
    expect(paragraph).toHaveTextContent(
      "The order the steps happen in, and which ones must come first, is drawn on the Recruitment Steps page.",
    );
    expect(
      within(paragraph).getByRole("link", { name: "Recruitment Steps" }),
    ).toHaveAttribute("href", "/help/recruitment-steps");
    expect(
      document.getElementById("flow").compareDocumentPosition(paragraph) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      paragraph.compareDocumentPosition(
        screen.getByTestId("HelpAdminsPage-flow"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("the instructors page links to the Recruitment Steps page (issue #232)", async () => {
    renderPage(<HelpInstructorsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Instructors" });

    const paragraph = screen.getByTestId("HelpInstructorsPage-steps-link");
    expect(paragraph).toHaveTextContent(
      "Where your part fits in a recruitment, and what the admin does before and after it, is drawn on the Recruitment Steps page.",
    );
    expect(
      within(paragraph).getByRole("link", { name: "Recruitment Steps" }),
    ).toHaveAttribute("href", "/help/recruitment-steps");
  });

  test("the pages say that every time is Pacific Time (issue #293)", async () => {
    renderPage(<HelpTaApplicantsPage />);
    expect(
      screen.getByTestId("HelpTaApplicantsPage-time-zone"),
    ).toHaveTextContent("Every date and time on this site is in Pacific Time");
    cleanup();
    renderPage(<HelpUlaApplicantsPage />);
    expect(
      screen.getByTestId("HelpUlaApplicantsPage-time-zone"),
    ).toHaveTextContent("Every date and time on this site is in Pacific Time");
    cleanup();
    renderPage(<HelpDeveloperPage />);
    expect(
      screen.getByTestId("HelpDeveloperPage-dates-and-times"),
    ).toHaveTextContent("Every date and time the app shows or accepts");
    cleanup();
    renderPage(<HelpAdminsPage />);
    expect(
      document.getElementById("audit-trail").nextElementSibling,
    ).toHaveTextContent(
      "like every date and time on this site, are Pacific Time",
    );
  });

  // Issues #318, #420: cancelling, and creating a new application from the cancelled one.
  test.each(["Ta", "Ula"])(
    "the %s applicants page explains cancelling and creating a new application (issues #318, #420)",
    async (type) => {
      const Page = type === "Ta" ? HelpTaApplicantsPage : HelpUlaApplicantsPage;
      renderPage(<Page />);
      const page = `Help${type}ApplicantsPage`;
      expect(await screen.findByTestId(`${page}-cancelling`)).toHaveTextContent(
        "Cancelling, and applying again",
      );
      expect(screen.getByTestId(`${page}-start-again`).textContent).toMatch(
        /show Create a new application\. It turns the cancelled application back into a draft with all your answers.*except your reason for cancelling.*The cancelled application is removed.*Once applications have closed the button is gone/,
      );
    },
  );

  test("the admins page explains an applicant who cancelled and applied again (issues #318, #420)", async () => {
    renderPage(<HelpAdminsPage />);
    expect(
      await screen.findByTestId("HelpAdminsPage-cancelled-and-new"),
    ).toHaveTextContent(
      /choose Create a new application, which turns the cancelled application back into a draft.*removes the cancelled row.*Your comments on the application move to the draft.*rankings of the cancelled application are removed.*audit trail is kept.*the same email address can appear twice.*Only the live one is counted, ranked and assigned.*counts once/,
    );
  });

  test.each([
    ["TA", "Ta", HelpTaApplicantsPage],
    ["ULA", "Ula", HelpUlaApplicantsPage],
  ])(
    "the %s applicants page explains the notices' version, and a hash scrolls to it (issue #325)",
    async (kind, camel, Page) => {
      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
      renderPage(<Page />, [
        `/help/${kind.toLowerCase()}-applicants#notices-terms-and-conditions`,
      ]);
      const heading = await screen.findByRole("heading", {
        name: "Notices, Terms and Conditions",
      });
      expect(heading).toHaveAttribute("id", "notices-terms-and-conditions");
      expect(screen.getByTestId(`Help${camel}ApplicantsPage-notices`)).toBe(
        heading,
      );
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.instances[0]).toBe(heading);
      expect(
        screen.getByText(
          new RegExp(`When you apply to be a ${kind}, there are`),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/we record which specific version you agreed to/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/will always be the same for this particular round/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/please contact the CS department/),
      ).toBeInTheDocument();
    },
  );

  test("the applicants pages scroll nowhere without a hash", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderPage(<HelpTaApplicantsPage />);
    await screen.findByRole("heading", { level: 1, name: "For TA Applicants" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // Where the Combined Allocation columns paragraph (issue #383) runs into an emphasised word on
  // the next line of the source, the two are kept apart by an explicit space; without it the words
  // would run together ("Course Numberis"). Each phrase here straddles one of those spaces. Only
  // this paragraph is checked, so an edit elsewhere on the page cannot break the test.
  test("the Combined Allocation columns paragraph keeps its spaces around emphasised words", async () => {
    renderPage(<HelpAdminsPage />);
    const columns = await screen.findByTestId(
      "HelpAdminsPage-combined-allocations-columns",
    );

    [
      "Courses pages: TA Rankings and ULA Rankings",
      "have been opened), Section, Title,",
      "Section, Title, Instructor, Email (with",
      "button), Days, Time, Room, Enrolled, Max",
      "Room, Enrolled, Max and Status, and,",
      "a summer quarter, Summer Session. A",
      "the table shows Total Course Count",
      "none. Course Number is on two",
      "Columns menu has Show All, Show None",
    ].forEach((phrase) => expect(columns).toHaveTextContent(phrase));
  });
});

describe("admin Help: the home page's quarter cards (issues #357, #379)", () => {
  test("describes one card per quarter with its two buttons, the nested TA and ULA cards, how they open and close, the default state and the Quarters control", async () => {
    renderPage(<HelpAdminsPage />);
    const card = (await screen.findByText("Budget Planning")).parentElement;
    expect(card).toHaveTextContent(
      "The recruitments are grouped by quarter: one card per quarter, headed by the quarter (for example W26) with two buttons on the same row: Budget Planning opens that quarter's Budget for Quarter page, and one allocation button opens the quarter's Combined Allocation page, where the TA and ULA allocations are edited side by side; its label says which recruitments the quarter has: Allocate TA slots to Courses, Allocate ULA slots to Courses or Allocate TA and ULA slots to Courses.",
    );
    expect(card).toHaveTextContent(
      "Clicking anywhere else on that row closes or opens the quarter's card (the caret at its left shows which it is); clicking a button on the row goes to its page and leaves the card as it was. The newest quarter starts open and the older quarters closed, and this browser remembers each card as you left it. The Quarters control above the cards puts the newest or the oldest quarter first.",
    );
    expect(card).toHaveTextContent(
      "Inside a quarter's card is a nested card for each of its recruitments, headed TA or ULA with its status badges and how many applications it has; clicking that row closes or opens just that card, and the trash icon at its right deletes the recruitment. Open, the card shows the recruitment's dates, and under the dates the live Recruitment Steps diagram (collapsed to a one-line summary on older recruitments, expanded on the latest TA and ULA recruitments).",
    );
    expect(
      within(card).getByRole("link", { name: "Recruitment Steps" }),
    ).toHaveAttribute("href", "/help/recruitment-steps");
    // Issue #379: no longer a flat "QXX Budget" card, and no Sort by bar.
    expect(card).not.toHaveTextContent("QXX Budget");
    expect(card).not.toHaveTextContent("Budget card");
    expect(card).not.toHaveTextContent("sorted");
    expect(card).not.toHaveTextContent("Sort by");
    expect(screen.queryByText(/QXX Budget/)).toBeNull();
    expect(card).not.toHaveTextContent("TA allocations and ULA allocations");
    expect(card).not.toHaveTextContent("greyed out");
    // The diagram's links, described in the same paragraph.
    expect(card).toHaveTextContent(
      "In the diagram, step 3's Allocations and step 5's (see allocations) links open the quarter's Combined Allocation page, and the same two assignment pages are under steps 8 and 9 as Make Assignments and View Assignments.",
    );
    // Issue #317: the card's two assignment buttons, told apart.
    expect(card).toHaveTextContent(
      "the card has Courses, Draft Applications, Applications, Make Assignments and View Assignments buttons: Make Assignments opens the page where candidates are assigned to slots, and View Assignments the read-only assignments page that admins and faculty share (it says the assignments are not published yet until they are). Apart from them, at the right end of the same row, Change History opens the list of every change made to the recruitment itself (see Audit Trail below).",
    );
    expect(
      within(card).getByRole("link", { name: "Audit Trail" }),
    ).toHaveAttribute("href", "#audit-trail");
    expect(card).not.toHaveTextContent("(see assignments)");
    expect(
      within(card).getAllByRole("link", {
        name: "Combined Allocation page",
      })[0],
    ).toHaveAttribute("href", "/#combined-allocations");
  });
});
