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
    expect(screen.getByTestId("instructorCsvExample").textContent).toBe(
      csvFixtures.instructorEmails,
    );
    expect(screen.getByTestId("instructorCsvDescription").textContent).toBe(
      "On the Instructors admin page, admins can upload a CSV of " +
        "instructor email addresses. Each address uploaded is permitted " +
        "to log in as an instructor and review applications for their own " +
        "courses. Here is an example file (note that the name column is " +
        "ignored; only the email column is used):",
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
});
