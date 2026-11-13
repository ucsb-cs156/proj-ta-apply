import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import applicationsFixtures from "fixtures/applicationsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";

describe("ApplicationSummary tests", () => {
  test("shows the common answers", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    expect(screen.getByTestId("ApplicationSummary-Name")).toHaveTextContent(
      "Ada M Lovelace",
    );
    expect(screen.getByTestId("ApplicationSummary-Major")).toHaveTextContent(
      "Computer Science",
    );
    expect(
      screen.getByTestId("ApplicationSummary-GPA in Major"),
    ).toHaveTextContent("3.9");
    expect(
      screen.getByTestId("ApplicationSummary-Expected Graduation"),
    ).toHaveTextContent("S27");
  });

  test("says First quarter in place of the GPAs of a first quarter applicant (issue #292)", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          firstQuarter: true,
          gpaMajor: null,
          gpaOverall: null,
        }}
        type="TA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-GPA in Major"),
    ).toHaveTextContent("First quarter");
    expect(
      screen.getByTestId("ApplicationSummary-Overall GPA"),
    ).toHaveTextContent("First quarter");
  });

  test("shows the notice version agreed to, ticked and read-only", () => {
    render(
      <MemoryRouter>
        <ApplicationSummary
          application={applicationsFixtures.oneTaApplication} // noticeVersionId: 1
          type="TA"
          notice={noticesFixtures.taV1}
        />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByTestId("ApplicationSummary-notice-content")
        .querySelector("h1"),
    ).toHaveTextContent("TA Terms");
    const box = screen.getByTestId("ApplicationSummary-notice-agree");
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  /** If the versions disagree (should not happen), the box is honest about it. */
  test("a notice the application did not agree to is shown unticked", () => {
    render(
      <MemoryRouter>
        <ApplicationSummary
          application={applicationsFixtures.oneTaApplication} // noticeVersionId: 1
          type="TA"
          notice={noticesFixtures.taV2}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("ApplicationSummary-notice-agree"),
    ).not.toBeChecked();
  });

  test("without a notice no agreement section is shown", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );
    expect(screen.queryByTestId("ApplicationSummary-notice")).toBeNull();
  });

  /** Issue #443: the radio buttons of a table, as a list of "row: checked level". */
  const checkedIn = (cell) =>
    [...cell.querySelectorAll("tbody tr")].map((row) => {
      const checked = [...row.querySelectorAll("input")].find((r) => r.checked);
      return `${row.querySelector("td").textContent}: ${checked?.value ?? "none"}`;
    });

  /** Issue #443: the form's topic table, read-only, in topic order. */
  test("shows the topic ratings in the form's table, read-only, in topic order", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          topicProficiencies: { React: 3, Java: 5 },
        }}
        type="TA"
      />,
    );

    const cell = screen.getByTestId("ApplicationSummary-Topic Proficiency");
    expect(checkedIn(cell)).toEqual(["Java: 5", "React: 3"]);
    expect(
      [...cell.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual(["Topic", "5 highest", "4", "3", "2", "1 lowest"]);
    const table = cell.querySelector("table");
    expect(table).toHaveClass("selection-table-read-only", "w-auto");
    cell.querySelectorAll("input").forEach((radio) => {
      expect(radio).toBeDisabled();
      expect(radio).toHaveAttribute("readonly");
    });
    expect(screen.getByTestId("ApplicationSummary-topic-Java-5")).toBeChecked();
    // No "level / top" text any more.
    expect(cell.textContent).not.toContain("/");
    expect(cell).not.toHaveAttribute("style");
  });

  /** The ULA form rates topics on three levels, and asks about interests as well. */
  test("a ULA summary shows the three-point topic scale and the interest levels", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          topicProficiencies: { React: 1, JavaScript: 3 },
          interests: { Tutoring: 5, Grading: 2 },
        }}
        type="ULA"
      />,
    );

    const topics = screen.getByTestId("ApplicationSummary-Topic Proficiency");
    expect(checkedIn(topics)).toEqual(["JavaScript: 3", "React: 1"]);
    expect(
      [...topics.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "Topic",
      "1 Very comfortable",
      "2 Somewhat comfortable",
      "3 Not familiar",
    ]);
    const interests = screen.getByTestId("ApplicationSummary-Interests");
    expect(checkedIn(interests)).toEqual(["Grading: 2", "Tutoring: 5"]);
    expect(
      [...interests.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "Interest",
      "5 Very interested",
      "4",
      "3",
      "2",
      "1 Not interested",
    ]);
    expect(
      screen.getByTestId("ApplicationSummary-interest-Tutoring-5"),
    ).toBeDisabled();
  });

  test("a ULA application with no interest answers shows a blank interests row", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          interests: null,
        }}
        type="ULA"
      />,
    );

    const cell = screen.getByTestId("ApplicationSummary-Interests");
    expect(cell.textContent).toBe("");
    expect(cell.querySelector("table")).toBeNull();
  });

  test("a TA summary has no interests row", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    expect(screen.queryByTestId("ApplicationSummary-Interests")).toBeNull();
  });

  test("an application with no ratings shows a blank rating row", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          topicProficiencies: null,
        }}
        type="TA"
      />,
    );

    const cell = screen.getByTestId("ApplicationSummary-Topic Proficiency");
    expect(cell.textContent).toBe("");
    expect(cell.querySelector("table")).toBeNull();
  });

  /** Codes are for the database; a person reading their own application should see words. */
  test("shows the TA-only answers, spelled out", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-Class Level"),
    ).toHaveTextContent("PhD");
    expect(
      screen.getByTestId("ApplicationSummary-Residency Status"),
    ).toHaveTextContent("F1 Student Visa");
    expect(
      screen.getByTestId("ApplicationSummary-TA Language Exam"),
    ).toHaveTextContent("passed (F1 or J1 visa)");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Quarter and Year Language Exam Passed",
      ),
    ).toHaveTextContent("F25");
    expect(screen.queryByTestId("ApplicationSummary-Video Link")).toBeNull();
  });

  test("shows the ULA-only answers and not the TA ones", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneUlaApplication}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-Video Link"),
    ).toHaveTextContent("https://example.org/chris");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Quarters Previously Served as a ULA",
      ),
    ).toHaveTextContent("2");

    expect(screen.queryByTestId("ApplicationSummary-Class Level")).toBeNull();
    expect(
      screen.queryByTestId("ApplicationSummary-Residency Status"),
    ).toBeNull();
  });

  test("lists the prior coursework in a read-only table", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-coursework-cell-row-2-col-school"),
    ).toHaveTextContent("Another University");
    expect(
      screen.getByTestId(
        "ApplicationSummary-coursework-cell-row-0-col-courseNumber",
      ),
    ).toHaveTextContent("CMPSC 263");
    expect(
      screen.queryByTestId(
        "ApplicationSummary-coursework-cell-row-0-col-edit-button",
      ),
    ).toBeNull();
    expect(
      screen.queryByTestId("ApplicationSummary-coursework-none"),
    ).toBeNull();
  });

  test("an application with no courses says so", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          priorCoursework: [],
        }}
        type="TA"
      />,
    );
    expect(
      screen.getByTestId("ApplicationSummary-coursework-none"),
    ).toHaveTextContent("No courses listed.");
  });

  test("an application whose course list is missing is treated as empty", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          priorCoursework: undefined,
        }}
        type="TA"
      />,
    );
    expect(
      screen.getByTestId("ApplicationSummary-coursework-none"),
    ).toBeInTheDocument();
  });

  test("the availability answers read as yes and no", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a First Choice Lecture",
      ),
    ).toHaveTextContent("Yes");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a Second Choice Lecture",
      ),
    ).toHaveTextContent("No");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a First Choice Discussion",
      ),
    ).toHaveTextContent("Yes");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a Second Choice Discussion",
      ),
    ).toHaveTextContent("No");
  });

  test("shows the availability comments for each choice", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          availabilityCommentsFirstChoice: "Free any afternoon but Wednesday.",
          availabilityCommentsSecondChoice: null,
        }}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId(
        "ApplicationSummary-First Choice Availability Comments",
      ),
    ).toHaveTextContent("Free any afternoon but Wednesday.");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Second Choice Availability Comments",
      ).textContent,
    ).toBe("");
  });

  test("course choices keep their padding", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    const first = screen.getByTestId("ApplicationSummary-First Choice Course");
    expect(first).toHaveStyle({ whiteSpace: "pre", fontFamily: "monospace" });
    expect(first.textContent).toBe("CMPSC   156");
  });

  /**
   * Issue #443: the form's course table, read-only: the two choices spanning their rows, then each
   * marked course with its answer checked, in course order whatever order the map is in.
   */
  test("shows the other courses of interest in the form's table, read-only, in course order", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          firstChoiceCourse: "CMPSC   156",
          secondChoiceCourse: "CMPSC   130A",
          courseInterests: {
            "CMPSC    16": "WOULD_CONSIDER",
            "CMPSC     8": "ENTHUSIASTIC",
          },
        }}
        type="TA"
      />,
    );

    const other = screen.getByTestId(
      "ApplicationSummary-Other Courses of Interest",
    );
    expect(
      [...other.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "Course",
      "Enthusiastic",
      "Would Consider",
      "Not Applicable / Not Interested",
    ]);
    // "Not Applicable /" over "Not Interested"; the other headings are one line.
    const stacked = other.querySelectorAll("thead th")[3];
    expect(stacked.querySelectorAll("br")).toHaveLength(1);
    expect(stacked.innerHTML).toBe("Not Applicable / <br>Not Interested");
    expect(
      [...other.querySelectorAll("thead th")]
        .slice(1, 3)
        .map((th) => th.innerHTML),
    ).toEqual(["Enthusiastic", "Would Consider"]);
    const rows = [...other.querySelectorAll("tbody tr")];
    expect(rows.map((row) => row.querySelector("td").textContent)).toEqual([
      "CMPSC     8",
      "CMPSC    16",
      "CMPSC   130A",
      "CMPSC   156",
    ]);
    expect(
      screen.getByTestId(
        "ApplicationSummary-courseInterest-CMPSC-8-ENTHUSIASTIC",
      ),
    ).toBeChecked();
    expect(
      screen.getByTestId(
        "ApplicationSummary-courseInterest-CMPSC-16-WOULD_CONSIDER",
      ),
    ).toBeChecked();
    expect(
      screen.getByTestId("ApplicationSummary-courseInterest-CMPSC-156-choice"),
    ).toHaveTextContent("1st choice");
    expect(
      screen.getByTestId("ApplicationSummary-courseInterest-CMPSC-130A-choice"),
    ).toHaveTextContent("2nd choice");
    other.querySelectorAll("input").forEach((radio) => {
      expect(radio).toBeDisabled();
      // Each button has its own id, its test id, so its label and others' never mix.
      expect(radio).toHaveAttribute("id", radio.dataset.testid);
    });
    expect(other.querySelector("table")).toHaveClass(
      "selection-table-read-only",
    );
    expect(rows[0].querySelector("td")).toHaveClass("selection-table-course");
    // No warnings column: the untaken-course warnings are for the applicant's form.
    expect(other.querySelector('th[aria-label="Warnings"]')).toBeNull();
    expect(rows[0].querySelectorAll("td")).toHaveLength(4);
  });

  test("a course marked Not Interested is shown with that answer checked", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          firstChoiceCourse: null,
          secondChoiceCourse: null,
          courseInterests: { "CMPSC    24": "NOT_INTERESTED" },
        }}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId(
        "ApplicationSummary-courseInterest-CMPSC-24-NOT_INTERESTED",
      ),
    ).toBeChecked();
  });

  test("with no choices and no other courses marked, that row is blank", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          firstChoiceCourse: "",
          secondChoiceCourse: null,
          courseInterests: {},
        }}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-Other Courses of Interest")
        .textContent,
    ).toBe("");
  });

  /** An application stored before the table existed may come back with no map at all. */
  test("a missing course interest map shows the choices alone", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          firstChoiceCourse: "CMPSC   156",
          secondChoiceCourse: "CMPSC   156",
          courseInterests: null,
        }}
        type="ULA"
      />,
    );

    const rows = screen
      .getByTestId("ApplicationSummary-Other Courses of Interest")
      .querySelectorAll("tbody tr");
    // A course named as both choices is listed once.
    expect(rows).toHaveLength(1);
    expect(
      screen.getByTestId("ApplicationSummary-courseInterest-CMPSC-156-choice"),
    ).toHaveTextContent("1st choice");
  });

  /** An unanswered question should read as unanswered, not as "null". */
  test("missing answers render blank", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          middleName: null,
          videoLink: null,
          previousServiceAsUla: null,
          comments: "",
        }}
        type="ULA"
      />,
    );

    expect(screen.getByTestId("ApplicationSummary-Name")).toHaveTextContent(
      "Chris Gaucho",
    );
    expect(
      screen.getByTestId("ApplicationSummary-Video Link"),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Quarters Previously Served as a ULA",
      ),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("ApplicationSummary-Anything Else"),
    ).toHaveTextContent("");
  });

  /** An unrecognised code is better shown as nothing than as the raw code. */
  test("an unrecognised enum value renders blank", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          classLevel: "SOMETHING_ELSE",
          residencyStatus: null,
          languageExam: null,
        }}
        type="TA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-Class Level"),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("ApplicationSummary-Residency Status"),
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("ApplicationSummary-TA Language Exam"),
    ).toHaveTextContent("");
  });

  test("the test id prefix can be overridden", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
        testIdPrefix="ApplicationPage-summary"
      />,
    );

    expect(
      screen.getByTestId("ApplicationPage-summary-Major"),
    ).toBeInTheDocument();
  });

  /** Issue #72: the ULA questions from the Google Form, spelled out. */
  test("a ULA summary shows the Google Form questions' answers, spelled out", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneUlaApplication}
        type="ULA"
      />,
    );

    const row = (label) => screen.getByTestId(`ApplicationSummary-${label}`);
    expect(row("Perm Number")).toHaveTextContent("A1B2C3D");
    expect(row("BS/MS Student")).toHaveTextContent("Yes");
    expect(row("Student Status in the Quarter Applied For")).toHaveTextContent(
      "Undergraduate",
    );
    expect(row("Wants TA Eligibility (Fall TA Training)")).toHaveTextContent(
      "Yes",
    );
    expect(row("Other Campus Job")).toHaveTextContent("Not sure yet");
    expect(row("Prior UCSB Employment")).toHaveTextContent("Yes");
    expect(row("Employee ID")).toHaveTextContent("1234567");
    expect(row("I-9 Verification Agreement")).toHaveTextContent("No");
    expect(row("Changing Major")).toHaveTextContent("No");
    // Not a first-time applicant, so the training question was not asked.
    expect(row("Training Commitment").textContent).toBe("");
    expect(row("Training Commitment Explanation").textContent).toBe("");
  });

  test("a ULA summary spells out the training commitment when it was answered", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          previousServiceAsUla: 0,
          trainingCommitment: "UNSURE",
          trainingCommitmentExplanation: "Might have a Friday lab",
          studentStatusNextQuarter: "GRADUATE",
          otherCampusJob: "YES",
          bsMsStudent: null,
        }}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-Training Commitment"),
    ).toHaveTextContent(
      "I am UNSURE if I can commit to this training at this point.",
    );
    expect(
      screen.getByTestId("ApplicationSummary-Training Commitment Explanation"),
    ).toHaveTextContent("Might have a Friday lab");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Student Status in the Quarter Applied For",
      ),
    ).toHaveTextContent("Graduate");
    expect(
      screen.getByTestId("ApplicationSummary-Other Campus Job"),
    ).toHaveTextContent("Yes");
    expect(
      screen.getByTestId("ApplicationSummary-BS/MS Student").textContent,
    ).toBe("");
  });

  test("a TA summary has none of the ULA questions", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    for (const label of [
      "Perm Number",
      "BS/MS Student",
      "Other Campus Job",
      "Prior UCSB Employment",
      "I-9 Verification Agreement",
      "Training Commitment",
      "Changing Major",
    ]) {
      expect(screen.queryByTestId(`ApplicationSummary-${label}`)).toBeNull();
    }
  });

  /** Only the ULA form asks about availability (issue #76). */
  test("a TA summary has no availability rows", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    for (const label of [
      "Available for a First Choice Lecture",
      "Available for a First Choice Discussion",
      "First Choice Availability Comments",
      "Available for a Second Choice Lecture",
      "Available for a Second Choice Discussion",
      "Second Choice Availability Comments",
    ]) {
      expect(screen.queryByTestId(`ApplicationSummary-${label}`)).toBeNull();
    }
    expect(
      screen.getByTestId("ApplicationSummary-First Choice Course"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationSummary-Second Choice Course"),
    ).toBeInTheDocument();
    // Exactly the TA rows, nothing in place of the availability ones.
    expect(
      screen.getByTestId("ApplicationSummary").querySelectorAll("dt"),
    ).toHaveLength(16);
  });

  /** Issue #77: the agreement is shown first on the summary too, as on the form. */
  test("the notice agreement comes before the answers", () => {
    render(
      <MemoryRouter>
        <ApplicationSummary
          application={applicationsFixtures.oneTaApplication}
          type="TA"
          notice={noticesFixtures.taV1}
        />
      </MemoryRouter>,
    );

    const notice = screen.getByTestId("ApplicationSummary-notice");
    const answers = screen.getByTestId("ApplicationSummary");
    expect(
      notice.compareDocumentPosition(answers) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /** Issue #107: a cancelled application says so first, with when and why. */
  test("a cancelled application leads with the cancellation", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneCancelledApplication}
        type="ULA"
      />,
    );

    const row = screen.getByTestId("ApplicationSummary-Cancelled");
    expect(row).toHaveTextContent("Found other employment");
    expect(row).toHaveTextContent("2/3/2026, 4:05:00 AM");
    // It comes before everything else.
    expect(
      row.compareDocumentPosition(
        screen.getByTestId("ApplicationSummary-Name"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("an application that was not cancelled has no such row", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneUlaApplication}
        type="ULA"
      />,
    );
    expect(screen.queryByTestId("ApplicationSummary-Cancelled")).toBeNull();
  });

  // ---- issue #296: the same summary shows a draft ----

  const yesNoLabels = [
    "Available for a First Choice Lecture",
    "Available for a First Choice Discussion",
    "Available for a Second Choice Lecture",
    "Available for a Second Choice Discussion",
  ];

  test("a draft's yes/no questions the applicant has not answered read as blank, not No", () => {
    render(
      <ApplicationSummary
        application={draftApplicationsFixtures.emptyUlaDraft}
        type="ULA"
        draft
      />,
    );

    yesNoLabels.forEach((label) =>
      expect(
        screen.getByTestId(`ApplicationSummary-${label}`).textContent,
      ).toBe(""),
    );
    expect(
      screen.getByTestId("ApplicationSummary-Perm Number").textContent,
    ).toBe("");
  });

  test("a draft's answered yes/no questions read Yes or No", () => {
    render(
      <ApplicationSummary
        application={{
          ...draftApplicationsFixtures.savedUlaDraft,
          availableForLecturesFirstChoice: true,
        }}
        type="ULA"
        draft
      />,
    );

    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a First Choice Lecture",
      ).textContent,
    ).toBe("Yes");
    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a Second Choice Lecture",
      ).textContent,
    ).toBe("No");
    expect(screen.getByTestId("ApplicationSummary-Name")).toHaveTextContent(
      "Dana Draft",
    );
  });

  test("a submitted application with an unanswered yes/no question still reads No", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          availableForLecturesFirstChoice: null,
        }}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId(
        "ApplicationSummary-Available for a First Choice Lecture",
      ).textContent,
    ).toBe("No");
  });

  test("a draft shows the same rows as an application, in the same order", () => {
    const labels = () =>
      [...document.querySelectorAll("dt")].map((dt) => dt.textContent);
    const { unmount } = render(
      <ApplicationSummary
        application={draftApplicationsFixtures.savedUlaDraft}
        type="ULA"
        draft
      />,
    );
    const forDraft = labels();
    unmount();
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneUlaApplication}
        type="ULA"
      />,
    );

    expect(forDraft).toEqual(labels());
  });
});
