import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import PastRecruitmentsTable from "main/components/Student/PastRecruitmentsTable";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import applicationsFixtures from "fixtures/applicationsFixtures";

const [, , closedTa] = recruitmentsFixtures.threeRecruitments;

function renderTable(
  recruitments = [closedTa],
  applications = [applicationsFixtures.oneTaApplication],
  prefix = "P",
) {
  render(
    <MemoryRouter>
      <PastRecruitmentsTable
        recruitments={recruitments}
        applications={applications}
        testIdPrefix={prefix}
      />
    </MemoryRouter>,
  );
}

describe("PastRecruitmentsTable tests", () => {
  test("shows the quarter, type, the four dates and a View Application link", () => {
    renderTable();

    expect(
      [...screen.getAllByRole("columnheader")].map((th) => th.textContent),
    ).toEqual([
      "Quarter",
      "Type",
      "Tentative Opening",
      "Primary Consideration",
      "Actually Opened",
      "Actually Closed",
      "",
    ]);
    expect(screen.getByTestId("P-cell-row-0-col-quarter")).toHaveTextContent(
      "W26",
    );
    expect(screen.getByTestId("P-cell-row-0-col-type")).toHaveTextContent("TA");
    expect(
      screen.getByTestId("P-cell-row-0-col-tentativeOpeningDate"),
    ).toHaveTextContent("2026-01-05");
    expect(
      screen.getByTestId("P-cell-row-0-col-primaryConsiderationDate"),
    ).toHaveTextContent("2026-01-20");
    expect(
      screen.getByTestId("P-cell-row-0-col-actualOpeningDate"),
    ).toHaveTextContent("2026-01-06");
    expect(
      screen.getByTestId("P-cell-row-0-col-actualClosingDate"),
    ).toHaveTextContent("2026-02-01");
    const link = screen.getByTestId("P-cell-row-0-col-view-link");
    expect(link).toHaveTextContent("View Application");
    // The TA application (id 1) belongs to recruitment 1.
    expect(link).toHaveAttribute("href", "/applications/1");
    expect(link).toHaveClass("btn", "btn-outline-primary", "btn-sm");
  });

  test("a recruitment without an application gets no link", () => {
    renderTable([closedTa], []);
    expect(screen.queryByTestId("P-cell-row-0-col-view-link")).toBeNull();
    expect(screen.getByTestId("P-cell-row-0-col-quarter")).toHaveTextContent(
      "W26",
    );
  });

  test("tolerates non-array props and uses the default prefix", () => {
    render(
      <MemoryRouter>
        <PastRecruitmentsTable recruitments={null} applications={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Actually Closed")).toBeInTheDocument();
    render(
      <MemoryRouter>
        <PastRecruitmentsTable
          recruitments={[closedTa]}
          applications={[applicationsFixtures.oneTaApplication]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("PastRecruitmentsTable-cell-row-0-col-view-link"),
    ).toBeInTheDocument();
  });
});
