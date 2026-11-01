import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import InstructorRecruitmentCards from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";

const [closedTa, openUla] = instructorRecruitmentsFixtures.twoRecruitments;

function renderCards(recruitments = [closedTa, openUla]) {
  render(
    <MemoryRouter>
      <InstructorRecruitmentCards
        recruitments={recruitments}
        testIdPrefix="I"
      />
    </MemoryRouter>,
  );
}

describe("InstructorRecruitmentCards tests", () => {
  test("a card has application and faculty review status and dates", () => {
    renderCards();

    expect(screen.getByTestId("I")).toBeInTheDocument();
    expect(screen.getByTestId("I-card-1-card")).toHaveClass("card", "mb-3");
    expect(screen.getByTestId("I-card-1-card").style.maxWidth).toBe("48rem");
    expect(screen.getByTestId("I-card-1-quarter")).toHaveTextContent("W26");
    expect(screen.getByTestId("I-card-1-type")).toHaveTextContent("TA");
    const closed = screen.getByTestId("I-card-1-applicationStatus");
    expect(closed).toHaveTextContent("CLOSED");
    expect(closed).toHaveClass("bg-secondary");
    const open = screen.getByTestId("I-card-2-applicationStatus");
    expect(open).toHaveTextContent("OPEN");
    expect(open).toHaveClass("bg-success");
    expect(screen.getByTestId("I-card-1-reviewStatus")).toHaveTextContent(
      "Faculty Reviews: Closed",
    );
    expect(screen.getByTestId("I-card-2-reviewStatus")).toHaveTextContent(
      "Faculty Reviews: Open",
    );
    expect(
      screen.getByTestId("I-card-1-tentativeOpeningDate"),
    ).toHaveTextContent("2026-01-05");
    expect(
      screen.getByTestId("I-card-1-primaryConsiderationDate"),
    ).toHaveTextContent("2026-01-20");
    expect(screen.getByTestId("I-card-1-actualOpeningDate")).toHaveTextContent(
      "2026-01-06",
    );
    expect(screen.getByTestId("I-card-1-actualClosingDate")).toHaveTextContent(
      "2026-02-01",
    );
    // A blank date reads as nothing, not "null".
    expect(screen.getByTestId("I-card-2-actualClosingDate").textContent).toBe(
      "",
    );
    expect(screen.getAllByText("Tentative Opening:")).toHaveLength(2);
    expect(screen.getAllByText("Actually Closed:")).toHaveLength(2);
    expect(
      screen.getByTestId("I-card-2-facultyReviewOpeningDate"),
    ).toHaveTextContent("2026-01-08");
    expect(
      screen.getByTestId("I-card-2-facultyRankingDeadline"),
    ).toHaveTextContent("2026-02-15");
  });

  test("not-started reviews render without unset dates", () => {
    renderCards([
      {
        ...closedTa,
        reviewStatus: "NotStarted",
        facultyReviewOpeningDate: null,
        facultyRankingDeadline: null,
      },
    ]);

    expect(screen.getByTestId("I-card-1-reviewStatus")).toHaveTextContent(
      "Faculty Reviews: NotStarted",
    );
    expect(
      screen.getByTestId("I-card-1-facultyReviewOpeningDate").textContent,
    ).toBe("");
    expect(
      screen.getByTestId("I-card-1-facultyRankingDeadline").textContent,
    ).toBe("");
  });

  test("each course is a nested accordion with the course on its header", () => {
    renderCards();

    const courses = screen.getByTestId("I-card-1-courses");
    expect(courses).toHaveClass("accordion");
    expect(within(courses).getAllByRole("button")).toHaveLength(2);

    const header = screen.getByTestId("I-card-1-course-2-header");
    expect(header.textContent).toBe(
      "CMPSC   156(0100) Advanced Applications Programming",
    );
    const mono = header.querySelector("span");
    expect(mono.textContent).toBe("CMPSC   156");
    expect(mono.style.whiteSpace).toBe("pre");
    expect(mono.style.fontFamily).toBe("monospace");
    expect(within(header).getByText(/Advanced/)).toHaveClass("ms-2");
    // Without a section or title the header is just the course.
    expect(screen.getByTestId("I-card-1-course-3-header").textContent).toBe(
      "CMPSC   156",
    );
    expect(screen.getByTestId("I-card-2-course-1-header").textContent).toBe(
      "CMPSC     1A(0100) Introduction to Computer Programming",
    );
    expect(screen.getByTestId("I-card-1-course-2")).toHaveClass(
      "accordion-item",
    );
    expect(screen.queryByTestId("I-card-2-course-2")).toBeNull();
  });

  test("each course has the review action gated by review status", async () => {
    renderCards();

    const first = within(
      screen.getByTestId("I-card-1-course-2-header"),
    ).getByRole("button");
    const second = within(
      screen.getByTestId("I-card-1-course-3-header"),
    ).getByRole("button");
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByTestId("I-card-1-course-2-view-rankings"),
    ).toHaveTextContent("View Candidate Rankings");
    expect(
      screen.getByTestId("I-card-1-course-2-view-rankings"),
    ).toHaveAttribute("href", "/recruitments/1/courses/2/ranking");
    expect(screen.getByTestId("I-card-2-course-1-rank")).toHaveTextContent(
      "Rank Candidates",
    );
    expect(screen.getByTestId("I-card-2-course-1-rank")).toHaveAttribute(
      "href",
      "/recruitments/2/courses/1/ranking",
    );

    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "false");

    // alwaysOpen: opening the second does not close the first.
    await userEvent.click(second);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  test("not-started reviews have no ranking action", () => {
    renderCards([{ ...closedTa, reviewStatus: "NotStarted" }]);

    expect(screen.queryByRole("link", { name: /rank candidates/i })).toBeNull();
    expect(
      screen.queryByRole("link", { name: /view candidate rankings/i }),
    ).toBeNull();
    expect(
      screen.getAllByText(/available when faculty reviews open/i),
    ).toHaveLength(closedTa.courses.length);
  });

  test("odd input renders nothing rather than crashing", () => {
    renderCards(undefined);
    expect(screen.getByTestId("I").children).toHaveLength(2);

    renderCards("nonsense");
    renderCards([{ ...closedTa, id: 9, courses: undefined }]);
    expect(screen.getByTestId("I-card-9-courses").children).toHaveLength(0);
    expect(screen.queryByTestId("I-card-1-quarter")).not.toBeNull();
  });

  test("the default test id prefix is the component name", () => {
    render(
      <MemoryRouter>
        <InstructorRecruitmentCards recruitments={[openUla]} />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("InstructorRecruitmentCards-card-2-quarter"),
    ).toHaveTextContent("W26");
  });

  // ---- hiring targets released to faculty (issues #178 and #224) ----

  test("no targets table while the admin withholds targets, whether the field is null or absent", () => {
    const [ta, ula] = instructorRecruitmentsFixtures.twoRecruitments;
    const absent = { ...ula };
    delete absent.targets;
    renderCards([{ ...ta, targets: null }, absent]);

    expect(ta.courses[0].allocation).toBeNull();
    expect(absent).not.toHaveProperty("targets");
    expect(screen.queryByText("Hiring Target")).toBeNull();
    expect(screen.queryByTestId("I-card-1-course-2-targets")).toBeNull();
    expect(screen.queryByTestId("I-card-2-course-1-targets")).toBeNull();
  });

  test("once released, each course shows its four figures in a table above the ranking action", () => {
    renderCards(instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations);

    const first = screen.getByTestId("I-card-1-course-2-targets");
    expect(first).toHaveClass("mb-2");
    const table = screen.getByTestId("I-card-1-course-2-targets-table");
    expect(within(first).getByTestId("I-card-1-course-2-targets-table")).toBe(
      table,
    );
    expect(
      [...table.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual([
      "HiringTarget",
      "RankingTarget",
      "CandidatesRanked",
      "RankingsStillNeeded",
    ]);
    expect(
      screen.getByTestId("I-card-1-course-2-hiring-target"),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId("I-card-1-course-2-ranking-target"),
    ).toHaveTextContent("4");
    expect(
      screen.getByTestId("I-card-1-course-2-candidates-ranked"),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId("I-card-1-course-2-rankings-still-needed"),
    ).toHaveTextContent("3");
    // The second lecture's target is capped by its five interested candidates, all ranked.
    expect(
      screen.getByTestId("I-card-1-course-3-hiring-target"),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId("I-card-1-course-3-ranking-target"),
    ).toHaveTextContent("5");
    expect(
      screen.getByTestId("I-card-1-course-3-candidates-ranked"),
    ).toHaveTextContent("6");
    expect(
      screen.getByTestId("I-card-1-course-3-rankings-still-needed"),
    ).toHaveTextContent("0");
    expect(
      screen.getByTestId("I-card-2-course-1-ranking-target"),
    ).toHaveTextContent("2");
    // The table sits in the course's body, above the ranking action; the old one-line text is gone.
    const body = screen.getByTestId("I-card-1-course-2-body");
    expect(within(body).getByTestId("I-card-1-course-2-targets")).toBe(first);
    expect(
      first.compareDocumentPosition(
        screen.getByTestId("I-card-1-course-2-view-rankings"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText(/allocated to this course/)).toBeNull();
  });

  test("a course without an entry in targets gets no table even when others have one", () => {
    const [ta] = instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations;
    renderCards([{ ...ta, targets: { 3: ta.targets[3] } }]);

    expect(screen.queryByTestId("I-card-1-course-2-targets")).toBeNull();
    expect(screen.getByTestId("I-card-1-course-3-targets")).toBeInTheDocument();
  });

  test("zeros are shown, not hidden", () => {
    const [ta] = instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations;
    renderCards([
      {
        ...ta,
        targets: {
          2: {
            recruitmentCourseId: 2,
            allocation: 0,
            candidateCount: 3,
            rankingTarget: 0,
            rankedCount: 0,
            stillNeeded: 0,
          },
        },
      },
    ]);

    expect(
      screen.getByTestId("I-card-1-course-2-hiring-target"),
    ).toHaveTextContent("0");
    expect(
      screen.getByTestId("I-card-1-course-2-rankings-still-needed"),
    ).toHaveTextContent("0");
  });

  // Issue #180: published assignments.
  test("without published assignments there is no badge and no Assignments button", () => {
    renderCards();

    expect(
      screen.queryByTestId("I-card-1-assignmentsPublished"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("I-card-1-assignments-button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Assignments Published")).not.toBeInTheDocument();
  });

  test("published assignments add a badge and an Assignments button above the courses", () => {
    renderCards([
      { ...closedTa, assignmentsPublished: true },
      { ...openUla, assignmentsPublished: false },
    ]);

    const badge = screen.getByTestId("I-card-1-assignmentsPublished");
    expect(badge).toHaveTextContent("Assignments Published");
    expect(badge).toHaveClass("badge", "bg-info");
    expect(badge.previousElementSibling).toBe(
      screen.getByTestId("I-card-1-reviewStatus"),
    );
    expect(badge.closest(".card-header")).not.toBeNull();

    const button = screen.getByTestId("I-card-1-assignments-button");
    expect(button).toHaveTextContent("Assignments");
    expect(button).toHaveAttribute("href", "/recruitments/1/assignments");
    expect(button).toHaveClass("btn", "btn-dark", "mb-2");
    expect(button.closest(".card-footer")).not.toBeNull();
    expect(button.nextElementSibling).toBe(
      screen.getByTestId("I-card-1-courses"),
    );

    expect(
      screen.queryByTestId("I-card-2-assignmentsPublished"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("I-card-2-assignments-button"),
    ).not.toBeInTheDocument();
  });

  // ---- issue #224: the All allocations page link ----

  test("an All allocations link appears only while the admin shows all allocations", () => {
    const [ta, ula] =
      instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations;
    renderCards([ta, { ...ula, allocationsVisibleToFaculty: false }]);

    const link = screen.getByTestId("I-card-1-all-allocations-button");
    expect(link).toHaveTextContent("All allocations");
    expect(link).toHaveAttribute("href", "/recruitments/1/allocations");
    expect(link).toHaveClass("btn", "btn-outline-primary");
    expect(screen.queryByTestId("I-card-2-all-allocations-button")).toBeNull();
    // Above the courses accordion.
    expect(
      link.compareDocumentPosition(screen.getByTestId("I-card-1-courses")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("no All allocations link when the flag is absent", () => {
    renderCards(instructorRecruitmentsFixtures.twoRecruitments);
    expect(screen.queryByText("All allocations")).toBeNull();
  });
});
