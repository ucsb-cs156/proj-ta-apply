import { render, screen } from "@testing-library/react";

import CancelledApplicationsTable from "main/components/Applications/CancelledApplicationsTable";
import cancelledApplicationsFixtures from "fixtures/cancelledApplicationsFixtures";

describe("CancelledApplicationsTable tests", () => {
  test("lists name, email and reason for each cancelled application, sized to its content", () => {
    render(
      <CancelledApplicationsTable
        cancelled={cancelledApplicationsFixtures.two}
        audience="faculty"
        testIdPrefix="C"
      />,
    );

    const section = screen.getByTestId("C");
    expect(section).toHaveAttribute("aria-label", "Cancelled applications");
    expect(section).toHaveClass("mt-4");
    expect(
      screen.getByRole("heading", { level: 2, name: "Cancelled applications" }),
    ).toHaveClass("h4");
    expect(screen.getByTestId("C-why")).toHaveTextContent(
      "Applicants who withdrew their application are not among the candidates above. This list is here so that, if you expected to see someone, you can tell what happened to them.",
    );
    expect(screen.getByTestId("C-why")).toHaveClass("small", "text-muted");

    const table = screen.getByTestId("C-table");
    expect(table).toHaveClass("w-auto");
    expect(
      [...table.querySelectorAll("thead th")].map((th) => th.textContent),
    ).toEqual(["Name", "Email", "Reason for cancellation"]);
    expect(screen.getByTestId("C-table-cell-row-0-col-name")).toHaveTextContent(
      "Grace Hopper",
    );
    expect(
      screen.getByTestId("C-table-cell-row-0-col-email"),
    ).toHaveTextContent("grace@ucsb.edu");
    expect(
      screen.getByTestId("C-table-cell-row-0-col-cancellationReason"),
    ).toHaveTextContent("Took a position in another department");
    expect(screen.getByTestId("C-table-cell-row-1-col-name")).toHaveTextContent(
      "Alan Turing",
    );
    expect(
      screen.getByTestId("C-table-cell-row-1-col-cancellationReason")
        .textContent,
    ).toBe("");
    expect(screen.queryByTestId("C-empty")).not.toBeInTheDocument();
  });

  test("a missing first or last name leaves no stray space", () => {
    render(
      <CancelledApplicationsTable
        cancelled={[
          {
            applicationId: 1,
            firstName: null,
            lastName: "Only",
            email: "only@ucsb.edu",
            cancellationReason: "x",
          },
          {
            applicationId: 2,
            firstName: "First",
            lastName: null,
            email: "first@ucsb.edu",
            cancellationReason: "y",
          },
        ]}
        audience="admin"
        testIdPrefix="C"
      />,
    );
    expect(screen.getByTestId("C-table-cell-row-0-col-name").textContent).toBe(
      "Only",
    );
    expect(screen.getByTestId("C-table-cell-row-1-col-name").textContent).toBe(
      "First",
    );
  });

  test("the admin wording says the applicants cannot be assigned", () => {
    render(
      <CancelledApplicationsTable
        cancelled={cancelledApplicationsFixtures.two}
        audience="admin"
        testIdPrefix="C"
      />,
    );
    expect(screen.getByTestId("C-why")).toHaveTextContent(
      "Applicants who withdrew their application are not among the rows above and cannot be assigned. This list is here so that, if you expected to see someone, you can tell what happened to them.",
    );
  });

  test("says so when nobody has cancelled, with the default test id", () => {
    render(
      <CancelledApplicationsTable
        cancelled={cancelledApplicationsFixtures.none}
        audience="faculty"
      />,
    );
    expect(
      screen.getByTestId("CancelledApplicationsTable-empty"),
    ).toHaveTextContent("No applicant has cancelled their application.");
    expect(
      screen.queryByTestId("CancelledApplicationsTable-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("CancelledApplicationsTable-why"),
    ).toBeInTheDocument();
  });
});
