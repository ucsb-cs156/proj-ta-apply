import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import RecruitmentCardLayout, {
  DELETE_TOOLTIP,
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
  test("header: quarter, type, status badges, application count and delete", async () => {
    const { onDeleteRequested } = renderCard();

    expect(screen.getByTestId("C-card")).toHaveClass("w-100", "mb-3");
    expect(screen.getByTestId("C-card").style.maxWidth).toBe("");
    expect(screen.getByTestId("C-quarter")).toHaveTextContent("W26");
    expect(screen.getByTestId("C-type")).toHaveTextContent("TA");
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
    await userEvent.click(del);
    expect(onDeleteRequested).toHaveBeenCalledWith(ta);
    await userEvent.hover(del);
    const tooltip = await screen.findByText(DELETE_TOOLTIP);
    expect(tooltip.closest('[role="tooltip"]')).toHaveAttribute(
      "id",
      "C-delete-tooltip",
    );
  });

  test("an open recruitment shows green badges, and the published badge when published", () => {
    renderCard({
      recruitment: { ...ula, assignmentsPublished: true },
      applicationCount: 1,
      steps: recruitmentStepsFixtures.ulaFresh,
    });
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

  test("the footer has only Courses and Applications", () => {
    renderCard();

    const footer = screen.getByTestId("C-courses-button").parentElement;
    expect(within(footer).getAllByRole("link")).toHaveLength(2);
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
