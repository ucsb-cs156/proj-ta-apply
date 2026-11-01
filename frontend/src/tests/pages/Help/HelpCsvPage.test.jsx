import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import HelpCsvPage from "main/pages/Help/HelpCsvPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import csvFixtures from "fixtures/csvFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

describe("HelpCsvPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  axiosMock
    .onGet("/api/currentUser")
    .reply(200, apiCurrentUserFixtures.userOnly);
  axiosMock
    .onGet("/api/systemInfo")
    .reply(200, systemInfoFixtures.showingNeither);

  const queryClient = new QueryClient();
  test("renders expected content", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "CSV Upload/Download Formats",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Email List CSV Upload formats",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "CSV Download formats" }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("emailUploadsAccordion")).toBeInTheDocument();
    expect(screen.getByText("Instructor Emails")).toBeInTheDocument();
    // There is no grad student list any more (issue #45).
    expect(screen.queryByText("Grad Student Emails")).toBeNull();
    expect(screen.queryByTestId("gradStudentCsvExample")).toBeNull();
    expect(
      screen.getByText(/on the Instructors admin page/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("emailUploadsIntro").textContent).toBe(
      "The file must have a header row containing a column named email " +
        "(the header name is case-insensitive); a file with just that column " +
        "is enough. Each row is processed independently: an address that is " +
        "already on the list is skipped rather than reported as an error, " +
        "and a malformed row is skipped and reported rather than aborting " +
        "the rows that already succeeded. Re-uploading the same file is " +
        "therefore safe.",
    );
    expect(screen.getByTestId("instructorCsvExample").textContent).toBe(
      csvFixtures.instructorEmails,
    );
    expect(screen.getByTestId("instructorCsvDescription").textContent).toBe(
      "On the Instructors admin page, admins can upload a CSV of " +
        "instructors. Each address uploaded is permitted to log in as an " +
        "instructor and review applications for their own courses. A " +
        "catalogName column, when present, sets each instructor's catalog " +
        "name (including for an instructor already on the list) when the " +
        "value is a name on record, one the Populate Courses job has seen; " +
        "other columns, such as firstName and lastName, are accepted but " +
        "ignored, since names come from the users table when the instructor " +
        "first logs in. Here is an example file:",
    );

    // Issue #172: the Instructors page's download, in the shape the upload accepts.
    expect(
      screen.getByTestId("instructorsDownloadDescription").textContent,
    ).toBe(
      "The Instructors admin page offers a Download Instructors (CSV) " +
        "button that saves the whole list: columns email, firstName, " +
        "lastName and catalogName, with a header row and every cell quoted. " +
        "The upload accepts this shape, so the list can be moved from one " +
        "deployment to another; the name columns are blank for an " +
        "instructor who has not logged in yet.",
    );

    // Issue #179: the rankings CSV's tentativeAssignment column and planning rows.
    expect(screen.getByTestId("rankingsCsvDescription")).toHaveTextContent(
      "Download Rankings CSV on a recruitment's Courses page saves the faculty rankings: the applicant identity columns for the recruitment's type, then tentativeAssignment",
    );
    expect(screen.getByTestId("rankingsCsvDescription")).toHaveTextContent(
      "three planning rows labelled Allocation, Assigned and Left to assign in the first column, with each lecture's numbers under its column and every other cell blank; applicant rows follow.",
    );
    // Issue #188: course headings are the bare number, with the section only when needed.
    expect(screen.getByTestId("rankingsCsvDescription")).toHaveTextContent(
      "then one column per lecture, headed by the bare course number (16), or 16 (section 0100) when the recruitment has more than one section of that course, holding that lecture's rank for the applicant.",
    );

    expect(screen.getByTestId("downloadsSummary")).toHaveTextContent(
      "the Recruitments admin page offers a CSV button per recruitment that downloads every application to it",
    );
    expect(screen.getByTestId("applicationsCsvDescription")).toHaveTextContent(
      "C++:5,Java:4",
    );
    expect(screen.getByTestId("applicationsCsvDescription")).toHaveTextContent(
      "courses separated by semicolons",
    );
    // Issue #72: the ULA questions are columns of a ULA file too.
    expect(screen.getByTestId("applicationsCsvDescription")).toHaveTextContent(
      "permNumber, bsMsStudent",
    );
  });

  test("documents the App Settings lists CSV shape, with an anchor the admin pages link to", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "App Settings Lists CSV formats (Majors, Topics and Interests)",
    });
    expect(heading).toHaveAttribute("id", "settings-lists");
    expect(screen.getByTestId("settingsListsDescription")).toHaveTextContent(
      "can be downloaded as a CSV file and filled from one",
    );
    expect(screen.getByTestId("settingsListsAccordion")).toBeInTheDocument();
    expect(screen.getByText("Download format")).toBeInTheDocument();
    expect(screen.getByText("Upload format")).toBeInTheDocument();
    expect(screen.getByTestId("settingsDownloadCsvExample").textContent).toBe(
      csvFixtures.settingsNames,
    );
    expect(screen.getByTestId("settingsUploadCsvExample").textContent).toBe(
      csvFixtures.settingsNamesLenient,
    );
    expect(screen.getByTestId("settingsUploadDescription")).toHaveTextContent(
      "the header name is case-insensitive",
    );
    expect(
      screen.getByTestId("settingsUploadDescription").textContent,
    ).toContain("must contain a column named name (the header");
  });

  test("scrolls to the section named in the url hash", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/help/csv#settings-lists"]}>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.instances[0]).toHaveAttribute(
      "id",
      "settings-lists",
    );
  });

  test("does not scroll when there is no hash or the hash matches nothing", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/help/csv"]}>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1 });
    expect(scrollIntoView).not.toHaveBeenCalled();
    unmount();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/help/csv#nowhere"]}>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1 });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  /** Issue #65: the legacy import's format, with the anchor the TA App Settings card links to. */
  test("documents the legacy TA applications import", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Legacy TA Applications CSV upload format",
      }),
    ).toHaveAttribute("id", "legacy-ta-applications");
    expect(screen.getByTestId("legacyImportDescription")).toHaveTextContent(
      "creates one application per row in that quarter's TA recruitment, as if the student had entered it",
    );
    expect(screen.getByTestId("legacyImportMapping")).toHaveTextContent(
      "CS as a major means Computer Science",
    );
    expect(screen.getByTestId("legacyImportCsvExample").textContent).toBe(
      csvFixtures.legacyTaApplications,
    );
  });

  /** Issue #70: the ULA form's responses import, with the anchor the ULA settings card links to. */
  test("documents the ULA form responses import", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: "ULA Form Responses CSV upload format",
      }),
    ).toHaveAttribute("id", "legacy-ula-applications");
    expect(screen.getByTestId("legacyUlaImportDescription")).toHaveTextContent(
      "creates one application per row in that quarter's ULA recruitment",
    );
    expect(screen.getByTestId("legacyUlaImportMapping")).toHaveTextContent(
      "CSIL computing environment matches CSIL",
    );
    expect(screen.getByTestId("legacyUlaImportCsvExample").textContent).toBe(
      csvFixtures.legacyUlaResponses,
    );
  });

  test("describes the two published-assignments downloads (issue #180)", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1 });

    const description = screen.getByTestId("assignmentsCsvDescription");
    expect(description).toHaveTextContent(
      "Download CSV (row per course) has Course (for example CMPSC 8), Instructor, Instructor email (Not mapped when no single instructor record has that catalog name), then one column per assigned person headed TA or ULA holding First Last (email)",
    );
    expect(description).toHaveTextContent(
      "Download CSV (row per student) has First name, Last name, Email, Course assignment, Course instructor, Course instructor email and, for a ULA recruitment, First time ULA",
    );
    expect(
      description.compareDocumentPosition(
        screen.getByTestId("downloadsSummary"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
