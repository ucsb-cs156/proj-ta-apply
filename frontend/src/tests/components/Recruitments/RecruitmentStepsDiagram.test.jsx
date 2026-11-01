import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import RecruitmentStepsDiagram from "main/components/Recruitments/RecruitmentStepsDiagram";
import recruitmentStepsFixtures from "fixtures/recruitmentStepsFixtures";

const svg = () => screen.getByTestId("D");
const step = (n) => screen.getByTestId(`D-step-${n}`);

describe("RecruitmentStepsDiagram tests", () => {
  describe("static mode", () => {
    test("draws the agreed TA diagram: nine boxes, eleven edges, legend and footnote", () => {
      render(<RecruitmentStepsDiagram type="TA" testIdPrefix="D" />);

      expect(svg()).toHaveAttribute("viewBox", "0 0 835 392");
      expect(svg()).toHaveAttribute("width", "100%");
      expect(svg()).toHaveAttribute("data-mode", "static");
      expect(svg().style.maxWidth).toBe("835px");
      expect(svg().style.fontFamily).toContain("Arial Narrow");
      expect(svg()).toHaveAttribute(
        "aria-label",
        "Steps in a TA recruitment and their prerequisites",
      );
      expect(svg().querySelectorAll("rect")).toHaveLength(9);
      const box2 = screen.getByTestId("D-step-2-box");
      expect(box2).toHaveAttribute("x", "155");
      expect(box2).toHaveAttribute("y", "45");
      expect(box2).toHaveAttribute("width", "101");
      expect(box2).toHaveAttribute("height", "62");
      expect(box2).toHaveAttribute("rx", "9");
      // The hanging indent: the number, then every title line at the same x.
      const title5 = screen.getByTestId("D-step-5-title");
      expect(title5).toHaveTextContent("5. Release Allocations to Faculty *");
      const lineXs = [...title5.querySelectorAll("tspan[x]")].map((t) =>
        t.getAttribute("x"),
      );
      expect(lineXs).toEqual(["321", "321", "321"]);
      expect(title5.querySelectorAll("tspan[dy]")).toHaveLength(2);
      expect(screen.getByTestId("D-step-1-title")).toHaveTextContent(
        "1. Create TA Recruitment",
      );
      // Words are separated by single spaces, with no trailing space after the last line.
      expect(title5.textContent).toBe("5. Release Allocations to Faculty *");
      expect(screen.getByTestId("D-step-1-title").textContent).toBe(
        "1. Create TA Recruitment",
      );
      expect(screen.getByTestId("D-step-6-title").textContent).toBe(
        "6. Open Faculty Ranking",
      );
      // The agreed colours.
      expect(box2).toHaveAttribute("fill", "#f8fafc");
      expect(box2).toHaveAttribute("stroke", "#334155");
      expect(box2).toHaveAttribute("stroke-width", "1.5");
      const [numberSpan, labelSpan] = title5.querySelectorAll(":scope > tspan");
      expect(numberSpan).toHaveAttribute("fill", "#0f172a");
      expect(numberSpan).toHaveAttribute("font-weight", "700");
      expect(labelSpan).toHaveAttribute("fill", "#1e293b");
      expect(screen.getByTestId("D-legend-hard")).toHaveAttribute(
        "fill",
        "#475569",
      );
      expect(screen.getByTestId("D-legend-hard")).toHaveAttribute("y", "294");
      expect(screen.getByTestId("D-legend-soft")).toHaveAttribute("y", "320");
      expect(screen.getByTestId("D-edge-6-8")).toHaveAttribute(
        "stroke",
        "#334155",
      );
      expect(screen.getByTestId("D-edge-6-8")).toHaveAttribute(
        "stroke-width",
        "1.6",
      );
      expect(svg().querySelector("marker path")).toHaveAttribute(
        "fill",
        "#334155",
      );

      const edges = [...svg().querySelectorAll("path[data-kind]")];
      expect(edges).toHaveLength(11);
      expect(edges.filter((e) => e.dataset.kind === "soft")).toHaveLength(3);
      expect(screen.getByTestId("D-edge-5-6")).toHaveAttribute(
        "stroke-dasharray",
        "5 4",
      );
      expect(screen.getByTestId("D-edge-6-8")).not.toHaveAttribute(
        "stroke-dasharray",
      );
      expect(screen.getByTestId("D-edge-6-8")).toHaveAttribute(
        "d",
        "M 508.0 206.0 H 602.0",
      );
      // Every edge and both legend lines point at this diagram's own arrowhead.
      const marker = svg().querySelector("marker");
      expect(marker).not.toBeNull();
      [...svg().querySelectorAll("[marker-end]")].forEach((el) =>
        expect(el).toHaveAttribute("marker-end", `url(#${marker.id})`),
      );

      expect(screen.getByTestId("D-legend-hard")).toHaveTextContent(
        "hard prerequisite: must happen first",
      );
      expect(screen.getByTestId("D-legend-soft")).toHaveTextContent(
        "soft prerequisite: the preferred order, not enforced",
      );
      expect(screen.getByTestId("D-footnote")).toHaveTextContent(
        '* Allocation visibility has three settings: admins only (the default), each faculty member sees the allocations for the courses they teach, or all faculty see all allocations. Step 5 means moving off "admins only".',
      );
      expect(screen.getByTestId("D-footnote")).toHaveAttribute("y", "352");

      // Nothing live.
      expect(svg().querySelectorAll("[data-testid$='-done']")).toHaveLength(0);
      expect(svg().querySelectorAll("[data-testid$='-label']")).toHaveLength(0);
      expect(svg().querySelectorAll("a")).toHaveLength(0);
    });

    test("the ULA diagram says ULA in steps 1, 2 and 4 and has the same geometry", () => {
      render(<RecruitmentStepsDiagram type="ULA" testIdPrefix="D" />);

      expect(screen.getByTestId("D-step-1-title")).toHaveTextContent(
        "Create ULA",
      );
      expect(screen.getByTestId("D-step-2-title")).toHaveTextContent(
        "Open ULA",
      );
      expect(screen.getByTestId("D-step-4-title")).toHaveTextContent(
        "Close ULA",
      );
      expect(screen.getByTestId("D-step-3-title")).toHaveTextContent(
        "3. Budget / Allocations",
      );
      expect(screen.getByTestId("D-step-2-box")).toHaveAttribute("x", "155");
      expect(svg()).toHaveAttribute("viewBox", "0 0 835 392");
    });

    test("two diagrams on one page get different arrowhead ids", () => {
      render(
        <>
          <RecruitmentStepsDiagram type="TA" testIdPrefix="A" />
          <RecruitmentStepsDiagram type="ULA" testIdPrefix="B" />
        </>,
      );
      const a = screen.getByTestId("A").querySelector("marker").id;
      const b = screen.getByTestId("B").querySelector("marker").id;
      expect(a).not.toBe(b);
    });

    test("has a default test id prefix", () => {
      render(<RecruitmentStepsDiagram type="TA" />);
      expect(screen.getByTestId("RecruitmentStepsDiagram")).toBeInTheDocument();
    });
  });

  describe("live mode", () => {
    const renderLive = (steps, props = {}) => {
      const onAction = vi.fn();
      const onNavigate = vi.fn();
      render(
        <RecruitmentStepsDiagram
          type={steps.type}
          steps={steps}
          onAction={onAction}
          onNavigate={onNavigate}
          testIdPrefix="D"
          {...props}
        />,
      );
      return { onAction, onNavigate };
    };

    test("taller boxes, a check on each done step, and the status line in every box", () => {
      renderLive(recruitmentStepsFixtures.rankingsOpen);

      expect(svg()).toHaveAttribute("data-mode", "live");
      expect(svg()).toHaveAttribute("viewBox", "0 0 868 424");
      expect(screen.getByTestId("D-step-2-box")).toHaveAttribute(
        "height",
        "78",
      );
      [1, 2, 3, 4, 5, 6].forEach((n) =>
        expect(screen.getByTestId(`D-step-${n}-done`)).toBeInTheDocument(),
      );
      [7, 8, 9].forEach((n) =>
        expect(
          screen.queryByTestId(`D-step-${n}-done`),
        ).not.toBeInTheDocument(),
      );
      const done2 = screen.getByTestId("D-step-2-done");
      // In the upper-right corner of the box: x + width - 10, y + 10.
      expect(done2).toHaveAttribute("transform", "translate(246 55)");
      expect(done2.querySelector("circle")).toHaveAttribute("fill", "#198754");
      expect(done2).toHaveAttribute("aria-label", "done");

      expect(screen.getByTestId("D-step-1-label")).toHaveTextContent(
        "Created: 2026-01-03",
      );
      expect(screen.getByTestId("D-step-2-label")).toHaveTextContent(
        "Opened: 2026-01-07",
      );
      expect(screen.getByTestId("D-step-4-label")).toHaveTextContent(
        "Closed: 2026-02-01",
      );
      expect(screen.getByTestId("D-step-3-label")).toHaveTextContent(
        "Hiring Target: 8",
      );
      expect(screen.getByTestId("D-step-5-label")).toHaveTextContent(
        "Released: 2026-02-03",
      );
      expect(screen.getByTestId("D-step-6-label")).toHaveTextContent(
        "Opened: 2026-02-05",
      );
      expect(screen.getByTestId("D-step-7-label")).toHaveTextContent(
        "Deadline: 2026-02-15",
      );
      expect(screen.getByTestId("D-step-8-label")).toHaveTextContent(
        "Still to assign: 8",
      );
      expect(screen.getByTestId("D-step-9-label")).toHaveTextContent(
        "Not released yet",
      );
      // The label sits along the bottom of the box, in the small font.
      const label2 = screen.getByTestId("D-step-2-label");
      expect(label2).toHaveAttribute("y", "117");
      expect(label2).toHaveAttribute("font-size", "11");
      expect(label2).toHaveAttribute("x", "163");
      // The legend moved down with the taller boxes.
      expect(screen.getByTestId("D-footnote")).toHaveAttribute("y", "384");
    });

    test("a step with a page link wraps its title in a link; onNavigate takes over the click", async () => {
      const { onNavigate } = renderLive(recruitmentStepsFixtures.fresh);

      const link = screen.getByTestId("D-step-8-link");
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link).toHaveAttribute("href", "/admin/recruitments/1/assignments");
      expect(within(link).getByTestId("D-step-8-title")).toHaveTextContent(
        "8. Assign Candidates to Slots",
      );
      expect(link.style.textDecoration).toBe("underline");
      await userEvent.click(link);
      expect(onNavigate).toHaveBeenCalledWith(
        "/admin/recruitments/1/assignments",
      );
      // The click is intercepted: the browser is not left to follow the link.
      expect(fireEvent.click(link)).toBe(false);
      // Steps that open a modal or have no destination are not links.
      expect(screen.queryByTestId("D-step-1-link")).not.toBeInTheDocument();
      expect(screen.queryByTestId("D-step-2-link")).not.toBeInTheDocument();
    });

    test("without onNavigate the link is left to the browser", () => {
      const onAction = vi.fn();
      render(
        <RecruitmentStepsDiagram
          type="TA"
          steps={recruitmentStepsFixtures.published}
          onAction={onAction}
          testIdPrefix="D"
        />,
      );
      expect(screen.getByTestId("D-step-9-link")).toHaveAttribute(
        "href",
        "/recruitments/1/assignments",
      );
      // No handler at all, so the browser's own navigation is not prevented.
      expect(fireEvent.click(screen.getByTestId("D-step-9-link"))).toBe(true);
      expect(fireEvent.click(screen.getByTestId("D-step-3-link-Budget"))).toBe(
        true,
      );
      expect(screen.getByTestId("D-step-8-label")).toHaveTextContent(
        "Assignment complete",
      );
      expect(screen.getByTestId("D-step-9-label")).toHaveTextContent(
        "Released: 2026-02-20",
      );
      expect(svg().querySelectorAll("[data-testid$='-done']")).toHaveLength(9);
    });

    test("a step with an action is a keyboard-reachable button that reports the action", async () => {
      const { onAction } = renderLive(recruitmentStepsFixtures.fresh);

      const open = screen.getByTestId("D-step-2-action");
      expect(open).toHaveAttribute("role", "button");
      expect(open).toHaveAttribute("tabindex", "0");
      expect(open).toHaveAttribute(
        "aria-label",
        "Open TA Applications: open the openApplications dialog",
      );
      expect(open.style.cursor).toBe("pointer");
      expect(open.style.textDecoration).toBe("underline");
      await userEvent.click(open);
      expect(onAction).toHaveBeenLastCalledWith("openApplications");
      expect(fireEvent.click(open)).toBe(false);
      expect(onAction).toHaveBeenCalledTimes(2);

      open.focus();
      await userEvent.keyboard("{Enter}");
      expect(onAction).toHaveBeenLastCalledWith("openApplications");
      expect(onAction).toHaveBeenCalledTimes(3);
      await userEvent.keyboard(" ");
      expect(onAction).toHaveBeenCalledTimes(4);
      // Other keys do nothing.
      await userEvent.keyboard("a");
      await userEvent.keyboard("{Escape}");
      expect(onAction).toHaveBeenCalledTimes(4);
      // The footnote asterisk is not part of step 5's name.
      expect(screen.getByTestId("D-step-5-action")).toHaveAttribute(
        "aria-label",
        "Release Allocations to Faculty: open the allocationVisibility dialog",
      );

      await userEvent.click(screen.getByTestId("D-step-4-action"));
      expect(onAction).toHaveBeenLastCalledWith("closeApplications");
      await userEvent.click(screen.getByTestId("D-step-5-action"));
      expect(onAction).toHaveBeenLastCalledWith("allocationVisibility");
      await userEvent.click(screen.getByTestId("D-step-6-action"));
      expect(onAction).toHaveBeenLastCalledWith("openReviews");
      await userEvent.click(screen.getByTestId("D-step-7-action"));
      expect(onAction).toHaveBeenLastCalledWith("closeReviews");
      await userEvent.click(screen.getByTestId("D-step-9-action"));
      expect(onAction).toHaveBeenLastCalledWith("publishAssignments");
      expect(screen.queryByTestId("D-step-1-action")).not.toBeInTheDocument();
      expect(screen.queryByTestId("D-step-3-action")).not.toBeInTheDocument();
    });

    test("the default onAction is a no-op", async () => {
      render(
        <RecruitmentStepsDiagram
          type="TA"
          steps={recruitmentStepsFixtures.fresh}
          testIdPrefix="D"
        />,
      );
      await userEvent.click(screen.getByTestId("D-step-2-action"));
      expect(screen.getByTestId("D-step-2-action")).toBeInTheDocument();
    });

    test("step 3's title links the words Budget and Allocations to different pages", async () => {
      const { onNavigate } = renderLive(recruitmentStepsFixtures.fresh);

      const budget = screen.getByTestId("D-step-3-link-Budget");
      const allocations = screen.getByTestId("D-step-3-link-Allocations");
      expect(budget).toHaveAttribute("href", "/admin/budget/W26");
      expect(budget).toHaveTextContent("Budget");
      expect(allocations).toHaveAttribute(
        "href",
        "/admin/recruitments/1/courses",
      );
      expect(allocations).toHaveTextContent("Allocations");
      expect(budget.style.textDecoration).toBe("underline");
      expect(budget.style.fill).toMatch(/#0d6efd|rgb\(13, 110, 253\)/);
      expect(screen.getByTestId("D-step-3-title").textContent).toBe(
        "3. Budget / Allocations",
      );
      await userEvent.click(budget);
      expect(onNavigate).toHaveBeenLastCalledWith("/admin/budget/W26");
      await userEvent.click(allocations);
      expect(onNavigate).toHaveBeenLastCalledWith(
        "/admin/recruitments/1/courses",
      );
      expect(screen.queryByTestId("D-step-3-link")).not.toBeInTheDocument();
    });

    test("steps 7 and 9 carry their secondary links under the box", async () => {
      const { onNavigate } = renderLive(recruitmentStepsFixtures.fresh);

      const rankings = screen.getByTestId("D-step-7-secondary-link");
      expect(rankings).toHaveTextContent("(see rankings)");
      expect(rankings).toHaveAttribute("href", "/admin/recruitments/1/courses");
      // Under the box's left end: x + 4, y + height + 13, so step 6's arrow can enter at the right.
      const text = rankings.querySelector("text");
      expect(text).toHaveAttribute("x", "536.5");
      expect(text).toHaveAttribute("y", "152");
      expect(text).toHaveAttribute("text-anchor", "start");
      expect(text).toHaveAttribute("fill", "#0d6efd");
      expect(text).toHaveAttribute("font-size", "11");
      expect(text.style.textDecoration).toBe("underline");
      const assignments = screen.getByTestId("D-step-9-secondary-link");
      expect(assignments).toHaveTextContent("(see assignments)");
      await userEvent.click(assignments);
      expect(onNavigate).toHaveBeenLastCalledWith(
        "/admin/recruitments/1/courses",
      );
      expect(
        screen.queryByTestId("D-step-8-secondary-link"),
      ).not.toBeInTheDocument();
      expect(within(step(1)).queryByRole("link")).toBeNull();
    });

    test("the ULA fixture draws ULA titles with live data", () => {
      renderLive(recruitmentStepsFixtures.ulaFresh);
      expect(screen.getByTestId("D-step-2-title")).toHaveTextContent(
        "Open ULA",
      );
      expect(screen.getByTestId("D-step-2-action")).toHaveAttribute(
        "aria-label",
        "Open ULA Applications: open the openApplications dialog",
      );
      expect(screen.getByTestId("D-step-3-link-Budget")).toHaveAttribute(
        "href",
        "/admin/budget/W26",
      );
    });
  });
});
