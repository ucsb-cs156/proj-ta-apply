import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import RecruitmentStepsPanel from "main/components/Recruitments/RecruitmentStepsPanel";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

describe("RecruitmentStepsPanel tests", () => {
  test("starts collapsed with the one-line summary and a Show steps button", () => {
    render(
      <RecruitmentStepsPanel
        steps={recruitmentStepsFixtures.rankingsOpen}
        testIdPrefix="P"
      />,
    );

    expect(screen.getByTestId("P-summary")).toHaveTextContent(
      "Step 7 of 9: Close Faculty Ranking",
    );
    const toggle = screen.getByTestId("P-toggle");
    expect(toggle).toHaveTextContent("Show steps");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("P-diagram")).not.toBeInTheDocument();
    expect(screen.getByTestId("P")).toHaveClass("mb-2");
  });

  test("Show steps reveals the live diagram and Hide steps hides it again", async () => {
    const onAction = vi.fn();
    const onNavigate = vi.fn();
    render(
      <RecruitmentStepsPanel
        steps={recruitmentStepsFixtures.rankingsOpen}
        onAction={onAction}
        onNavigate={onNavigate}
        testIdPrefix="P"
      />,
    );

    await userEvent.click(screen.getByTestId("P-toggle"));
    expect(screen.getByTestId("P-toggle")).toHaveTextContent("Hide steps");
    expect(screen.getByTestId("P-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const diagram = screen.getByTestId("P-steps");
    expect(diagram).toHaveAttribute("data-mode", "live");
    expect(screen.getByTestId("P-steps-step-7-label")).toHaveTextContent(
      "Deadline: 2026-02-15",
    );
    // The callbacks reach the diagram.
    await userEvent.click(screen.getByTestId("P-steps-step-7-action"));
    expect(onAction).toHaveBeenCalledWith("closeReviews");
    await userEvent.click(screen.getByTestId("P-steps-step-8-link"));
    expect(onNavigate).toHaveBeenCalledWith(
      "/admin/recruitments/1/assignments",
    );

    await userEvent.click(screen.getByTestId("P-toggle"));
    expect(screen.queryByTestId("P-diagram")).not.toBeInTheDocument();
    expect(screen.getByTestId("P-toggle")).toHaveTextContent("Show steps");
  });

  test("defaultExpanded opens it from the start", () => {
    render(
      <RecruitmentStepsPanel
        steps={recruitmentStepsFixtures.fresh}
        defaultExpanded
        testIdPrefix="P"
      />,
    );
    expect(screen.getByTestId("P-diagram")).toHaveClass("mt-2");
    expect(screen.getByTestId("P-summary")).toHaveTextContent(
      "Step 2 of 9: Open TA Applications",
    );
    expect(screen.getByTestId("P-steps-step-1-title")).toHaveTextContent(
      "Create TA Recruitment",
    );
  });

  test("says when every step is done, and has a default test id prefix", () => {
    render(
      <RecruitmentStepsPanel steps={recruitmentStepsFixtures.published} />,
    );
    expect(
      screen.getByTestId("RecruitmentStepsPanel-summary"),
    ).toHaveTextContent("All 9 steps done");
    expect(
      screen.getByTestId("RecruitmentStepsPanel-toggle"),
    ).toHaveTextContent("Show steps");
  });
});
