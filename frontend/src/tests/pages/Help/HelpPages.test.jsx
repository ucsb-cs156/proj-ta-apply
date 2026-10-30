import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import HelpTaApplicantsPage from "main/pages/Help/HelpTaApplicantsPage";
import HelpUlaApplicantsPage from "main/pages/Help/HelpUlaApplicantsPage";
import HelpInstructorsPage from "main/pages/Help/HelpInstructorsPage";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import { NOTICE_FIELD_EXAMPLES } from "main/utils/noticeFields";
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
    expect(
      screen.getByText(/review and rank the applicants/),
    ).toBeInTheDocument();
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
    ).toHaveLength(6);
    expect(
      screen.getByText(/first open stamps the actual opening date/),
    ).toBeInTheDocument();
    expect(screen.getByText(/ADMIN_EMAILS/)).toBeInTheDocument();
    // Issue #150: the notices fields, documented under TA App Settings with the issue's examples.
    const fieldsHeading = document.getElementById("notice-fields");
    expect(fieldsHeading.tagName).toBe("H3");
    expect(fieldsHeading).toHaveTextContent("Fields in the notices text");
    expect(
      screen.getByTestId("HelpAdminsPage-notice-fields"),
    ).toHaveTextContent(
      "${quarter} becomes the quarter, written out (for example Winter 2026), and ${primaryConsiderationDate} becomes the primary consideration date (for example January 20, 2026)",
    );
    expect(
      [
        ...screen
          .getByTestId("HelpAdminsPage-notice-field-examples")
          .querySelectorAll("li"),
      ].map((li) => li.textContent),
    ).toEqual(NOTICE_FIELD_EXAMPLES);
    expect(screen.getByRole("link", { name: "fields" })).toHaveAttribute(
      "href",
      "#notice-fields",
    );
    expect(
      screen.getByRole("link", { name: "CSV Upload/Download Formats" }),
    ).toHaveAttribute("href", "/help/csv");
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
      /Add one with Add New Instructor, or many at once by uploading a CSV of emails \(the format is on the CSV Upload\/Download Formats page\)\./,
    );
    const buttons = [
      ...screen
        .getByTestId("HelpAdminsPage-recruitment-buttons")
        .querySelectorAll("li"),
    ].map((li) => li.textContent);
    expect(buttons[0]).toMatch(
      /^Open Applications \/ Close Applications\. Recruitments do not open/,
    );
    expect(buttons[1]).toMatch(/from the schedule\. Populate re-runs the job/);
    expect(buttons[1]).toMatch(/finds it again\. Remove takes a lecture out/);
    expect(buttons[4]).toMatch(/Each has a View page \(everything/);
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
