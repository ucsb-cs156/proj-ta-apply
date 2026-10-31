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

  // ---- allocations shown to faculty (issue #178) ----

  test("no allocation line while the admin hides allocations, whether the field is null or absent", () => {
    const [ta, ula] = instructorRecruitmentsFixtures.twoRecruitments;
    const absent = {
      ...ula,
      courses: ula.courses.map(({ allocation, ...rest }) => rest),
    };
    renderCards([ta, absent]);

    expect(ta.courses[0].allocation).toBeNull();
    expect(absent.courses[0]).not.toHaveProperty("allocation");
    expect(screen.queryByText(/allocated to this course/)).toBeNull();
    expect(screen.queryByTestId("I-card-1-course-2-allocation")).toBeNull();
    expect(screen.queryByTestId("I-card-2-course-1-allocation")).toBeNull();
  });

  test("once shown, each course says how many TAs or ULAs it has, by the recruitment's type", () => {
    renderCards(instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations);

    const first = screen.getByTestId("I-card-1-course-2-allocation");
    expect(first).toHaveTextContent("TAs allocated to this course: 2");
    expect(first.tagName).toBe("P");
    expect(first).toHaveClass("mb-2");
    expect(
      screen.getByTestId("I-card-1-course-3-allocation"),
    ).toHaveTextContent("TAs allocated to this course: 3");
    expect(
      screen.getByTestId("I-card-2-course-1-allocation"),
    ).toHaveTextContent("ULAs allocated to this course: 1");
    // The line sits in the course's body, above the ranking action.
    const body = screen.getByTestId("I-card-1-course-2-body");
    expect(within(body).getByTestId("I-card-1-course-2-allocation")).toBe(
      first,
    );
    expect(
      first.compareDocumentPosition(
        screen.getByTestId("I-card-1-course-2-view-rankings"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("an allocation of zero is still shown once allocations are visible", () => {
    const [ta] = instructorRecruitmentsFixtures.twoRecruitmentsWithAllocations;
    renderCards([{ ...ta, courses: [{ ...ta.courses[0], allocation: 0 }] }]);

    expect(
      screen.getByTestId("I-card-1-course-2-allocation"),
    ).toHaveTextContent("TAs allocated to this course: 0");
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
});
