import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import ApplicantDashboard from "main/components/Applications/ApplicantDashboard";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

const [upcomingTa, openUla, closedTa] = recruitmentsFixtures.threeRecruitments;

function renderDashboard(props = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ApplicantDashboard
          type="ULA"
          open={[]}
          upcoming={[]}
          recentlyClosed={[]}
          applications={[]}
          applicable={[]}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ApplicantDashboard tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---- nothing open ----

  test("says so when nothing is open, naming the right kind of position", () => {
    renderDashboard({ type: "ULA" });

    expect(
      screen.getByTestId("ApplicantDashboard-none-open"),
    ).toHaveTextContent(
      "Applications for ULA positions are not currently being accepted.",
    );
  });

  test("a grad student is told about TA positions, not ULA ones", () => {
    renderDashboard({ type: "TA" });

    expect(
      screen.getByTestId("ApplicantDashboard-none-open"),
    ).toHaveTextContent(
      "Applications for TA positions are not currently being accepted.",
    );
  });

  // ---- something open ----

  test("an open recruitment offers a link to apply", () => {
    renderDashboard({ open: [openUla] });

    expect(screen.queryByTestId("ApplicantDashboard-none-open")).toBeNull();
    expect(screen.getByTestId("ApplicantDashboard-open-2")).toHaveTextContent(
      "Applications for ULA positions in W26 are open.",
    );

    const link = screen.getByTestId("ApplicantDashboard-apply-2");
    expect(link).toHaveTextContent("Apply now");
    expect(link).toHaveAttribute("href", "/apply/2");
  });

  test("an open recruitment names its primary consideration date", () => {
    renderDashboard({ open: [openUla] });

    expect(
      screen.getByTestId("ApplicantDashboard-deadline-2"),
    ).toHaveTextContent(
      "Applications received by 2026-01-20 get primary consideration.",
    );
  });

  test("an open recruitment without a deadline says nothing about one", () => {
    renderDashboard({
      open: [{ ...openUla, primaryConsiderationDate: null }],
    });

    expect(screen.queryByTestId("ApplicantDashboard-deadline-2")).toBeNull();
  });

  /** Applying twice is refused by the backend, so do not offer it. */
  test("having already applied replaces the link with a note", () => {
    renderDashboard({
      open: [openUla],
      applications: [applicationsFixtures.oneUlaApplication],
      applicable: [openUla],
    });

    expect(screen.queryByTestId("ApplicantDashboard-apply-2")).toBeNull();
    expect(
      screen.getByTestId("ApplicantDashboard-applied-2"),
    ).toHaveTextContent("You have already applied");
  });

  // ---- upcoming and recently closed ----

  test("an upcoming recruitment reports its tentative opening date", () => {
    renderDashboard({ type: "TA", upcoming: [upcomingTa] });

    expect(
      screen.getByTestId("ApplicantDashboard-upcoming-3"),
    ).toHaveTextContent(
      "Applications for TA positions in S26 are expected to open on 2026-03-30.",
    );
  });

  test("a recently closed recruitment reports when it opened and closed", () => {
    renderDashboard({ type: "TA", recentlyClosed: [closedTa] });

    expect(screen.getByTestId("ApplicantDashboard-closed-1")).toHaveTextContent(
      "The most recent round of TA applications, for W26, opened on 2026-01-06 and closed on 2026-02-01.",
    );
  });

  test("all three states can appear at once", () => {
    renderDashboard({
      open: [openUla],
      upcoming: [upcomingTa],
      recentlyClosed: [closedTa],
    });

    expect(screen.getByTestId("ApplicantDashboard-open-2")).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicantDashboard-upcoming-3"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicantDashboard-closed-1"),
    ).toBeInTheDocument();
  });

  // ---- the applicant's own applications ----

  test("says so when there are no applications yet", () => {
    renderDashboard({ type: "TA" });

    expect(
      screen.getByTestId("ApplicantDashboard-no-applications"),
    ).toHaveTextContent("You have not applied for any TA positions yet.");
    expect(screen.queryByTestId("ApplicantDashboard-applications")).toBeNull();
  });

  test("lists the applications when there are some", () => {
    renderDashboard({
      applications: applicationsFixtures.twoApplications,
      applicable: recruitmentsFixtures.threeRecruitments,
    });

    expect(
      screen.queryByTestId("ApplicantDashboard-no-applications"),
    ).toBeNull();
    expect(
      screen.getByTestId(
        "ApplicantDashboard-applications-cell-row-0-col-status",
      ),
    ).toHaveTextContent("PENDING");
  });

  /** Every list arrives from a query that may not have resolved yet. */
  test("tolerates undefined lists", () => {
    renderDashboard({
      open: undefined,
      upcoming: undefined,
      recentlyClosed: undefined,
      applications: undefined,
      applicable: undefined,
    });

    expect(
      screen.getByTestId("ApplicantDashboard-none-open"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicantDashboard-no-applications"),
    ).toBeInTheDocument();
  });

  test("the test id prefix can be overridden", () => {
    renderDashboard({ testIdPrefix: "HomePageLoggedIn-dashboard" });

    expect(
      screen.getByTestId("HomePageLoggedIn-dashboard-none-open"),
    ).toBeInTheDocument();
  });
});
