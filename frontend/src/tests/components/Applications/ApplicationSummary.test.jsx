import { render, screen } from "@testing-library/react";

import ApplicationSummary from "main/components/Applications/ApplicationSummary";
import applicationsFixtures from "fixtures/applicationsFixtures";

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
    expect(
      screen.getByTestId("ApplicationSummary-290-Level Coursework"),
    ).toHaveTextContent("CS 290A");

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
    expect(
      screen.queryByTestId("ApplicationSummary-290-Level Coursework"),
    ).toBeNull();
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
