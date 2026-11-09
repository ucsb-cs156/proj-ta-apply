import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import InstructorRecruitmentCards from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";
import {
  WAITING_FOR_BOTH,
  WAITING_FOR_TA,
  WAITING_FOR_ULA,
} from "main/utils/instructorFeedback";

// The feedback form (issue #425) reads the instructor's rows and the quarter's costs.
const axiosMock = new AxiosMockAdapter(axios);
beforeEach(() => {
  axiosMock.reset();
  axiosMock.onGet("/api/instructor/feedback").reply(200, []);
  axiosMock.onGet("/api/instructor/feedback/costs").reply(200, null);
});

const { nothingReleased, taReleased, ulaReleased, bothReleased } =
  instructorRecruitmentsFixtures.quarters;
// S26 TA (reviews NotStarted); W26 TA (reviews Closed) and W26 ULA (reviews Open).
const [s26Ta, w26Ta, w26Ula] = nothingReleased;

// W26: CMPSC 1A (ULA row 1), the sectionless 156 lecture (TA row 3), and 156 (0100), which is TA
// row 2 and ULA row 5 and so appears once, under the TA row's id.
const W26 = "I-quarter-20261";
const S26 = "I-quarter-20262";
const headings = (table) =>
  [...table.querySelectorAll("thead th")].map((th) => th.textContent);
const before = (a, b) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const renderWithClient = (ui) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

function renderCards(recruitments = nothingReleased) {
  renderWithClient(
    <InstructorRecruitmentCards recruitments={recruitments} testIdPrefix="I" />,
  );
}

