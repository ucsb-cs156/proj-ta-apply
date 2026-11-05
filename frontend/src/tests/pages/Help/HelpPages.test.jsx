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
  expect((coursesMeaning ?? after).nextElementSibling).toBe(
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
      "On a recruitment's Courses page, Download Rankings CSV saves that recruitment's faculty rankings as a spreadsheet-ready file. This is separate from Download Applications as CSV on its Applications page, which exports application answers.",
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
    // Issue #265: the ranking table opens in the default sort and has a button for it.
    expect(
      screen.getByText(/The table always opens in the default sort/, {
        exact: false,
      }),
    ).toHaveTextContent(
      "by your ranking (1 first, unranked last), then by course preference (first choice, second choice, enthusiastic, then would consider), then in the order the applications were submitted. The Default Sort button returns to it",
    );
    // Issue #178: what an instructor sees once allocations are shown.
    const allocations = screen.getByTestId("HelpInstructorsPage-allocations");
    expect(allocations).toHaveTextContent(
      "Once an admin lets faculty see the allocations, each of your courses shows a small table, both on the card and at the top of its ranking page: the Hiring Target (how many TAs or ULAs were allocated to the course), the Ranking Target (how many candidates you are asked to rank: twice the hiring target, or every interested candidate if there are fewer), Candidates Ranked so far and Rankings Still Needed.",
    );
    expect(allocations).toHaveTextContent(
      "If you have concerns about your course's target, raise them with the admin once you see it. Until the admin does, nothing about it is shown. If the admin chooses to show all courses to all faculty, your cards also offer All allocations, a read-only list of every course's number; otherwise that page does not exist.",
    );
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
      "the recruitment card gains an Assignments Published badge and an Assignments button. The page it opens is read-only and covers every course in the recruitment, not just yours",
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
      "the very bottom of the recruitment's Courses page has Publish Assignments. It asks you to confirm: publishing creates a read-only Assignments page for admins and faculty",
    );
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
      li.textContent.startsWith("Published Assignments."),
    );
    expect(published).toHaveTextContent(
      "Shown once Publish Assignments has been clicked at the bottom of the Courses page",
    );
    expect(
      within(published).getByRole("link", { name: "publishing" }),
    ).toHaveAttribute("href", "#publish-assignments");
  });

  test("the admins page explains the Budget for Quarter page and its three lines", async () => {
    renderPage(<HelpAdminsPage />);
    await screen.findByRole("heading", { level: 1, name: "For Admins" });

    const heading = document.getElementById("budget");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveTextContent("Budget for Quarter");
    // The menu table's anchor, then the section's link to the page itself.
    expect(
      screen
        .getAllByRole("link", { name: "Budget for Quarter" })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["#budget", "/admin/budget/selectQuarter"]);
    expect(
      screen.getByText(
        /where the hiring for the quarter is planned holistically/,
      ),
    ).toBeInTheDocument();
    const lines = screen.getByTestId("HelpAdminsPage-budget-lines");
    expect(lines.id).toBe("budget-lines");
    expect(lines).toHaveTextContent(
      "Any of the three may include subzero money, gift money or both, and any of them may be zero in a given quarter. For planning, the restricted money is spent first",
    );
    expect(lines).toHaveTextContent(
      "the bottom line is funds minus expenses, shown green with a plus sign when there is money to spare, red with a minus sign when the plan is over budget, and black when it comes out even.",
    );
    expect(
      heading.compareDocumentPosition(document.getElementById("recruitments")) &
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
      "auto-assigns the allocations across the courses, exactly as the Auto assign allocations button does.",
    );
    expect(fake).toHaveTextContent(
      "A checkbox, ticked by default, also sets allocation visibility to Faculty see their own courses, recorded in the change history like any other visibility change.",
    );
    expect(
      autoCreate.compareDocumentPosition(fake) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #220: the Create Fake Rankings button.
    const rankings = screen.getByTestId("HelpDeveloperPage-fake-rankings");
    expect(rankings).toHaveTextContent(
      "While developer mode is on, the footer of a recruitment's Courses page also has a Create Fake Rankings button, enabled only while faculty ranking is open.",
    );
    expect(rankings).toHaveTextContent(
      "for every course that has no rankings yet or for a random part of them.",
    );
    expect(rankings).toHaveTextContent(
      "a checkbox also ranks one or two applicants who did not express interest.",
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
    expect(rows).toHaveLength(8);
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
      "One quarter's budget (compare-and-set for a recruitment's average cost and hiring target, keyed recruitment:<id>)",
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
      "Courses edit page (allocations and estimated enrollments); the view-only page never warns",
      "The whole edit page for one recruitment",
      "courses-edit:<recruitmentId>",
      "#288",
    ]);
    expect(rows[6].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/288",
    );
    // Issue #282: also a refresh, so no key.
    expect(
      [...rows[7].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "Instructors page and the view-only Courses page",
      "Background refresh plus a refetch after each save; no warning, no version check, no detector",
      "None (refresh, not a key)",
      "#291",
    ]);
    expect(rows[7].querySelector("a")).toHaveAttribute(
      "href",
      "https://github.com/ucsb-cs156/proj-ta-apply/pull/291",
    );
    const courses = text("courses");
    expect(courses.replace(/\s+/g, " ")).toBe(
      `The Courses pages. A recruitment's Courses page is split in two. The view-only page (/admin/recruitments/:id/courses) is the default, edits nothing, and neither heartbeats nor warns. The edit page (/admin/recruitments/:id/courses/edit) heartbeats POST /api/recruitmentcourses/heartbeat?recruitmentId=, says goodbye at /leave, names itself in the X-Client-Id header of the allocation, estimate and Auto Allocate saves, and shows the banner and the modal with the noun "page"; Leave this page goes to the view-only page. Only an admin may heartbeat, and the recruitment must exist, before anything is recorded. The version check is not a JPA version, since the course refresh and the estimates also write the row: a separate allocation_version column on recruitment_courses is counted by each allocation edit, and allocation_bulk_version on recruitments is counted by Auto Allocate. An allocation edit sends both as expectedVersion and expectedBulkVersion and gets 409 when either moved; after a bulk conflict the page reads everything again.`,
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
      "Its Edit button, beside the words \u201cEdit estimated enrollments, and TA/ULA allocations\u201d, takes you to the edit page",
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
    expect(meaning.nextElementSibling).toBe(screen.getByTestId(`${page}-todo`));
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
    ).toHaveLength(10);
    expect(
      screen.getByText(/first open stamps the actual opening date/),
    ).toBeInTheDocument();
    // Issue #233: the live Recruitment Steps diagram on each card.
    const cardIntro = screen.getByText(/Under the dates is the live/);
    expect(cardIntro).toHaveTextContent(
      "Under the dates is the live Recruitment Steps diagram (collapsed to a one-line summary on older cards, expanded on the latest TA and ULA recruitments).",
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
    expect(assignments).toHaveTextContent(
      "sorting by a lecture puts the ranked applicants first (in either direction) and the unranked ones after them.",
    );
    expect(assignments).toHaveTextContent(
      "Allocation, how many applicants are Assigned to it so far, and how many places are Left, in red when more have been assigned than allocated; those numbers stay put when you sort.",
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
      "the Columns menu above it lists every column but the course number, and unticking one hides it, heading, cells and totals alike, until you tick it again. Select All and Select None at the top of the menu show or hide every column at once.",
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
      "the columns the table has always had start shown and the rest start hidden, and the choice is kept for that recruitment, for all admins.",
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
    expect(
      screen.getByTestId("HelpAdminsPage-recruitment-buttons"),
    ).toHaveTextContent("Draft Applications. The applications students");
    expect(applicationColumns.closest("li").previousElementSibling).toBe(
      draftApplications,
    );
    // Issue #174: the hiring target and per-course allocations, in the Courses section.
    const hiring = screen.getByTestId("HelpAdminsPage-hiring-target");
    expect(hiring.id).toBe("hiring-target");
    expect(hiring).toHaveTextContent(
      "Enter the total number of TAs (or ULAs) expected to be hired; it is saved as you type, must be at least 1,",
    );
    expect(hiring).toHaveTextContent(
      "warns when the allocations add up to more than the target. Removed lectures keep their number but do not count.",
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
      "It is saved a second after you stop typing, or at once when you leave the box; an empty box means no estimate.",
    );
    expect(estimates).toHaveTextContent(
      "Set enrollment estimates from: max or actual",
    );
    expect(
      hiring.compareDocumentPosition(estimates) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #176: the guide columns and the auto assign button.
    const auto = screen.getByTestId("HelpAdminsPage-auto-assign");
    expect(auto.id).toBe("auto-assign");
    expect(auto).toHaveTextContent(
      "Delta is that share minus the allocation, green with a plus sign when a lecture is owed positions and red when it has more than its share",
    );
    // Issue #257: at least one each when there are enough positions.
    expect(auto).toHaveTextContent(
      "When there are at least as many positions as lectures, every lecture gets at least one, and the rest are given out one at a time to the lecture furthest under its share, so that the biggest gap between any lecture's allocation and its share is as small as it can be. When there are fewer positions than lectures, each lecture gets its share rounded",
    );
    expect(auto).toHaveTextContent(
      "The purpose of this feature is to give admins a way to make a first-cut allocation based on enrollment, as close to fair as the numbers allow; it should not necessarily be considered the final allocation. Admins have the flexibility to adjust it up or down based on the particular needs of specific courses and other relevant factors.",
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
      "Who may see the allocations is one setting for the recruitment, shown under the hiring target as Allocation visibility; choose Change to pick one of three states. Admins only is where every recruitment starts: no faculty member sees any allocation.",
    );
    expect(visibility).toHaveTextContent(
      "Faculty see their own courses is what Release Allocations to Faculty means: each faculty member sees the allocations for the courses they teach, as a small table on their home page card and at the top of each ranking page: the Hiring Target (the allocation), the Ranking Target (twice the allocation, but never more than the candidates who expressed interest in the course), Candidates Ranked so far and Rankings Still Needed.",
    );
    expect(visibility).toHaveTextContent(
      "Faculty see all courses goes further, for when the whole plan is public: every faculty member teaching in the recruitment also gets an All allocations page listing every course's number. Move off Admins only once the numbers are mostly final; you can still change an allocation afterwards, and faculty see the change immediately. Every change of state is recorded in the recruitment's change history.",
    );
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
    expect(buttons[8]).toMatch(
      /^Published Assignments\. Shown once Publish Assignments has been clicked at the bottom of the Courses page: the read-only assignments page that admins and faculty share, with its two CSV downloads \(see publishing above\)\./,
    );
    expect(buttons[9]).toMatch(/^Delete\. Removes the recruitment/);
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
    ).toMatch(/your home page has an Instructor section listing/);

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
      "Afterwards: Close Applications, plan the hiring on the Courses and Budget for Quarter pages, release each lecture's allocation to its instructor, then Open Faculty Reviews.",
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

  // Issue #318: cancelling, and starting a new application while applications are open.
  test.each(["Ta", "Ula"])(
    "the %s applicants page explains cancelling and starting a new application (issue #318)",
    async (type) => {
      const Page = type === "Ta" ? HelpTaApplicantsPage : HelpUlaApplicantsPage;
      renderPage(<Page />);
      const page = `Help${type}ApplicantsPage`;
      expect(await screen.findByTestId(`${page}-cancelling`)).toHaveTextContent(
        "Cancelling, and applying again",
      );
      expect(screen.getByTestId(`${page}-start-again`).textContent).toMatch(
        /Start a new application.*empty form, as if you had never applied.*the cancelled one stays on file.*Once applications have closed the button is gone/,
      );
    },
  );

  test("the admins page explains an applicant who cancelled and applied again (issue #318)", async () => {
    renderPage(<HelpAdminsPage />);
    expect(
      await screen.findByTestId("HelpAdminsPage-cancelled-and-new"),
    ).toHaveTextContent(
      /Start a new application.*the same email address can appear twice.*Only the live one is counted, ranked and assigned.*counts once/,
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
});
