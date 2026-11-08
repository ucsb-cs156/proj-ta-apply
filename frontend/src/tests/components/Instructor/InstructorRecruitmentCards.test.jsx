import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

import InstructorRecruitmentCards from "main/components/Instructor/InstructorRecruitmentCards";
import instructorRecruitmentsFixtures from "fixtures/instructorRecruitmentsFixtures";

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

function renderCards(recruitments = nothingReleased) {
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

  test("nothing released: Section, Enrolled and Max, in a details table", () => {
    renderCards();

    const body = screen.getByTestId(`${W26}-course-2-body`);
    const table = screen.getByTestId(`${W26}-course-2-enrollment`);
    expect(within(body).getByTestId(`${W26}-course-2-enrollment`)).toBe(table);
    expect(table).toHaveClass("table", "table-sm", "table-bordered", "w-auto");
    expect(headings(table)).toEqual(["Section", "Enrolled", "Max"]);
    expect(screen.getByTestId(`${W26}-course-2-section`)).toHaveTextContent(
      "0100",
    );
    expect(screen.getByTestId(`${W26}-course-2-enrolled`)).toHaveTextContent(
      "120",
    );
    expect(screen.getByTestId(`${W26}-course-2-max`)).toHaveTextContent("150");
    expect(
      screen.queryByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toBeNull();
    expect(screen.queryByText("Enrollment Estimate")).toBeNull();
    expect(screen.queryByTestId(`${W26}-course-2-ta-allocation`)).toBeNull();
    expect(screen.queryByTestId(`${W26}-course-2-ula-allocation`)).toBeNull();
    // A sectionless lecture has a blank Section cell, not "null".
    expect(screen.getByTestId(`${W26}-course-3-section`).textContent).toBe("");
    expect(screen.getByTestId(`${W26}-course-3-enrolled`)).toHaveTextContent(
      "60",
    );
    expect(screen.getByTestId(`${W26}-course-1-max`)).toHaveTextContent("250");
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

  test("TA allocations released: Enrollment Estimate and TA Allocation join the table (5 columns)", () => {
    renderCards(taReleased);

    const table = screen.getByTestId(`${W26}-course-2-enrollment`);
    expect(headings(table)).toEqual([
      "Section",
      "Enrolled",
      "Max",
      "EnrollmentEstimate",
      "TAAllocation",
    ]);
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toHaveTextContent("130");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`),
    ).toHaveTextContent("2");
    expect(screen.queryByTestId(`${W26}-course-2-ula-allocation`)).toBeNull();
    // The sectionless lecture, in the TA recruitment alone, gets the same five.
    expect(
      headings(screen.getByTestId(`${W26}-course-3-enrollment`)),
    ).toHaveLength(5);
    expect(
      screen.getByTestId(`${W26}-course-3-enrollment-estimate`),
    ).toHaveTextContent("70");
    expect(
      screen.getByTestId(`${W26}-course-3-ta-allocation`),
    ).toHaveTextContent("3");
    // CMPSC 1A is only in the ULA recruitment, whose allocations are still withheld: three.
    expect(headings(screen.getByTestId(`${W26}-course-1-enrollment`))).toEqual([
      "Section",
      "Enrolled",
      "Max",
    ]);
    // S26's recruitment is not released either.
    expect(
      headings(screen.getByTestId(`${S26}-course-6-enrollment`)),
    ).toHaveLength(3);
  });

  test("ULA allocations released: Enrollment Estimate and ULA Allocation (5 columns), estimate from the ULA row", () => {
    renderCards(ulaReleased);

    expect(headings(screen.getByTestId(`${W26}-course-2-enrollment`))).toEqual([
      "Section",
      "Enrolled",
      "Max",
      "EnrollmentEstimate",
      "ULAAllocation",
    ]);
    // The TA row's estimate is blanked (withheld); the ULA row carries the quarter's estimate.
    expect(w26Ta.courses[0].enrollmentEstimate).toBeNull();
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toHaveTextContent("130");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`),
    ).toHaveTextContent("1");
    expect(screen.queryByTestId(`${W26}-course-2-ta-allocation`)).toBeNull();
    expect(
      headings(screen.getByTestId(`${W26}-course-1-enrollment`)),
    ).toHaveLength(5);
    expect(
      screen.getByTestId(`${W26}-course-1-enrollment-estimate`),
    ).toHaveTextContent("220");
    expect(
      screen.getByTestId(`${W26}-course-1-ula-allocation`),
    ).toHaveTextContent("4");
    // The sectionless lecture is only in the TA recruitment: still three.
    expect(
      headings(screen.getByTestId(`${W26}-course-3-enrollment`)),
    ).toHaveLength(3);
  });

  test("both released: all six columns for a course in both recruitments", () => {
    renderCards(bothReleased);

    expect(headings(screen.getByTestId(`${W26}-course-2-enrollment`))).toEqual([
      "Section",
      "Enrolled",
      "Max",
      "EnrollmentEstimate",
      "TAAllocation",
      "ULAAllocation",
    ]);
    expect(
      screen.getByTestId(`${W26}-course-2-enrollment-estimate`),
    ).toHaveTextContent("130");
    expect(
      screen.getByTestId(`${W26}-course-2-ta-allocation`),
    ).toHaveTextContent("2");
    expect(
      screen.getByTestId(`${W26}-course-2-ula-allocation`),
    ).toHaveTextContent("1");
    expect(headings(screen.getByTestId(`${W26}-course-3-enrollment`))).toEqual([
      "Section",
      "Enrolled",
      "Max",
      "EnrollmentEstimate",
      "TAAllocation",
    ]);
    expect(headings(screen.getByTestId(`${W26}-course-1-enrollment`))).toEqual([
      "Section",
      "Enrolled",
      "Max",
      "EnrollmentEstimate",
      "ULAAllocation",
    ]);
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

  test("the feedback placeholder sits under the table, before the recruitment cards", () => {
    renderCards(bothReleased);

    const placeholder = screen.getByTestId(`${W26}-course-2-feedback`);
    expect(placeholder).toHaveTextContent(
      "Coming soon: the ability for faculty to provide feedback on allocations of TA/ULAs to their courses",
    );
    expect(placeholder).toHaveClass("border", "rounded", "p-2", "text-muted");
    const body = screen.getByTestId(`${W26}-course-2-body`);
    expect(within(body).getByTestId(`${W26}-course-2-feedback`)).toBe(
      placeholder,
    );
    expect(body.firstElementChild).toHaveClass(
      "d-flex",
      "flex-column",
      "gap-3",
    );
    expect(
      before(screen.getByTestId(`${W26}-course-2-enrollment`), placeholder),
    ).toBe(true);
    expect(
      before(placeholder, screen.getByTestId(`${W26}-course-2-TA-card`)),
    ).toBe(true);
    // One per course, whatever the number of recruitments it is in.
    expect(
      screen.getAllByText(/Coming soon: the ability for faculty/),
    ).toHaveLength(4);
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

    const body = screen
      .getByTestId(`${W26}-course-2-TA-card`)
      .querySelector(".card-body");
    expect(body.querySelectorAll("dl")).toHaveLength(2);
    expect(body.querySelectorAll("dl")[0]).toHaveClass("row", "mb-0");
    expect(body.querySelectorAll("dl")[1]).toHaveClass("row", "mb-0", "mt-2");
    expect(body.querySelectorAll("dl > div")[0]).toHaveClass(
      "col-sm-6",
      "d-flex",
    );
    expect(body.querySelectorAll("dt")[0]).toHaveClass("me-2");
    expect(body.querySelectorAll("dd")[0]).toHaveClass("mb-1");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-tentativeOpeningDate`),
    ).toHaveTextContent("2026-01-05");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-primaryConsiderationDate`),
    ).toHaveTextContent("2026-01-20");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-actualOpeningDate`),
    ).toHaveTextContent("2026-01-06");
    expect(
      screen.getByTestId(`${W26}-course-2-TA-actualClosingDate`),
    ).toHaveTextContent("2026-02-01");
    // A blank date reads as nothing, not "null".
    expect(
      screen.getByTestId(`${W26}-course-2-ULA-actualClosingDate`).textContent,
    ).toBe("");
    expect(within(body).getByText("Tentative Opening:")).toBeInTheDocument();
    expect(within(body).getByText("Actually Closed:")).toBeInTheDocument();
    expect(
      within(body).getByText("Faculty Reviews Opened:"),
    ).toBeInTheDocument();
    expect(
      within(body).getByText("Faculty Ranking Deadline:"),
    ).toBeInTheDocument();
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
    // Not started: the note instead, wrapping within a narrow width.
    const note = screen.getByTestId(`${S26}-course-6-TA-not-open`);
    expect(note).toHaveTextContent(
      "Candidate rankings will be available when faculty reviews open.",
    );
    expect(note).toHaveClass("d-inline-block");
    expect(note.style.whiteSpace).toBe("normal");
    expect(note.style.maxWidth).toBe("16rem");
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
    render(
      <MemoryRouter>
        <InstructorRecruitmentCards recruitments={undefined} testIdPrefix="I" />
      </MemoryRouter>,
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
    render(
      <MemoryRouter>
        <InstructorRecruitmentCards recruitments={[w26Ula]} />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("InstructorRecruitmentCards-quarter-20261-quarter"),
    ).toHaveTextContent("W26");
  });
});
