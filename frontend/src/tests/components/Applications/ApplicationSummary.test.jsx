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
      screen.getByTestId("ApplicationSummary-Language Exam"),
    ).toHaveTextContent("Passed");
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
        type="TA"
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
        type="TA"
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
      screen.getByTestId("ApplicationSummary-Language Exam"),
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
});
