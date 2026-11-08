import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, vi } from "vitest";

import RecruitmentCardLayout, {
  DELETE_TOOLTIP,
  RECRUITMENT_CARD_STORAGE_PREFIX,
} from "main/components/Recruitments/RecruitmentCardLayout";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

// The W26 TA recruitment (id 1): applications closed, reviews closed.
const ta = recruitmentsFixtures.threeRecruitments[2];
// The W26 ULA recruitment (id 2): applications open, reviews open.
const ula = recruitmentsFixtures.threeRecruitments[1];

function renderCard(props = {}) {
  const onChangeDeadline = vi.fn();
  const onDeleteRequested = vi.fn();
  const onAction = vi.fn();
  render(
    <MemoryRouter>
      <RecruitmentCardLayout
        recruitment={ta}
        applicationCount={15}
        steps={recruitmentStepsFixtures.rankingsOpen}
        onChangeDeadline={onChangeDeadline}
        onDeleteRequested={onDeleteRequested}
        onAction={onAction}
        testIdPrefix="C"
        {...props}
      />
    </MemoryRouter>,
  );
  return { onChangeDeadline, onDeleteRequested, onAction };
}

describe("RecruitmentCardLayout tests", () => {
  beforeEach(() => localStorage.clear());

  test("header: the type in the large font (no quarter, issue #379), status badges, application count and delete", async () => {
    const { onDeleteRequested } = renderCard();

    expect(screen.getByTestId("C-card")).toHaveClass("w-100", "mb-3");
    expect(screen.getByTestId("C-card").style.maxWidth).toBe("");
    expect(screen.queryByTestId("C-quarter")).toBeNull();
    const header = screen.getByTestId("C-card").querySelector(".card-header");
    expect(header).not.toHaveTextContent("W26");
    const type = screen.getByTestId("C-type");
    expect(type).toHaveTextContent(/^TA$/);
    expect(type).toHaveClass("fs-5");
    expect(type.tagName).toBe("STRONG");
    expect(screen.getByTestId("C-applicationStatus")).toHaveTextContent(
      "CLOSED",
    );
    expect(screen.getByTestId("C-applicationStatus")).toHaveClass(
      "bg-secondary",
    );
    expect(screen.getByTestId("C-reviewStatus")).toHaveTextContent(
      "Faculty Reviews: Closed",
    );
    expect(screen.getByTestId("C-reviewStatus")).toHaveClass("bg-secondary");
    expect(
      screen.queryByTestId("C-assignmentsPublished"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("C-applications")).toHaveTextContent(
      "15 applications",
    );
    const del = screen.getByTestId("C-delete-button");
    expect(del).toHaveAttribute("aria-label", DELETE_TOOLTIP);
    // Beside the toggle, not inside it, at the right edge of the row.
    expect(header).toContainElement(del);
    expect(screen.getByTestId("C-toggle")).not.toContainElement(del);
    expect(del).toHaveClass("btn-outline-danger", "btn-sm", "me-3");
    expect(header.lastElementChild).toBe(del);
    await userEvent.click(del);
    expect(onDeleteRequested).toHaveBeenCalledWith(ta);
    // Deleting is not toggling.
    expect(screen.getByTestId("C-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await userEvent.hover(del);
    const tooltip = await screen.findByText(DELETE_TOOLTIP);
    expect(tooltip.closest('[role="tooltip"]')).toHaveAttribute(
      "id",
      "C-delete-tooltip",
    );
  });

  // ---- Issue #379: the card's top row opens and closes it ----

  test("the top row is one toggle button, open by default, with the caret, type, badges and count inside it", () => {
    renderCard({ recruitment: { ...ula, assignmentsPublished: true } });

    const header = screen.getByTestId("C-card").querySelector(".card-header");
    expect(header).toHaveClass("d-flex", "align-items-center", "p-0");
    const toggle = screen.getByTestId("C-toggle");
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveClass(
      "btn",
      "btn-link",
      "flex-grow-1",
      "text-start",
      "text-reset",
      "text-decoration-none",
      "d-flex",
      "gap-3",
    );
    expect(header.firstElementChild).toBe(toggle);
    const caret = screen.getByTestId("C-caret");
    expect(caret).toHaveTextContent("▾");
    expect(caret).toHaveAttribute("aria-hidden", "true");
    // Caret, type, the badges and the count, in that order, all inside the toggle.
    expect(Array.from(toggle.children)).toEqual([
      caret,
      screen.getByTestId("C-type"),
      screen.getByTestId("C-applicationStatus"),
      screen.getByTestId("C-reviewStatus"),
      screen.getByTestId("C-assignmentsPublished"),
      screen.getByTestId("C-applications"),
    ]);
    expect(screen.getByTestId("C-type")).toHaveTextContent(/^ULA$/);
    // Its accessible name reads the row without the caret.
    expect(
      screen.getByRole("button", {
        name: /^ULA\s*OPEN\s*Faculty Reviews: Open\s*Assignments Published\s*15 applications$/,
        expanded: true,
      }),
    ).toBe(toggle);
    expect(localStorage.length).toBe(0);
  });

  test("clicking the row closes the card, hiding the dates, diagram and buttons, and clicking again opens it; each setting is remembered per quarter and type", async () => {
    renderCard();
    const toggle = screen.getByTestId("C-toggle");
    expect(screen.getByTestId("C-dates")).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("C-caret")).toHaveTextContent("▸");
    expect(screen.queryByTestId("C-dates")).toBeNull();
    expect(screen.queryByTestId("C-steps")).toBeNull();
    expect(screen.queryByTestId("C-courses-button")).toBeNull();
    expect(screen.queryByTestId("C-change-history-button")).toBeNull();
    expect(screen.getByTestId("C-card").querySelector(".card-body")).toBeNull();
    expect(
      screen.getByTestId("C-card").querySelector(".card-footer"),
    ).toBeNull();
    // The row itself stays, badges, count and trash icon included.
    expect(screen.getByTestId("C-applicationStatus")).toBeInTheDocument();
    expect(screen.getByTestId("C-applications")).toBeInTheDocument();
    expect(screen.getByTestId("C-delete-button")).toBeInTheDocument();
    expect(
      localStorage.getItem(`${RECRUITMENT_CARD_STORAGE_PREFIX}20261.TA`),
    ).toBe("closed");

    // Anywhere on the row: the count, here.
    await userEvent.click(screen.getByTestId("C-applications"));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("C-caret")).toHaveTextContent("▾");
    expect(screen.getByTestId("C-dates")).toBeInTheDocument();
    expect(screen.getByTestId("C-steps")).toBeInTheDocument();
    expect(screen.getByTestId("C-courses-button")).toBeInTheDocument();
    expect(
      localStorage.getItem(`${RECRUITMENT_CARD_STORAGE_PREFIX}20261.TA`),
    ).toBe("open");
    expect(RECRUITMENT_CARD_STORAGE_PREFIX).toBe("adminRecruitmentCard.");
  });

  test("the keyboard toggles the card", async () => {
    renderCard();
    const toggle = screen.getByTestId("C-toggle");
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("C-dates")).toBeNull();
    await userEvent.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("C-dates")).toBeInTheDocument();
  });

  test("defaultOpen false starts it closed; what this browser remembers wins over the default", () => {
    renderCard({ defaultOpen: false });
    expect(screen.getByTestId("C-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByTestId("C-dates")).toBeNull();
    cleanup();

    localStorage.setItem(`${RECRUITMENT_CARD_STORAGE_PREFIX}20261.TA`, "open");
    renderCard({ defaultOpen: false });
    expect(screen.getByTestId("C-dates")).toBeInTheDocument();
    cleanup();

    localStorage.setItem(
      `${RECRUITMENT_CARD_STORAGE_PREFIX}20261.TA`,
      "closed",
    );
    renderCard();
    expect(screen.queryByTestId("C-dates")).toBeNull();
    // The ULA card of the same quarter is remembered on its own.
    cleanup();
    renderCard({ recruitment: ula });
    expect(screen.getByTestId("C-dates")).toBeInTheDocument();
  });

  test("an open recruitment shows green badges, and the published badge when published", () => {
    renderCard({
      recruitment: { ...ula, assignmentsPublished: true },
      applicationCount: 1,
      steps: recruitmentStepsFixtures.ulaFresh,
    });
    expect(screen.getByTestId("C-type")).toHaveTextContent(/^ULA$/);
    expect(screen.getByTestId("C-applicationStatus")).toHaveTextContent("OPEN");
    expect(screen.getByTestId("C-applicationStatus")).toHaveClass("bg-success");
    expect(screen.getByTestId("C-reviewStatus")).toHaveClass("bg-success");
    expect(screen.getByTestId("C-assignmentsPublished")).toHaveTextContent(
      "Assignments Published",
    );
    expect(screen.getByTestId("C-applications")).toHaveTextContent(
      "1 application",
    );
  });

  test("the dates panel is unchanged, with Change beside the deadline", async () => {
    const { onChangeDeadline } = renderCard();

    const dates = screen.getByTestId("C-dates");
    expect(
      [...dates.querySelectorAll("dt")].map((dt) => dt.textContent),
    ).toEqual([
      "Tentative Opening:",
      "Primary Consideration:",
      "Actually Opened:",
      "Actually Closed:",
      "Faculty Reviews Opened:",
      "Faculty Ranking Deadline:",
    ]);
    expect(screen.getByTestId("C-tentativeOpeningDate")).toHaveTextContent(
      "2026-01-05",
    );
    expect(screen.getByTestId("C-primaryConsiderationDate")).toHaveTextContent(
      "2026-01-20",
    );
    expect(screen.getByTestId("C-actualOpeningDate")).toHaveTextContent(
      "2026-01-06",
    );
    expect(screen.getByTestId("C-actualClosingDate")).toHaveTextContent(
      "2026-02-01",
    );
    expect(screen.getByTestId("C-facultyReviewOpeningDate")).toHaveTextContent(
      "2026-01-10",
    );
    expect(screen.getByTestId("C-facultyRankingDeadline")).toHaveTextContent(
      "2026-02-01",
    );
    const change = screen.getByTestId("C-edit-faculty-ranking-deadline");
    expect(change).toHaveTextContent("Change");
    await userEvent.click(change);
    expect(onChangeDeadline).toHaveBeenCalledWith(ta);
  });

  test("blank dates stay blank", () => {
    renderCard({
      recruitment: recruitmentsFixtures.threeRecruitments[0],
      steps: recruitmentStepsFixtures.fresh,
    });
    expect(screen.getByTestId("C-actualOpeningDate")).toHaveTextContent("");
    expect(screen.getByTestId("C-facultyReviewOpeningDate")).toHaveTextContent(
      "",
    );
    expect(screen.getByTestId("C-facultyRankingDeadline")).toHaveTextContent(
      "",
    );
  });

  test("the steps panel sits between the dates and the buttons, collapsed unless asked", async () => {
    const { onAction } = renderCard();

    const body = screen.getByTestId("C-dates").parentElement;
    const panel = screen.getByTestId("C-steps");
    expect(body).toContainElement(panel);
    expect(
      screen.getByTestId("C-dates").compareDocumentPosition(panel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      panel.compareDocumentPosition(screen.getByTestId("C-courses-button")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId("C-steps-summary")).toHaveTextContent(
      "Step 7 of 9: Close Faculty Ranking",
    );
    expect(screen.queryByTestId("C-steps-diagram")).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("C-steps-toggle"));
    await userEvent.click(screen.getByTestId("C-steps-steps-step-7-action"));
    expect(onAction).toHaveBeenCalledWith("closeReviews");
  });

  test("defaultExpanded shows the diagram at once; no steps means no panel", () => {
    const { unmount } = render(
      <MemoryRouter>
        <RecruitmentCardLayout
          recruitment={ta}
          steps={recruitmentStepsFixtures.rankingsOpen}
          defaultExpanded
          onChangeDeadline={() => {}}
          onDeleteRequested={() => {}}
          testIdPrefix="C"
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("C-steps-diagram")).toBeInTheDocument();
    expect(screen.getByTestId("C-applications")).toHaveTextContent(
      "0 applications",
    );
    unmount();

    render(
      <MemoryRouter>
        <RecruitmentCardLayout
          recruitment={ta}
          onChangeDeadline={() => {}}
          onDeleteRequested={() => {}}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("RecruitmentCardLayout-card"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentCardLayout-steps"),
    ).not.toBeInTheDocument();
  });

  test.each(["Open", "Closed"])(
    "Download Rankings CSV ends the footer once faculty reviews are %s",
    (reviewStatus) => {
      renderCard({ recruitment: { ...ta, id: 4, reviewStatus } });

      const button = screen.getByTestId("C-rankings-csv-button");
      expect(button).toHaveTextContent("Download Rankings CSV");
      expect(button.tagName).toBe("A");
      expect(button).toHaveAttribute(
        "href",
        "/api/admin/rankings/csv?recruitmentId=4",
      );
      expect(button).toHaveAttribute("download", "rankings-4.csv");
      expect(button).toHaveClass("btn", "btn-outline-primary");
      expect(button.parentElement).toBe(
        screen.getByTestId("C-applications-button").parentElement,
      );
      // It follows View Assignments (issue #317) and ends the workflow buttons: only the
      // right-aligned Change History (issue #390) comes after it.
      expect(button.previousElementSibling).toBe(
        screen.getByTestId("C-view-assignments-button"),
      );
      expect(button.nextElementSibling).toBe(
        screen.getByTestId("C-change-history-button"),
      );
      expect(button.parentElement.lastElementChild).toBe(
        screen.getByTestId("C-change-history-button"),
      );
    },
  );

  test("Change History is the last button, pushed flush right, and opens the recruitment's history page (issue #390)", () => {
    renderCard({ recruitment: { ...ta, id: 7, reviewStatus: "NotStarted" } });

    const button = screen.getByTestId("C-change-history-button");
    expect(button).toHaveTextContent("Change History");
    expect(button.tagName).toBe("A");
    expect(button).toHaveAttribute("href", "/admin/recruitments/7/history");
    // The same button style as the row, plus ms-auto so it sits at the right edge.
    expect(button).toHaveClass("btn", "btn-outline-secondary", "ms-auto");
    const footer = screen.getByTestId("C-courses-button").parentElement;
    expect(footer).toHaveClass("d-flex");
    expect(button.parentElement).toBe(footer);
    expect(footer.lastElementChild).toBe(button);
    expect(button.previousElementSibling).toBe(
      screen.getByTestId("C-view-assignments-button"),
    );
    // Only it is pushed right.
    expect(
      [...footer.children].filter((child) =>
        child.classList.contains("ms-auto"),
      ),
    ).toEqual([button]);
  });

  test("there is no Download Rankings CSV before faculty reviews have started", () => {
    renderCard({ recruitment: { ...ta, reviewStatus: "NotStarted" } });

    expect(
      screen.queryByTestId("C-rankings-csv-button"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Download/)).not.toBeInTheDocument();
  });

  test("the footer has Courses, Draft Applications, Applications, Make Assignments, View Assignments and Change History, in that order", () => {
    renderCard({ recruitment: { ...ta, reviewStatus: "NotStarted" } });

    const footer = screen.getByTestId("C-courses-button").parentElement;
    expect(within(footer).getAllByRole("link")).toHaveLength(6);
    expect(
      within(footer)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Courses",
      "Draft Applications",
      "Applications",
      "Make Assignments",
      "View Assignments",
      "Change History",
    ]);
    // Issue #317: the two assignment pages, told apart by name, as steps 8 and 9 name them.
    const make = screen.getByTestId("C-make-assignments-button");
    expect(make).toHaveTextContent("Make Assignments");
    expect(make).toHaveAttribute("href", "/admin/recruitments/1/assignments");
    expect(make).toHaveClass("btn", "btn-outline-success");
    expect(make.tagName).toBe("A");
    const view = screen.getByTestId("C-view-assignments-button");
    expect(view).toHaveTextContent("View Assignments");
    expect(view).toHaveAttribute("href", "/recruitments/1/assignments");
    expect(view).toHaveClass("btn", "btn-success");
    expect(view.tagName).toBe("A");
    // View Assignments ends the workflow buttons; Change History (issue #390) is after the gap.
    expect(view.nextElementSibling).toBe(
      screen.getByTestId("C-change-history-button"),
    );
    expect(screen.getByTestId("C-draft-applications-button")).toHaveAttribute(
      "href",
      "/admin/recruitments/1/draft-applications",
    );
    expect(screen.getByTestId("C-draft-applications-button")).toHaveClass(
      "btn",
      "btn-outline-info",
    );
    expect(screen.getByTestId("C-courses-button")).toHaveAttribute(
      "href",
      "/admin/recruitments/1/courses",
    );
    expect(screen.getByTestId("C-courses-button")).toHaveClass(
      "btn",
      "btn-primary",
    );
    expect(screen.getByTestId("C-applications-button")).toHaveTextContent(
      "Applications",
    );
    expect(screen.getByTestId("C-applications-button")).toHaveAttribute(
      "href",
      "/admin/recruitments/1/applications",
    );
    expect(screen.getByTestId("C-applications-button")).toHaveClass(
      "btn",
      "btn-info",
    );
    expect(screen.queryByText("Review Applications")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Application")).not.toBeInTheDocument();
    expect(screen.queryByText(/Download/)).not.toBeInTheDocument();
    expect(screen.queryByText("Open Applications")).not.toBeInTheDocument();
  });
});
