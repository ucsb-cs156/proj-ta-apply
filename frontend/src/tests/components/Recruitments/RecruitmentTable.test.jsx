import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import RecruitmentTable from "main/components/Recruitments/RecruitmentTable";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

function renderTable(recruitments = recruitmentsFixtures.threeRecruitments) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RecruitmentTable
          recruitments={recruitments}
          testIdPrefix="RecruitmentTable"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Read-only since issue #86: the Admin > Recruitments page shows cards instead. */
describe("RecruitmentTable tests", () => {
  test("renders the field headers in order, and no buttons or links", () => {
    renderTable();

    const headers = Array.from(
      document.querySelectorAll('[data-testid="RecruitmentTable"] thead th'),
    ).map((th) => th.textContent.trim());
    expect(headers).toEqual([
      "Quarter",
      "Type",
      "Status",
      "Tentative Opening",
      "Primary Consideration",
      "Actually Opened",
      "Actually Closed",
      "Faculty Review Status",
      "Faculty Reviews Opened",
      "Faculty Ranking Deadline",
    ]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  /** Two-line headings keep the date columns narrow (issue #60). */
  test("the date headings are on two lines", () => {
    renderTable();

    for (const column of [
      "tentativeOpeningDate",
      "primaryConsiderationDate",
      "actualOpeningDate",
      "actualClosingDate",
      "facultyReviewOpeningDate",
      "facultyRankingDeadline",
    ]) {
      const th = screen.getByTestId(`RecruitmentTable-header-${column}`);
      expect(th.querySelector("br"), column).not.toBeNull();
    }
    // The other headings are one line.
    expect(
      screen.getByTestId("RecruitmentTable-header-quarter").querySelector("br"),
    ).toBeNull();
    expect(
      screen.getByTestId("RecruitmentTable-header-tentativeOpeningDate"),
    ).toHaveTextContent("Tentative Opening");
    expect(
      screen.getByTestId("RecruitmentTable-header-primaryConsiderationDate"),
    ).toHaveTextContent("Primary Consideration");
    expect(
      screen.getByTestId("RecruitmentTable-header-actualOpeningDate"),
    ).toHaveTextContent("Actually Opened");
    expect(
      screen.getByTestId("RecruitmentTable-header-actualClosingDate"),
    ).toHaveTextContent("Actually Closed");
    expect(
      screen.getByTestId("RecruitmentTable-header-facultyReviewOpeningDate"),
    ).toHaveTextContent("Faculty Reviews Opened");
    expect(
      screen.getByTestId("RecruitmentTable-header-facultyRankingDeadline"),
    ).toHaveTextContent("Faculty Ranking Deadline");
  });

  test("the date columns shrink to their content and the last takes the slack", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-quarter"),
    ).toHaveStyle({ width: "1%", whiteSpace: "nowrap" });
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-actualClosingDate"),
    ).toHaveStyle({ width: "1%", whiteSpace: "nowrap" });
    expect(
      screen.getByTestId(
        "RecruitmentTable-cell-row-0-col-facultyRankingDeadline",
      ),
    ).toHaveStyle({ width: "100%" });
  });

  test("shows the quarter in QYY form", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-quarter"),
    ).toHaveTextContent("S26");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-quarter"),
    ).toHaveTextContent("W26");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-type"),
    ).toHaveTextContent("ULA");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-applicationStatus"),
    ).toHaveTextContent("OPEN");
  });

  test("shows both actual dates once they are set", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-2-col-actualOpeningDate"),
    ).toHaveTextContent("2026-01-06");
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-2-col-actualClosingDate"),
    ).toHaveTextContent("2026-02-01");
  });

  test("the admin detail table shows the faculty review state and dates", () => {
    renderTable();
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-1-col-reviewStatus"),
    ).toHaveTextContent("Open");
    expect(
      screen.getByTestId(
        "RecruitmentTable-cell-row-1-col-facultyReviewOpeningDate",
      ),
    ).toHaveTextContent("2026-01-08");
    expect(
      screen.getByTestId(
        "RecruitmentTable-cell-row-1-col-facultyRankingDeadline",
      ),
    ).toHaveTextContent("2026-02-15");
  });

  test("the default test id prefix is RecruitmentTable", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <RecruitmentTable
            recruitments={[recruitmentsFixtures.threeRecruitments[0]]}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId("RecruitmentTable-cell-row-0-col-quarter"),
    ).toHaveTextContent("S26");
  });

  test("renders an empty table without crashing", () => {
    renderTable([]);
    expect(screen.getByText("Quarter")).toBeInTheDocument();
    expect(
      screen.queryByTestId("RecruitmentTable-cell-row-0-col-quarter"),
    ).toBeNull();
  });

  test("tolerates a non-array recruitments prop", () => {
    renderTable(null);
    expect(screen.getByText("Quarter")).toBeInTheDocument();
  });
});
