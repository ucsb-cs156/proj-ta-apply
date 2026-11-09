import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import HelpInstructorFeedbackFieldsPage from "main/pages/Help/HelpInstructorFeedbackFieldsPage";
import HelpAdminsPage from "main/pages/Help/HelpAdminsPage";
import { ORIGINAL_FEEDBACK_NOTES } from "main/utils/feedbackNotesFields";
import { QUARTER_NOTICE_FIELDS } from "main/utils/noticeFields";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);
axiosMock
  .onGet("/api/currentUser")
  .reply(200, apiCurrentUserFixtures.adminUser);
axiosMock
  .onGet("/api/systemInfo")
  .reply(200, systemInfoFixtures.showingNeither);

const renderPage = (page) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );

/** Issue #429: the fields of the notes on TA/ULA tradeoffs, and where Help explains the page. */
describe("Instructor Feedback Fields help (issue #429)", () => {
  test("lists the three cost fields with examples", async () => {
    renderPage(<HelpInstructorFeedbackFieldsPage />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Instructor Feedback Fields",
      }),
    ).toBeInTheDocument();
    const rows = [
      ...screen
        .getByTestId("HelpInstructorFeedbackFieldsPage-cost-fields")
        .querySelectorAll("tbody tr"),
    ];
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      "HelpInstructorFeedbackFieldsPage-field-estimatedCostPerTA",
      "HelpInstructorFeedbackFieldsPage-field-estimatedCostPerULA",
      "HelpInstructorFeedbackFieldsPage-field-taToUlaCostRatio",
    ]);
    expect(
      [...rows[0].querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual([
      "${estimatedCostPerTA}",
      "The quarter's estimated cost of one TA, from its budget",
      "$12,000.00",
    ]);
    expect(rows[1].querySelectorAll("td")[2].textContent).toBe("$2,000.00");
    expect(rows[2].querySelectorAll("td")[2].textContent).toBe("1:6.0");
    expect(
      screen.getByText(/A cost that has not been entered, or is zero/),
    ).toHaveTextContent(
      "These come from the quarter's Budget for Quarter page. A cost that has not been entered, or is zero, reads “not yet set”, and so does the ratio, which needs both. The examples are for a TA at $12,000.00 and a ULA at $2,000.00.",
    );
    expect(
      screen.getByRole("link", { name: "Budget for Quarter" }),
    ).toHaveAttribute("href", "/admin/budget/selectQuarter");
  });

  test("lists the quarter's fields as the Notices Fields page does, and says the deadline is not one", async () => {
    renderPage(<HelpInstructorFeedbackFieldsPage />);

    const intro = (await screen.findByText(/can carry fields, written as/))
      .textContent;
    expect(intro).toBe(
      "The Notes on TA/ULA tradeoffs on the Instructor Feedback Settings page can carry fields, written as ${name}, that are filled in for each instructor from the quarter of the course they are giving feedback on. They are the fields of the Notices, except ${primaryConsiderationDate}, which belongs to a recruitment rather than a quarter and so stays as written here, and three of their own, from the quarter's budget. Anything else between ${ and } is left exactly as typed, and so is a quarter field whose value is not on file.",
    );
    expect(
      screen.getByRole("link", { name: "Instructor Feedback Settings" }),
    ).toHaveAttribute("href", "/admin/instructorFeedbackSettings");
    expect(screen.getByRole("link", { name: "Notices" })).toHaveAttribute(
      "href",
      "/help/notice-fields",
    );
    expect(screen.getByText(/is the quarter written out/).textContent).toBe(
      "${quarter} is the quarter written out, such as Fall 2021. The others come from the Quarters calendar, as for the notices. The examples are for FALL 2021.",
    );
    expect(screen.getByRole("link", { name: "Quarters" })).toHaveAttribute(
      "href",
      "/admin/quarters",
    );
    expect(
      screen
        .getByTestId("HelpInstructorFeedbackFieldsPage-quarter-fields")
        .querySelectorAll("tbody tr"),
    ).toHaveLength(QUARTER_NOTICE_FIELDS.length);
    expect(
      screen.getByTestId("HelpInstructorFeedbackFieldsPage-field-pass1Begin")
        .textContent,
    ).toBe("${pass1Begin}Pass 1 beginsMay 10, 2021 at 9:00 AM");
  });

  test("shows the original notes as written and as an instructor sees them", async () => {
    renderPage(<HelpInstructorFeedbackFieldsPage />);

    expect(
      (
        await screen.findByTestId(
          "HelpInstructorFeedbackFieldsPage-example-written",
        )
      ).textContent,
    ).toBe(ORIGINAL_FEEDBACK_NOTES);
    expect(
      screen.getByText(/The notes as they were first installed/),
    ).toHaveTextContent(
      "The notes as they were first installed, written with the cost fields, then as an instructor would see them for FALL 2021:",
    );
    const filled = screen.getByTestId(
      "HelpInstructorFeedbackFieldsPage-example-filled",
    );
    expect([...filled.querySelectorAll("p")].map((p) => p.textContent)[0]).toBe(
      "Note that the current estimated cost of a TA is $12,000.00 while the estimated cost of a ULA is $2,000.00. This means that on a cost basis, the ratio of TA to ULA is 1:6.0.",
    );
    expect(filled.querySelectorAll("p")).toHaveLength(3);
  });

  test("the admins page explains Instructor Feedback Settings and links to its fields", async () => {
    renderPage(<HelpAdminsPage />);

    const section = await screen.findByTestId(
      "HelpAdminsPage-instructor-feedback-settings",
    );
    expect(section).toHaveTextContent(
      "Instructor Feedback Settings holds the Notes on TA/ULA tradeoffs that instructors can open under the form where they give feedback on each course's TA and ULA allocation. It is edited as the notices are: in the same Markdown with a live preview, filled in for a quarter chosen above the editor (by default the newest quarter with a recruitment), and each save is kept as a new version, listed with who saved it and when. Instructors always see the newest version. The text can carry the quarter's name and dates, as the notices can, and three fields of its own, the quarter's estimated cost of a TA, of a ULA and the ratio of the two, each “not yet set” until the quarter's budget has it. They are listed, with the text the notes started with as an example, on Help → Instructor Feedback Fields.",
    );
    // Issue #430: the checkbox above the notes.
    expect(section).toHaveTextContent(
      "Help → Instructor Feedback Fields. Above the notes, the checkbox Ask faculty for feedback on TA/ULA allocations after both have been released to instructors turns the whole feedback section of every course on the instructors' home page on or off; it is saved when clicked, and is checked unless an admin unchecks it. While it is unchecked, instructors see no waiting message, form or notes, and cannot save feedback, but what they gave before is kept.",
    );
    const links = [...section.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(links).toEqual([
      "/admin/instructorFeedbackSettings",
      "#markdown",
      "/help/instructor-feedback-fields",
    ]);
    expect(
      document.getElementById("instructor-feedback-settings").tagName,
    ).toBe("H2");
  });
});
