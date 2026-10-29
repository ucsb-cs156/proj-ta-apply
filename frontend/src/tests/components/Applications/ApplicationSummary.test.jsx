import { render, screen } from "@testing-library/react";

import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import applicationsFixtures from "fixtures/applicationsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";

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

  test("shows the notice version agreed to, ticked and read-only", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication} // noticeVersionId: 1
        type="TA"
        notice={noticesFixtures.taV1}
      />,
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
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication} // noticeVersionId: 1
        type="TA"
        notice={noticesFixtures.taV2}
      />,
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

  test("lists the topic ratings one per line, in topic order", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
          topicProficiencies: { React: 3, Java: 5 },
        }}
        type="TA"
      />,
    );

    const cell = screen.getByTestId(
      "ApplicationSummary-Topic Proficiency (1 lowest to 5 highest)",
    );
    expect(cell.textContent).toBe("Java: 5 / 5\nReact: 3 / 5");
    expect(cell).toHaveStyle({ whiteSpace: "pre" });
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

    const topics = screen.getByTestId(
      "ApplicationSummary-Topic Proficiency (1 very comfortable to 3 not familiar)",
    );
    expect(topics.textContent).toBe("JavaScript: 3 / 3\nReact: 1 / 3");
    const interests = screen.getByTestId(
      "ApplicationSummary-Interests (1 not interested to 5 very interested)",
    );
    expect(interests.textContent).toBe("Grading: 2 / 5\nTutoring: 5 / 5");
    expect(interests).toHaveStyle({ whiteSpace: "pre" });
    expect(
      screen.queryByTestId(
        "ApplicationSummary-Topic Proficiency (1 lowest to 5 highest)",
      ),
    ).toBeNull();
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

    expect(
      screen.getByTestId(
        "ApplicationSummary-Interests (1 not interested to 5 very interested)",
      ).textContent,
    ).toBe("");
  });

  test("a TA summary has no interests row", () => {
    render(
      <ApplicationSummary
        application={applicationsFixtures.oneTaApplication}
        type="TA"
      />,
    );

    expect(
      screen.queryByTestId(
        "ApplicationSummary-Interests (1 not interested to 5 very interested)",
      ),
    ).toBeNull();
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

    expect(
      screen.getByTestId(
        "ApplicationSummary-Topic Proficiency (1 lowest to 5 highest)",
      ).textContent,
    ).toBe("");
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

  /** One course per line, padded so the ids line up, in course order whatever order the map is in. */
  test("lists the other courses of interest, spelled out and in course order", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneTaApplication,
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
    expect(other.textContent).toBe(
      "CMPSC     8  Enthusiastic\nCMPSC    16  Would Consider",
    );
    expect(other).toHaveStyle({ whiteSpace: "pre", fontFamily: "monospace" });
  });

  test("with no other courses marked, that row is blank", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
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
  test("a missing course interest map reads as blank", () => {
    render(
      <ApplicationSummary
        application={{
          ...applicationsFixtures.oneUlaApplication,
          courseInterests: null,
        }}
        type="ULA"
      />,
    );

    expect(
      screen.getByTestId("ApplicationSummary-Other Courses of Interest")
        .textContent,
    ).toBe("");
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
    expect(row("I-9 Appointment")).toHaveTextContent("No");
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
      "I-9 Appointment",
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
});
