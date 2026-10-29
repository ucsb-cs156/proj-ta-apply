import { render, screen } from "@testing-library/react";
import usersFixtures from "fixtures/usersFixtures";
import UsersTable from "main/components/Users/UsersTable";
import { formatTime } from "main/utils/dateUtils";

describe("UserTable tests", () => {
  test("renders without crashing for empty table", () => {
    render(<UsersTable users={[]} />);
  });

  test("renders without crashing for three users", () => {
    render(<UsersTable users={usersFixtures.threeUsers} />);
  });

  test("Has the expected colum headers and content", () => {
    render(<UsersTable users={usersFixtures.threeUsers} />);

    const expectedHeaders = [
      "id",
      "First Name",
      "Last Name",
      "Email",
      "Last Online",
      "Admin",
      "Instructor",
    ];
    const expectedFields = [
      "id",
      "givenName",
      "familyName",
      "email",
      "lastOnline",
      "admin",
      "instructor",
    ];
    const testId = "UsersTable";

    expectedHeaders.forEach((headerText) => {
      const header = screen.getByText(headerText);
      expect(header).toBeInTheDocument();
    });

    expectedFields.forEach((field) => {
      const header = screen.getByTestId(`${testId}-cell-row-0-col-${field}`);
      expect(header).toBeInTheDocument();
    });

    expect(screen.getByTestId(`${testId}-cell-row-0-col-id`)).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByTestId(`${testId}-cell-row-0-col-admin`),
    ).toHaveTextContent("true");
    expect(screen.getByTestId(`${testId}-cell-row-1-col-id`)).toHaveTextContent(
      "2",
    );
    expect(
      screen.getByTestId(`${testId}-cell-row-1-col-admin`),
    ).toHaveTextContent("false");

    expect(
      screen.getByTestId(`${testId}-cell-row-2-col-instructor`),
    ).toHaveTextContent("true");

    expect(screen.queryByText("Grad Student")).toBeNull();
    expect(
      screen.getByTestId(`${testId}-cell-row-1-col-instructor`),
    ).toHaveTextContent("false");
  });

  /** Issue #61: when each user last used the app, as proj-happycows shows it. */
  test("Last Online is shown in the viewer's locale, and blank when never recorded", () => {
    render(<UsersTable users={usersFixtures.threeUsers} />);

    const shown = screen.getByTestId("UsersTable-cell-row-0-col-lastOnline");
    expect(shown).toHaveTextContent(formatTime("2026-04-01T17:30:00Z"));
    expect(shown.textContent).toBe(
      new Date("2026-04-01T17:30:00Z").toLocaleString(),
    );
    expect(
      screen.getByTestId("UsersTable-cell-row-1-col-lastOnline").textContent,
    ).toBe(new Date("2026-03-28T09:05:12.345Z").toLocaleString());
    expect(
      screen.getByTestId("UsersTable-cell-row-2-col-lastOnline").textContent,
    ).toBe("");
  });

  test("Last Online sorts by the instant, not the text shown", async () => {
    render(<UsersTable users={usersFixtures.threeUsers} />);
    // Ascending: the null first, then March, then April.
    const header = screen.getByTestId(
      "UsersTable-header-lastOnline-sort-header",
    );
    header.click();
    await screen.findByText("🔼");
    // Cell test ids keep the original data index, so read the rows in DOM order.
    const idsInOrder = () =>
      Array.from(
        document.querySelectorAll('[data-testid="UsersTable"] tbody tr'),
      ).map((tr) => tr.querySelector("td").textContent);
    expect(idsInOrder()).toEqual(["3", "2", "1"]);
    header.click();
    await screen.findByText("🔽");
    expect(idsInOrder()).toEqual(["1", "2", "3"]);
  });
});
