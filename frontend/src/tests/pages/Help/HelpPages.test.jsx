import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import HelpTaApplicantsPage from "main/pages/Help/HelpTaApplicantsPage";
import HelpUlaApplicantsPage from "main/pages/Help/HelpUlaApplicantsPage";
import HelpInstructorsPage from "main/pages/Help/HelpInstructorsPage";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import HelpNoticeFieldsPage from "main/pages/Help/HelpNoticeFieldsPage";
import {
  NOTICE_FIELD_EXAMPLES,
  QUARTER_NOTICE_FIELDS,
} from "main/utils/noticeFields";
import {
  ADMIN_MENU_ENTRIES,
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
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /TA columns are first name, last name, email, major, class level, year in program and expected graduation/,
    );
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /ULA columns are first name, last name, email, major, year in program, expected graduation, GPA in major, overall GPA and quarters of previous ULA service/,
    );
    expect(screen.getByText(/TA columns are/)).toHaveTextContent(
      /No video links or admin comments are exported.*headed by the bare course number \(16, 5A\); the section is added only when the recruitment has more than one section of that course.*Removed, stale and cancelled sections remain/,
    );
  });

  test("the TA applicants page lists what is asked for, at a high level", async () => {
    renderPage(<HelpTaApplicantsPage />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "For TA Applicants",
      }),
    ).toBeInTheDocument();
    const items = [
      ...screen
        .getByTestId("HelpTaApplicantsPage-asked-for")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(items).toHaveLength(9);
    expect(items[1]).toMatch(
      /major, program \(Ph\.D\. or M\.S\.\), year in the program, GPA/,
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

  test("the instructors page explains the Instructor section and the catalog name", async () => {
    renderPage(<HelpInstructorsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "For Instructors" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Instructor/, { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/CONRAD P/)).toBeInTheDocument();
    // Issue #178: what an instructor sees once allocations are shown.
    const allocations = screen.getByTestId("HelpInstructorsPage-allocations");
    expect(allocations).toHaveTextContent(
      "Once an admin chooses to show them, each of your courses also says how many TAs (or ULAs) have been allocated to it, both on the card and at the top of its ranking page.",
    );
    expect(allocations).toHaveTextContent(
      "Please rank at least that many candidates, and preferably twice as many. Until then no allocation is shown.",
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
    ).toHaveLength(9);
    expect(
      screen.getByText(/first open stamps the actual opening date/),
    ).toBeInTheDocument();
    // Issue #186: the confirmations on the cards link to these two items.
    const openClose = screen.getByTestId(
      "HelpAdminsPage-open-close-applications",
    );
    expect(openClose.id).toBe("open-close-applications");
    expect(openClose.tagName).toBe("LI");
    expect(openClose).toHaveTextContent(
      "Each button first asks Are you sure? with a short account of what will happen, so a stray click changes nothing.",
    );
    const reviews = screen.getByTestId("HelpAdminsPage-faculty-reviews");
    expect(reviews.id).toBe("faculty-reviews");
    expect(reviews).toHaveTextContent(
      /^Open Faculty Reviews \/ Close Faculty Reviews\. Faculty can see and rank the candidates for their courses only while reviews are Open\./,
    );
    expect(reviews).toHaveTextContent(
      "Opening and closing, and deadline changes, are recorded in the recruitment's change history.",
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
    expect(
      screen.getByRole("link", { name: "CSV Upload/Download Formats" }),
    ).toHaveAttribute("href", "/help/csv");
    // Issue #185: the Columns menu and the other table tweaks, in the Courses section.
    const columns = screen.getByTestId("HelpAdminsPage-course-columns");
    expect(columns.id).toBe("course-columns");
    expect(columns).toHaveTextContent(
      "the Columns menu above it lists every column but the course number, and unticking one hides it, heading, cells and totals alike, until you tick it again or choose Show all columns.",
    );
    expect(columns).toHaveTextContent(
      "sorting by course number follows the padded course id exactly as it is shown, so CMPSC 5A comes before CMPSC 130A.",
    );
    expect(
      document.getElementById("courses").compareDocumentPosition(columns) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Issue #189: the applications table's column order and Columns menu, under Review Applications.
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
      "Review Applications.",
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
      "Allocations are hidden from faculty until you choose otherwise.",
    );
    expect(visibility).toHaveTextContent(
      "Show Allocations to Faculty puts each lecture's allocation on the instructor's home page card and at the top of its ranking page",
    );
    expect(visibility).toHaveTextContent(
      "Hide Allocations from Faculty takes it away again. Showing or hiding is recorded in the recruitment's change history.",
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
      /check it with Courses, try the form with Test Application, then Open Applications\./,
    );
    expect(flow[2]).toMatch(
      /Review Applications and Download CSV show what has come in/,
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
      /ranking deadline, after a short account of what will happen; the first opening stamps/,
    );
    expect(buttons[2]).toMatch(/from the schedule\. Populate re-runs the job/);
    expect(buttons[2]).toMatch(/finds it again\. Remove takes a lecture out/);
    expect(buttons[5]).toMatch(/Each has a View page \(everything/);
    expect(buttons[6]).toMatch(
      /^Assignments\. The faculty rankings of every real applicant side by side, one column per lecture, with a Tentative Assignment dropdown on each row/,
    );
    expect(buttons[7]).toMatch(
      /^Published Assignments\. Shown once Publish Assignments has been clicked at the bottom of the Courses page: the read-only assignments page that admins and faculty share, with its two CSV downloads \(see publishing above\)\./,
    );
    expect(buttons[8]).toMatch(/^Delete\. Removes the recruitment/);
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
    ).toMatch(/While a recruitment is open it shows an Apply link/);
    const items = [
      ...screen
        .getByTestId("HelpUlaApplicantsPage-asked-for")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(items[3]).toMatch(/See the Instructions for preparing your video\./);
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
});
