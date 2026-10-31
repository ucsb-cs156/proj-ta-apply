import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import StudentRecruitmentCards, {
  NOT_OPEN_TOOLTIP,
} from "main/components/Student/StudentRecruitmentCards";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";

// W26 ULA OPEN (id 2); W26 TA CLOSED on 2026-02-01 (id 1).
const [, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;
// The ULA application (id 2) is to recruitment 2; the TA one (id 1) to recruitment 1.
const { oneUlaApplication: ulaApp, oneTaApplication: taApp } =
  applicationsFixtures;

function renderCards(
  recruitments = [openUla, closedTa],
  applications = [],
  onCancelRequested = vi.fn(),
) {
  render(
    <MemoryRouter>
      <StudentRecruitmentCards
        recruitments={recruitments}
        applications={applications}
        onCancelRequested={onCancelRequested}
        testIdPrefix="S"
      />
    </MemoryRouter>,
  );
  return onCancelRequested;
}

describe("StudentRecruitmentCards tests", () => {
  test("a card has the quarter, type, status and dates like the admin's", () => {
    renderCards();

    expect(screen.getByTestId("S-card-2-quarter")).toHaveTextContent("W26");
    expect(screen.getByTestId("S-card-2-type")).toHaveTextContent("ULA");
    const status = screen.getByTestId("S-card-2-applicationStatus");
    expect(status).toHaveTextContent("OPEN");
    expect(status).toHaveClass("badge", "bg-success");
    expect(screen.getByTestId("S-card-1-applicationStatus")).toHaveClass(
      "bg-secondary",
    );
    expect(
      screen.getByTestId("S-card-2-tentativeOpeningDate"),
    ).toHaveTextContent("2026-01-05");
    expect(
      screen.getByTestId("S-card-2-primaryConsiderationDate"),
    ).toHaveTextContent("2026-01-20");
    expect(screen.getByTestId("S-card-2-actualOpeningDate")).toHaveTextContent(
      "2026-01-07",
    );
    expect(screen.getByTestId("S-card-2-actualClosingDate").textContent).toBe(
      "",
    );
    expect(screen.getByTestId("S-card-1-actualClosingDate")).toHaveTextContent(
      "2026-02-01",
    );
    const body = screen.getByTestId("S-card-2-card").querySelector("dl");
    expect(
      Array.from(body.querySelectorAll("dt")).map((dt) => dt.textContent),
    ).toEqual([
      "Tentative Opening:",
      "Primary Consideration:",
      "Actually Opened:",
      "Actually Closed:",
    ]);
    expect(screen.getByTestId("S-card-2-card").style.maxWidth).toBe("48rem");
    expect(screen.queryByTestId("S-card-2-reviewStatus")).toBeNull();
    expect(screen.queryByText(/Faculty Review/)).toBeNull();
    expect(screen.queryByText(/Faculty Ranking Deadline/)).toBeNull();
  });

  test("without an application: a grey badge, and Apply Now live only when open", async () => {
    renderCards();

    const badge = screen.getByTestId("S-card-2-applied");
    expect(badge).toHaveTextContent("No application submitted yet");
    expect(badge).toHaveClass("badge", "bg-secondary", "ms-auto");

    const apply = screen.getByTestId("S-card-2-apply");
    expect(apply).toHaveTextContent("Apply Now");
    expect(apply).toHaveAttribute("href", "/apply/2");
    expect(apply).toHaveClass("btn", "btn-success");
    expect(screen.queryByTestId("S-card-2-view")).toBeNull();
    expect(screen.queryByTestId("S-card-2-cancel")).toBeNull();

    // Closed: greyed out, with a tooltip on its wrapper.
    const closedApply = screen.getByTestId("S-card-1-apply");
    expect(closedApply).toBeDisabled();
    expect(closedApply).toHaveTextContent("Apply Now");
    expect(closedApply).toHaveClass("btn-secondary");
    expect(closedApply).toHaveStyle({ pointerEvents: "none" });
    expect(closedApply).not.toHaveAttribute("href");
    fireEvent.mouseOver(screen.getByTestId("S-card-1-apply-wrapper"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Applications are not open yet");
    expect(tooltip).toHaveAttribute("id", "S-card-1-apply-tooltip");
    expect(NOT_OPEN_TOOLTIP).toBe("Applications are not open yet");
  });

  test("with an application: a green badge, View/Edit while open, View/Comment once closed, and Cancel", async () => {
    const onCancelRequested = renderCards([openUla, closedTa], [ulaApp, taApp]);

    expect(screen.getByTestId("S-card-2-applied")).toHaveTextContent(
      "Application on File",
    );
    expect(screen.getByTestId("S-card-2-applied")).toHaveClass("bg-success");
    expect(screen.queryByTestId("S-card-2-apply")).toBeNull();

    const edit = screen.getByTestId("S-card-2-view");
    expect(edit).toHaveTextContent("View/Edit my Application");
    expect(edit).toHaveAttribute("href", "/applications/2");
    expect(edit).toHaveClass("btn", "btn-success");

    const comment = screen.getByTestId("S-card-1-view");
    expect(comment).toHaveTextContent("View/Comment on My Application");
    expect(comment).toHaveAttribute("href", "/applications/1");
    expect(comment).toHaveClass("btn", "btn-success");

    // Cancel on both, open or closed; it asks the parent rather than acting.
    const cancel = screen.getByTestId("S-card-1-cancel");
    expect(cancel).toHaveTextContent("Cancel my Application");
    expect(cancel).toHaveClass("btn-danger", "ms-auto");
    await userEvent.click(cancel);
    expect(onCancelRequested).toHaveBeenCalledTimes(1);
    expect(onCancelRequested).toHaveBeenCalledWith(taApp, closedTa);
    await userEvent.click(screen.getByTestId("S-card-2-cancel"));
    expect(onCancelRequested).toHaveBeenLastCalledWith(ulaApp, openUla);
  });

  test("a cancelled application: a grey badge, a plain View link and no Cancel", () => {
    renderCards([openUla], [applicationsFixtures.oneCancelledApplication]);

    const badge = screen.getByTestId("S-card-2-applied");
    expect(badge).toHaveTextContent("Application cancelled");
    expect(badge).toHaveClass("bg-secondary");
    const view = screen.getByTestId("S-card-2-view");
    expect(view).toHaveTextContent("View my Application");
    expect(view).toHaveAttribute("href", "/applications/4");
    expect(view).toHaveClass("btn-outline-secondary");
    expect(screen.queryByTestId("S-card-2-cancel")).toBeNull();
    expect(screen.queryByTestId("S-card-2-apply")).toBeNull();
  });

  test("tolerates non-array props and has defaults", async () => {
    render(
      <MemoryRouter>
        <StudentRecruitmentCards recruitments={null} applications={null} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("StudentRecruitmentCards")).toBeEmptyDOMElement();

    render(
      <MemoryRouter>
        <StudentRecruitmentCards recruitments={[openUla]} applications={null} />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("StudentRecruitmentCards-card-2-apply"),
    ).toBeInTheDocument();
  });

  test("the default cancel handler is a no-op", async () => {
    render(
      <MemoryRouter>
        <StudentRecruitmentCards
          recruitments={[openUla]}
          applications={[ulaApp]}
        />
      </MemoryRouter>,
    );
    await userEvent.click(
      screen.getByTestId("StudentRecruitmentCards-card-2-cancel"),
    );
    expect(
      screen.getByTestId("StudentRecruitmentCards-card-2-cancel"),
    ).toBeInTheDocument();
  });
});
