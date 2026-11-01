import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import ApplicationsPageHeader from "main/components/Applications/ApplicationsPageHeader";

describe("ApplicationsPageHeader tests", () => {
  test("title, the CSV download and the Test Application link", () => {
    render(
      <MemoryRouter>
        <ApplicationsPageHeader recruitmentId={7} testIdPrefix="H" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Applications" }),
    ).toHaveClass("me-auto");
    expect(screen.getByTestId("H")).toHaveClass("d-flex", "mb-3");
    const csv = screen.getByTestId("H-download-csv");
    expect(csv).toHaveTextContent("Download Applications as CSV");
    expect(csv).toHaveAttribute(
      "href",
      "/api/admin/applications/csv?recruitmentId=7",
    );
    expect(csv).toHaveAttribute("download", "applications-7.csv");
    expect(csv).toHaveClass("btn", "btn-outline-primary");
    const test = screen.getByTestId("H-test-application");
    expect(test).toHaveTextContent("Test Application");
    expect(test).toHaveAttribute(
      "href",
      "/admin/recruitments/7/test-application",
    );
    expect(test).toHaveClass("btn", "btn-outline-secondary");
    // Download first, then Test Application.
    expect(
      csv.compareDocumentPosition(test) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("a custom title and the default test id prefix", () => {
    render(
      <MemoryRouter>
        <ApplicationsPageHeader
          recruitmentId="12"
          title="W26 TA Applications"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "W26 TA Applications" }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("ApplicationsPageHeader-download-csv"),
    ).toHaveAttribute("href", "/api/admin/applications/csv?recruitmentId=12");
    expect(
      screen.getByTestId("ApplicationsPageHeader-test-application"),
    ).toHaveAttribute("href", "/admin/recruitments/12/test-application");
  });
});