describe("InstructorRecruitmentCards tests", () => {
  // ---- level 1: one card per quarter (issue #364) ----

  test("one card per quarter, newest first, headed by the quarter alone", () => {
    renderCards();

    const cards = screen.getByTestId("I").children;
    expect(cards).toHaveLength(2);
    expect(cards[0]).toBe(screen.getByTestId(`${S26}-card`));
    expect(cards[1]).toBe(screen.getByTestId(`${W26}-card`));
    expect(screen.getByTestId(`${S26}-quarter`)).toHaveTextContent("S26");
    expect(screen.getByTestId(`${W26}-quarter`)).toHaveTextContent("W26");
    expect(screen.getByTestId(`${W26}-quarter`)).toHaveClass("fs-5");
    // Nothing but the quarter on the header: no type, status or dates.
    const header = screen
      .getByTestId(`${W26}-card`)
      .querySelector(".card-header");
    expect(header.textContent).toBe("W26");
    expect(screen.getByTestId(`${W26}-card`)).toHaveClass("card", "mb-3");
    expect(screen.getByTestId(`${W26}-card`).style.maxWidth).toBe("48rem");
  });

  // ---- level 2: an accordion item per course ----

  test("each course the instructor teaches in either recruitment is one accordion item, course then section", () => {
    renderCards();

    const courses = screen.getByTestId(`${W26}-courses`);
    expect(courses).toHaveClass("accordion");
    expect(courses.closest(".card-body")).not.toBeNull();
    expect(within(courses).getAllByRole("button")).toHaveLength(3);
    expect([...courses.children].map((item) => item.dataset.testid)).toEqual([
      `${W26}-course-1`,
      `${W26}-course-3`,
      `${W26}-course-2`,
    ]);
    expect(screen.getByTestId(`${W26}-course-2`)).toHaveClass("accordion-item");
    // The ULA row of 156 (0100) is not a second item.
    expect(screen.queryByTestId(`${W26}-course-5`)).toBeNull();

    const header = screen.getByTestId(`${W26}-course-2-header`);
    expect(header.textContent).toBe(
      "CMPSC   156(0100) Advanced Applications Programming",
    );
    const mono = header.querySelector("span");
    expect(mono.textContent).toBe("CMPSC   156");
    expect(mono.style.whiteSpace).toBe("pre");
    expect(mono.style.fontFamily).toBe("monospace");
    expect(within(header).getByText(/Advanced/)).toHaveClass("ms-2");
    // Without a section or title the header is just the course.
    expect(screen.getByTestId(`${W26}-course-3-header`).textContent).toBe(
      "CMPSC   156",
    );
    expect(screen.getByTestId(`${W26}-course-1-header`).textContent).toBe(
      "CMPSC     1A(0100) Introduction to Computer Programming",
    );
    expect(screen.getByTestId(`${S26}-course-6-header`).textContent).toBe(
      "CMPSC     8(0100) Introduction to Computer Science",
    );
  });

  test("the accordion stays open per course (alwaysOpen)", async () => {
    renderCards();

    const first = within(
      screen.getByTestId(`${W26}-course-1-header`),
    ).getByRole("button");
    const second = within(
      screen.getByTestId(`${W26}-course-2-header`),
    ).getByRole("button");
    expect(first).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(second);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  // ---- level 3: the enrollment table and the feedback placeholder ----

  const SIX = [
    "Section",
    "Enrolled",
    "Max",
    "EnrollmentEstimate",
    "TAAllocation",
    "ULAAllocation",
  ];

  test("nothing released: all six columns, the Estimate and both Allocations reading TBD, in a details table", () => {
    renderCards();

    const body = screen.getByTestId(`${W26}-course-2-body`);
    const table = screen.getByTestId(`${W26}-course-2-enrollment`);
    expect(within(body).getByTestId(`${W26}-course-2-enrollment`)).toBe(table);
    expect(table).toHaveClass("table", "table-sm", "table-bordered", "w-auto");
    expect(headings(table)).toEqual(SIX);
    expect(screen.getByTestId(`${W26}-course-2-section`)).toHaveTextContent(
      "0100",
    );
    expect(screen.getByTestId(`${W26}-course-2-enrolled`)).toHaveTextContent(
      "120",
    );
    expect(screen.getByTestId(`${W26}-course-2-max`)).toHaveTextContent("150");
    // Issue #410: the course is in both recruitments and neither has released: TBD three times.
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`).textContent,
    ).toBe("TBD");
    // A sectionless lecture has a blank Section cell, not "null"; it is in the TA recruitment
    // alone, so its ULA Allocation is N/A.
    expect(screen.getByTestId(`${W26}-course-3-section`).textContent).toBe("");
    expect(screen.getByTestId(`${W26}-course-3-enrolled`)).toHaveTextContent(
      "60",
    );
    expect(
      screen.getByTestId(`${W26}-course-3-enrollment-estimate`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-3-ta-allocation`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-3-ula-allocation`).textContent,
    ).toBe("N/A");
    // CMPSC 1A is in the ULA recruitment alone: the other way round.
    expect(screen.getByTestId(`${W26}-course-1-max`)).toHaveTextContent("250");
    expect(
      screen.getByTestId(`${W26}-course-1-ta-allocation`).textContent,
    ).toBe("N/A");
    expect(
      screen.getByTestId(`${W26}-course-1-ula-allocation`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-1-enrollment-estimate`).textContent,
    ).toBe("TBD");
    // The quarter with a TA recruitment alone: TBD, TBD and N/A, under the same six headings.
    expect(headings(screen.getByTestId(`${S26}-course-6-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${S26}-course-6-enrollment-estimate`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${S26}-course-6-ta-allocation`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${S26}-course-6-ula-allocation`).textContent,
    ).toBe("N/A");
    // Every TBD is visible text: 2 for 1A, 2 for the lecture, 3 for 156 (0100) and 2 for S26's 8.
    expect(screen.getAllByText("TBD")).toHaveLength(9);
    expect(screen.getAllByText("N/A")).toHaveLength(3);
  });

  test("blank enrollment figures read as nothing, not null", () => {
    renderCards([
      {
        ...s26Ta,
        courses: [{ ...s26Ta.courses[0], enrollment: null, maxEnroll: null }],
      },
    ]);

    expect(screen.getByTestId(`${S26}-course-6-enrolled`).textContent).toBe("");
    expect(screen.getByTestId(`${S26}-course-6-max`).textContent).toBe("");
  });

  test("TA allocations released: Enrollment Estimate and TA Allocation are numbers, ULA Allocation still TBD", () => {
    renderCards(taReleased);

    expect(headings(screen.getByTestId(`${W26}-course-2-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toHaveTextContent("130");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`).textContent,
    ).toBe("TBD");
    // The sectionless lecture, in the TA recruitment alone: the number and N/A.
    expect(headings(screen.getByTestId(`${W26}-course-3-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-3-enrollment-estimate`),
    ).toHaveTextContent("70");
    expect(
      screen.getByTestId(`${W26}-course-3-ta-allocation`),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId(`${W26}-course-3-ula-allocation`).textContent,
    ).toBe("N/A");
    // CMPSC 1A is only in the ULA recruitment, whose allocations are still withheld: the estimate
    // is TBD too, N/A on the TA side and TBD on the ULA side.
    expect(headings(screen.getByTestId(`${W26}-course-1-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-1-enrollment-estimate`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-1-ta-allocation`).textContent,
    ).toBe("N/A");
    expect(
      screen.getByTestId(`${W26}-course-1-ula-allocation`).textContent,
    ).toBe("TBD");
    // S26's recruitment is not released either.
    expect(headings(screen.getByTestId(`${S26}-course-6-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${S26}-course-6-enrollment-estimate`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${S26}-course-6-ta-allocation`).textContent,
    ).toBe("TBD");
  });

  test("ULA allocations released: Enrollment Estimate from the ULA row, ULA Allocation the number, TA Allocation still TBD", () => {
    renderCards(ulaReleased);

    expect(headings(screen.getByTestId(`${W26}-course-2-enrollment`))).toEqual(
      SIX,
    );
    // The TA row's estimate is blanked (withheld); the ULA row carries the quarter's estimate.
    expect(w26Ta.courses[0].enrollmentEstimate).toBeNull();
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toHaveTextContent("130");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`).textContent,
    ).toBe("TBD");
    expect(headings(screen.getByTestId(`${W26}-course-1-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-1-enrollment-estimate`),
    ).toHaveTextContent("220");
    expect(
      screen.getByTestId(`${W26}-course-1-ula-allocation`),
    ).toHaveTextContent("4");
    expect(
      screen.getByTestId(`${W26}-course-1-ta-allocation`).textContent,
    ).toBe("N/A");
    // The sectionless lecture is only in the TA recruitment: TBD, TBD and N/A.
    expect(headings(screen.getByTestId(`${W26}-course-3-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-3-enrollment-estimate`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-3-ta-allocation`).textContent,
    ).toBe("TBD");
    expect(
      screen.getByTestId(`${W26}-course-3-ula-allocation`).textContent,
    ).toBe("N/A");
  });

  test("both released: all six columns, with N/A for the side a course is not in", () => {
    renderCards(bothReleased);

    expect(headings(screen.getByTestId(`${W26}-course-2-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toHaveTextContent("130");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`),
    ).toHaveTextContent("1");
    expect(headings(screen.getByTestId(`${W26}-course-3-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-3-ta-allocation`),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId(`${W26}-course-3-ula-allocation`).textContent,
    ).toBe("N/A");
    expect(headings(screen.getByTestId(`${W26}-course-1-enrollment`))).toEqual(
      SIX,
    );
    expect(
      screen.getByTestId(`${W26}-course-1-ta-allocation`).textContent,
    ).toBe("N/A");
    expect(
      screen.getByTestId(`${W26}-course-1-ula-allocation`),
    ).toHaveTextContent("4");
    // Nowhere does a cell say "undefined" or "null".
    expect(screen.queryByText(/undefined|null/)).toBeNull();
  });

  test("a released allocation that is missing shows as blank", () => {
    const [s26, ta, ula] = bothReleased;
    renderCards([
      s26,
      {
        ...ta,
        // Null and absent alike read as blank, never "null" or "undefined".
        courses: ta.courses.map((c) => ({
          ...c,
          allocation: undefined,
          enrollmentEstimate: null,
        })),
      },
      {
        ...ula,
        courses: ula.courses.map((c) => ({
          ...c,
          enrollmentEstimate: undefined,
        })),
      },
    ]);

    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`).textContent,
    ).toBe("");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`).textContent,
    ).toBe("");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`),
    ).toHaveTextContent("1");
  });

  test("the feedback area sits under the table, before the recruitment cards", () => {
    renderCards(bothReleased);

    const feedback = screen.getByTestId(`${W26}-course-2-feedback`);
    expect(feedback).toHaveClass("border", "rounded", "p-2");
    expect(feedback).not.toHaveClass("text-muted");
    const body = screen.getByTestId(`${W26}-course-2-body`);
    expect(within(body).getByTestId(`${W26}-course-2-feedback`)).toBe(feedback);
    expect(body.firstElementChild).toHaveClass(
      "d-flex",
      "flex-column",
      "gap-3",
    );
    expect(
      before(screen.getByTestId(`${W26}-course-2-enrollment`), feedback),
    ).toBe(true);
    expect(
      before(feedback, screen.getByTestId(`${W26}-course-2-TA-card`)),
    ).toBe(true);
  });

  // Issue #425: what the feedback area says until the quarter's allocations are released.
  test("nothing released: a quarter with both recruitments waits for both, a TA-only one for TA", () => {
    renderCards();

    const waiting = screen.getByTestId(`${W26}-course-2-feedback-waiting`);
    expect(waiting.textContent).toBe(WAITING_FOR_BOTH);
    expect(waiting).toHaveClass("text-muted");
    expect(waiting.parentElement).toBe(
      screen.getByTestId(`${W26}-course-2-feedback`),
    );
    expect(
      screen.getByTestId(`${S26}-course-6-feedback-waiting`).textContent,
    ).toBe(WAITING_FOR_TA);
    // One per course, whatever the number of recruitments it is in; no form anywhere.
    expect(screen.getAllByText(WAITING_FOR_BOTH)).toHaveLength(3);
    expect(screen.getAllByText(WAITING_FOR_TA)).toHaveLength(1);
    expect(screen.queryByTestId(`${W26}-course-2-feedback-form`)).toBeNull();
  });

  test("one of two released: still waiting for both", () => {
    renderCards(taReleased);
    expect(screen.getAllByText(WAITING_FOR_BOTH)).toHaveLength(3);
    cleanup();
    renderCards(ulaReleased);
    expect(screen.getAllByText(WAITING_FOR_BOTH)).toHaveLength(3);
    expect(screen.queryByTestId(`${W26}-course-1-feedback-form`)).toBeNull();
  });

  test("both released: every course of the quarter has the form; the other quarter still waits", () => {
    renderCards(bothReleased);

    for (const course of [1, 2, 3]) {
      expect(
        screen.getByTestId(`${W26}-course-${course}-feedback-form`),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId(`${W26}-course-${course}-feedback-waiting`),
      ).toBeNull();
    }
    expect(screen.queryByText(WAITING_FOR_BOTH)).toBeNull();
    expect(
      screen.getByTestId(`${S26}-course-6-feedback-waiting`).textContent,
    ).toBe(WAITING_FOR_TA);
    // The quarter has both recruitments, so both lines are there.
    expect(
      screen.getByTestId(`${W26}-course-1-feedback-differentTACount-line`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${W26}-course-1-feedback-differentULACount-line`),
    ).toBeInTheDocument();
  });

  test("a ULA-only quarter waits for the ULA allocations, then shows the form with no TA line", () => {
    renderCards([w26Ula]);
    expect(
      screen.getByTestId(`${W26}-course-1-feedback-waiting`).textContent,
    ).toBe(WAITING_FOR_ULA);
    cleanup();

    renderCards([ulaReleased[2]]);
    expect(
      screen.getByTestId(`${W26}-course-1-feedback-form`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`${W26}-course-1-feedback-differentTACount-line`),
    ).toBeNull();
    expect(
      screen.getByTestId(`${W26}-course-1-feedback-differentULACount-line`),
    ).toBeInTheDocument();
  });

  test("a TA-only quarter shows the form once its TA allocations are released", () => {
    renderCards([{ ...s26Ta, allocationsReleased: true }]);
    expect(
      screen.getByTestId(`${S26}-course-6-feedback-form`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`${S26}-course-6-feedback-differentULACount-line`),
    ).toBeNull();
  });

  // ---- level 4: the TA card and the ULA card ----

  test("a course in both recruitments has a TA card then a ULA card; a course in one has one", () => {
    renderCards();

    const ta = screen.getByTestId(`${W26}-course-2-TA-card`);
    const ula = screen.getByTestId(`${W26}-course-2-ULA-card`);
    expect(ta).toHaveClass("card");
    expect(ula).toHaveClass("card");
    expect(before(ta, ula)).toBe(true);
    const body = screen.getByTestId(`${W26}-course-2-body`);
    expect(within(body).getByTestId(`${W26}-course-2-ULA-card`)).toBe(ula);
    expect(screen.getByTestId(`${W26}-course-2-TA-type`)).toHaveTextContent(
      "TA",
    );
    expect(screen.getByTestId(`${W26}-course-2-ULA-type`)).toHaveTextContent(
      "ULA",
    );
    // The sectionless lecture is only in the TA recruitment; 1A only in the ULA one.
    expect(screen.getByTestId(`${W26}-course-3-TA-card`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${W26}-course-3-ULA-card`)).toBeNull();
    expect(screen.queryByTestId(`${W26}-course-1-TA-card`)).toBeNull();
    expect(screen.getByTestId(`${W26}-course-1-ULA-card`)).toBeInTheDocument();
    expect(screen.getByTestId(`${S26}-course-6-TA-card`)).toBeInTheDocument();
  });

  test("a recruitment card has the application and faculty review status and the dates", () => {
    renderCards();

    const header = screen
      .getByTestId(`${W26}-course-2-TA-card`)
      .querySelector(".card-header");
    expect(header).toHaveClass(
      "d-flex",
      "align-items-center",
      "flex-wrap",
      "gap-3",
    );
    expect(header).toContainElement(
      screen.getByTestId(`${W26}-course-2-TA-type`),
    );
    const closed = screen.getByTestId(`${W26}-course-2-TA-applicationStatus`);
    expect(closed).toHaveTextContent("CLOSED");
    expect(closed).toHaveClass("badge", "bg-secondary");
    const open = screen.getByTestId(`${W26}-course-2-ULA-applicationStatus`);
    expect(open).toHaveTextContent("OPEN");
    expect(open).toHaveClass("bg-success");
    const reviewsClosed = screen.getByTestId(`${W26}-course-2-TA-reviewStatus`);
    expect(reviewsClosed).toHaveTextContent("Faculty Reviews: Closed");
    expect(reviewsClosed).toHaveClass("bg-secondary");
    const reviewsOpen = screen.getByTestId(`${W26}-course-2-ULA-reviewStatus`);
    expect(reviewsOpen).toHaveTextContent("Faculty Reviews: Open");
    expect(reviewsOpen).toHaveClass("bg-success");
    expect(
      screen.getByTestId(`${S26}-course-6-TA-reviewStatus`),
    ).toHaveTextContent("Faculty Reviews: NotStarted");

    // Issue #410: only the two faculty review dates, in one list; the application dates are gone.
    const body = screen
      .getByTestId(`${W26}-course-2-TA-card`)
      .querySelector(".card-body");
    expect(body.querySelectorAll("dl")).toHaveLength(1);
    const dl = body.querySelector("dl");
    expect(dl).toHaveClass("row", "mb-0");
    expect(dl).not.toHaveClass("mt-2");
    expect(dl.children).toHaveLength(2);
    expect(dl.children[0]).toHaveClass("col-sm-6", "d-flex");
    expect(dl.children[1]).toHaveClass("col-sm-6", "d-flex");
    expect(body.querySelectorAll("dt")[0]).toHaveClass("me-2");
    expect(body.querySelectorAll("dd")[0]).toHaveClass("mb-1");
    expect(
      [...body.querySelectorAll("dt")].map((dt) => dt.textContent),
    ).toEqual(["Faculty Reviews Opened:", "Faculty Ranking Deadline:"]);
    for (const key of [
      "tentativeOpeningDate",
      "primaryConsiderationDate",
      "actualOpeningDate",
      "actualClosingDate",
    ]) {
      expect(screen.queryByTestId(`${W26}-course-2-TA-${key}`)).toBeNull();
      expect(screen.queryByTestId(`${W26}-course-2-ULA-${key}`)).toBeNull();
    }
    expect(screen.queryByText(/Tentative Opening/)).toBeNull();
    expect(screen.queryByText(/Primary Consideration/)).toBeNull();
    expect(screen.queryByText(/Actually Opened/)).toBeNull();
    expect(screen.queryByText(/Actually Closed/)).toBeNull();
    // The tentative opening, primary consideration and actual opening dates appear nowhere.
    expect(screen.queryByText("2026-01-05")).toBeNull();
    expect(screen.queryByText("2026-01-20")).toBeNull();
    expect(screen.queryByText("2026-01-06")).toBeNull();
    expect(
      screen.getByTestId(`${W26}-course-2-TA-facultyReviewOpeningDate`),
    ).toHaveTextContent("2026-01-10");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-facultyRankingDeadline`),
    ).toHaveTextContent("2026-02-01");
    expect(
      screen.getByTestId(`${W26}-course-2-ULA-facultyReviewOpeningDate`),
    ).toHaveTextContent("2026-01-08");
    expect(
      screen.getByTestId(`${W26}-course-2-ULA-facultyRankingDeadline`),
    ).toHaveTextContent("2026-02-15");
    // Not-started reviews render without unset dates.
    expect(
      screen.getByTestId(`${S26}-course-6-TA-facultyReviewOpeningDate`)
        .textContent,
    ).toBe("");
    expect(
      screen.getByTestId(`${S26}-course-6-TA-facultyRankingDeadline`)
        .textContent,
    ).toBe("");
  });

  test("while allocations are withheld, the ranking action stands alone in the card footer", () => {
    renderCards();

    const view = screen.getByTestId(`${W26}-course-2-TA-view-rankings`);
    expect(view).toHaveTextContent("View Candidate Rankings");
    expect(view).toHaveAttribute("href", "/recruitments/1/courses/2/ranking");
    expect(view).toHaveClass("btn", "btn-secondary");
    expect(view.closest(".card-footer")).not.toBeNull();
    expect(view.closest(".card-footer").closest(".card")).toBe(
      screen.getByTestId(`${W26}-course-2-TA-card`),
    );
    // The ULA card links to the ULA row of the same section.
    const rank = screen.getByTestId(`${W26}-course-2-ULA-rank`);
    expect(rank).toHaveTextContent("Rank Candidates");
    expect(rank).toHaveAttribute("href", "/recruitments/2/courses/5/ranking");
    expect(rank).toHaveClass("btn", "btn-primary");
    expect(screen.getByTestId(`${W26}-course-1-ULA-rank`)).toHaveAttribute(
      "href",
      "/recruitments/2/courses/1/ranking",
    );
    // Not started: the note instead, at the natural width of its holder (issue #410): no
    // max-width, not an inline block, but still allowed to wrap inside a no-wrap table cell.
    const note = screen.getByTestId(`${S26}-course-6-TA-not-open`);
    expect(note.tagName).toBe("SPAN");
    expect(note).toHaveTextContent(
      "Candidate rankings will be available when faculty reviews open.",
    );
    expect(note.getAttribute("class")).toBeNull();
    expect(note.style.whiteSpace).toBe("normal");
    expect(note.style.maxWidth).toBe("");
    expect(note.getAttribute("style")).toBe("white-space: normal;");
    expect(note.closest(".card-footer")).not.toBeNull();
    expect(screen.queryByTestId(`${S26}-course-6-TA-rank`)).toBeNull();
    expect(screen.queryByTestId(`${S26}-course-6-TA-view-rankings`)).toBeNull();
    // No targets table anywhere.
    expect(screen.queryByText("Hiring Target")).toBeNull();
    expect(screen.queryByTestId(`${W26}-course-2-TA-targets`)).toBeNull();
    expect(screen.queryByTestId(`${W26}-course-2-TA-action`)).toBeNull();
  });

  test("the Courses button is gone", () => {
    renderCards(bothReleased);

    expect(screen.queryByRole("link", { name: "Courses" })).toBeNull();
    expect(screen.queryByText("Courses")).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/\/courses$/);
    }
  });

  test("once released, the targets table carries the ranking action in an unlabelled first column", () => {
    renderCards(bothReleased);

    const targets = screen.getByTestId(`${W26}-course-2-TA-targets`);
    expect(targets.closest(".card-footer").closest(".card")).toBe(
      screen.getByTestId(`${W26}-course-2-TA-card`),
    );
    const table = screen.getByTestId(`${W26}-course-2-TA-targets-table`);
    expect(
      within(targets).getByTestId(`${W26}-course-2-TA-targets-table`),
    ).toBe(table);
    expect(headings(table)).toEqual([
      "",
      "HiringTarget",
      "RankingTarget",
      "CandidatesRanked",
      "RankingsStillNeeded",
    ]);
    const action = screen.getByTestId(`${W26}-course-2-TA-action`);
    expect(action.tagName).toBe("TD");
    expect(action).toBe(table.querySelector("tbody td"));
    expect(action).toContainElement(
      screen.getByTestId(`${W26}-course-2-TA-view-rankings`),
    );
    expect(
      screen.getByTestId(`${W26}-course-2-TA-hiring-target`),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-ranking-target`),
    ).toHaveTextContent("4");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-candidates-ranked`),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-rankings-still-needed`),
    ).toHaveTextContent("3");
    // The second lecture's target is capped by its five interested candidates, all ranked.
    expect(
      screen.getByTestId(`${W26}-course-3-TA-hiring-target`),
    ).toHaveTextContent("3");
    expect(
      screen.getByTestId(`${W26}-course-3-TA-ranking-target`),
    ).toHaveTextContent("5");
    expect(
      screen.getByTestId(`${W26}-course-3-TA-candidates-ranked`),
    ).toHaveTextContent("6");
    expect(
      screen.getByTestId(`${W26}-course-3-TA-rankings-still-needed`),
    ).toHaveTextContent("0");
    // The ULA card's table is keyed by the ULA row and holds the Rank Candidates button.
    expect(screen.getByTestId(`${W26}-course-2-ULA-action`)).toContainElement(
      screen.getByTestId(`${W26}-course-2-ULA-rank`),
    );
    expect(
      screen.getByTestId(`${W26}-course-2-ULA-hiring-target`),
    ).toHaveTextContent("1");
    expect(
      screen.getByTestId(`${W26}-course-2-ULA-ranking-target`),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId(`${W26}-course-1-ULA-rankings-still-needed`),
    ).toHaveTextContent("0");
    // The not-started note goes in the first column too.
    const [s26] = bothReleased;
    cleanup();
    renderCards([
      {
        ...s26,
        allocationsReleased: true,
        targets: { 6: taReleased[1].targets[2] },
      },
    ]);
    expect(screen.getByTestId(`${S26}-course-6-TA-action`)).toContainElement(
      screen.getByTestId(`${S26}-course-6-TA-not-open`),
    );
  });

  test("a course without an entry in targets gets the action alone even when others have a table", () => {
    const [s26, ta, ula] = bothReleased;
    renderCards([s26, { ...ta, targets: { 3: ta.targets[3] } }, ula]);

    expect(screen.queryByTestId(`${W26}-course-2-TA-targets`)).toBeNull();
    expect(
      screen.getByTestId(`${W26}-course-2-TA-view-rankings`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`${W26}-course-3-TA-targets`),
    ).toBeInTheDocument();
    // Null and absent targets both mean withheld.
    cleanup();
    const absent = { ...ta };
    delete absent.targets;
    renderCards([{ ...ta, targets: null }, absent]);
    expect(screen.queryByText("Hiring Target")).toBeNull();
  });

  test("zeros are shown, not hidden", () => {
    const [, ta] = taReleased;
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
        courses: ta.courses.map((c) => ({ ...c, allocation: 0 })),
      },
    ]);

    expect(
      screen.getByTestId(`${W26}-course-2-TA-hiring-target`),
    ).toHaveTextContent("0");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-rankings-still-needed`),
    ).toHaveTextContent("0");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`),
    ).toHaveTextContent("0");
  });

  // Issue #180: published assignments.
  test("without published assignments there is no badge and no Assignments button", () => {
    renderCards();

    expect(
      screen.queryByTestId(`${W26}-course-2-TA-assignmentsPublished`),
    ).toBeNull();
    expect(
      screen.queryByTestId(`${W26}-course-2-TA-assignments-button`),
    ).toBeNull();
    expect(screen.queryByText("Assignments Published")).toBeNull();
  });

  test("published assignments add a badge and an Assignments button to that recruitment's cards", () => {
    renderCards([
      s26Ta,
      { ...w26Ta, assignmentsPublished: true },
      { ...w26Ula, assignmentsPublished: false },
    ]);

    const badge = screen.getByTestId(`${W26}-course-2-TA-assignmentsPublished`);
    expect(badge).toHaveTextContent("Assignments Published");
    expect(badge).toHaveClass("badge", "bg-info");
    expect(badge.previousElementSibling).toBe(
      screen.getByTestId(`${W26}-course-2-TA-reviewStatus`),
    );
    expect(badge.closest(".card-header")).not.toBeNull();

    const button = screen.getByTestId(`${W26}-course-2-TA-assignments-button`);
    expect(button).toHaveTextContent("Assignments");
    expect(button).toHaveAttribute("href", "/recruitments/1/assignments");
    expect(button).toHaveClass("btn", "btn-dark", "mb-2");
    expect(button.closest(".card-footer")).not.toBeNull();
    expect(button.nextElementSibling).toBe(
      screen.getByTestId(`${W26}-course-2-TA-view-rankings`),
    );
    // Every course in that recruitment says so; the ULA cards do not.
    expect(
      screen.getByTestId(`${W26}-course-3-TA-assignments-button`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`${W26}-course-2-ULA-assignmentsPublished`),
    ).toBeNull();
    expect(
      screen.queryByTestId(`${W26}-course-2-ULA-assignments-button`),
    ).toBeNull();
  });

  // ---- odds and ends ----

  test("odd input renders nothing rather than crashing", () => {
    renderWithClient(
      <InstructorRecruitmentCards recruitments={undefined} testIdPrefix="I" />,
    );
    expect(screen.getByTestId("I").children).toHaveLength(0);
    cleanup();

    renderCards("nonsense");
    expect(screen.getByTestId("I").children).toHaveLength(0);
    cleanup();

    // A recruitment without courses makes no card for its quarter.
    renderCards([
      { ...w26Ta, courses: undefined },
      { ...s26Ta, courses: [] },
    ]);
    expect(screen.getByTestId("I").children).toHaveLength(0);
    cleanup();

    renderCards([{ ...w26Ta, courses: undefined }, w26Ula]);
    expect(screen.getByTestId("I").children).toHaveLength(1);
    expect(screen.getByTestId(`${W26}-courses`).children).toHaveLength(2);
  });

  test("the default test id prefix is the component name", () => {
    renderWithClient(<InstructorRecruitmentCards recruitments={[w26Ula]} />);
    expect(
      screen.getByTestId("InstructorRecruitmentCards-quarter-20261-quarter"),
    ).toHaveTextContent("W26");
  });
});
