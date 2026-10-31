import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import InstructorRecruitmentCards, {
  COMING_SOON,
} from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";

const [closedTa, openUla] = instructorRecruitmentsFixtures.twoRecruitments;

function renderCards(recruitments = [closedTa, openUla]) {
  render(
    <InstructorRecruitmentCards recruitments={recruitments} testIdPrefix="I" />,
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

  test("a course opens on its own to the placeholder, and closes again", async () => {
    renderCards();

    const first = within(
      screen.getByTestId("I-card-1-course-2-header"),
    ).getByRole("button");
    const second = within(
      screen.getByTestId("I-card-1-course-3-header"),
    ).getByRole("button");
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("I-card-1-course-2-body")).toHaveTextContent(
      COMING_SOON,
    );
    expect(COMING_SOON).toBe(
      "(Coming soon: options to review and rank applicants)",
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

  test("odd input renders nothing rather than crashing", () => {
    renderCards(undefined);
    expect(screen.getByTestId("I").children).toHaveLength(2);

    renderCards("nonsense");
    renderCards([{ ...closedTa, id: 9, courses: undefined }]);
    expect(screen.getByTestId("I-card-9-courses").children).toHaveLength(0);
    expect(screen.queryByTestId("I-card-1-quarter")).not.toBeNull();
  });

  test("the default test id prefix is the component name", () => {
    render(<InstructorRecruitmentCards recruitments={[openUla]} />);
    expect(
      screen.getByTestId("InstructorRecruitmentCards-card-2-quarter"),
    ).toHaveTextContent("W26");
  });
});
