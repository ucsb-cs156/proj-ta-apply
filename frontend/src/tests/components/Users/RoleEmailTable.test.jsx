import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RoleEmailTable, {
  NAMES_NOTE,
  NO_CATALOG_NAME,
} from "main/components/Users/RoleEmailTable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";
import { vi } from "vitest";

const testData = [
  { email: "user1@example.org" },
  { email: "user2@example.org" },
];

const mockDeleteCallback = vi.fn();

const axiosMock = new AxiosMockAdapter(axios);

describe("RoleEmailTable", () => {
  let queryClient;
  let invalidateQueriesSpy;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  // After each test, restore the original implementation and clean up.
  afterEach(() => {
    invalidateQueriesSpy.mockRestore(); // Restore original implementation of the spy
    queryClient.clear(); // Clear the React Query cache
  });

  test("renders empty table correctly when data is null", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={null} deleteCallback={mockDeleteCallback} />,
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("RoleEmailTable-cell-row-0-col-email"),
    ).not.toBeInTheDocument();
  });

  test("renders table with email data", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={testData} deleteCallback={mockDeleteCallback} />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("user1@example.org")).toBeInTheDocument();
    expect(screen.getByText("user2@example.org")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons.length).toBe(testData.length);
  });

  test("renders table with email data plus isInAdminEmails", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={roleEmailFixtures.threeItemsWithIsInAdminEmailField}
            deleteCallback={mockDeleteCallback}
          />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Email")).toBeInTheDocument();
    const deleteHeader = screen.getByTestId(
      "RoleEmailTable-header-isInAdminEmails",
    );
    expect(deleteHeader).toBeInTheDocument();
    expect(deleteHeader).toHaveTextContent("Delete");
    expect(
      screen.getByTestId("RoleEmailTable-cell-row-0-cannot-delete"),
    ).toBeInTheDocument();
  });

  test("calls deleteCallback when Delete button clicked", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={testData}
            customDeleteCallback={mockDeleteCallback}
          />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(testData.length);

    fireEvent.click(buttons[0]);

    expect(mockDeleteCallback).toHaveBeenCalledTimes(1);
  });

  test("renders Delete button with correct label", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={testData} deleteCallback={mockDeleteCallback} />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons.length).toBe(testData.length);
    deleteButtons.forEach((btn) => {
      expect(btn).toHaveTextContent(/delete/i);
    });
  });

  test("renders table with correct testid", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={testData} deleteCallback={mockDeleteCallback} />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByTestId("RoleEmailTable-header-email"),
    ).toBeInTheDocument();
  });

  test("Delete button has correct Bootstrap class", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={testData} deleteCallback={mockDeleteCallback} />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    deleteButtons.forEach((btn) => {
      expect(btn).toHaveClass("btn-danger");
    });
  });

  test("Delete button has correct data-testid using table ID prefix", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={testData} deleteCallback={mockDeleteCallback} />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const deleteButton = screen.getByTestId(
      "RoleEmailTable-cell-row-0-col-delete-button",
    );
    expect(deleteButton).toBeInTheDocument();
  });

  test("Check defaults for api endpoints", async () => {
    axiosMock.onDelete("/api/admin/delete").reply(200, {});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={testData} />,
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const deleteButton = screen.getByTestId(
      "RoleEmailTable-cell-row-0-col-delete-button",
    );
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(axiosMock.history.delete.length).toBe(1);
    });
    expect(axiosMock.history.delete[0].url).toBe("/api/admin/delete");
    expect(axiosMock.history.delete[0].params).toEqual({
      email: "user1@example.org",
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/all"],
    });
  });

  test("Check that api endpoint overrides work", async () => {
    axiosMock.onDelete("/api/admin/instructor/delete").reply(200, {});

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={testData}
            deleteEndpoint="/api/admin/instructor/delete"
            getEndpoint="/api/admin/instructor/all"
          />
          ,
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const deleteButton = screen.getByTestId(
      "RoleEmailTable-cell-row-0-col-delete-button",
    );
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(axiosMock.history.delete.length).toBe(1);
    });
    expect(axiosMock.history.delete[0].url).toBe(
      "/api/admin/instructor/delete",
    );
    expect(axiosMock.history.delete[0].params).toEqual({
      email: "user1@example.org",
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(1);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["/api/admin/instructor/all"],
    });
  });

  /** Issue #84: the table is as wide as its content, not the page, so no column is stretched. */
  test("the table takes its natural width and no column is given a width of its own", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={roleEmailFixtures.threeItems} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("RoleEmailTable")).toHaveClass(
      "table",
      "table-striped",
      "table-bordered",
      "w-auto",
    );
    for (const col of ["email", "givenName", "familyName", "isInAdminEmails"]) {
      expect(
        screen.getByTestId(`RoleEmailTable-cell-row-0-col-${col}`),
      ).not.toHaveAttribute("style");
      expect(
        screen.getByTestId(`RoleEmailTable-header-${col}`),
      ).not.toHaveAttribute("style");
    }
  });

  // ---- the Catalog Name column (issue #120) ----

  test("without a catalog-name handler there is no Catalog Name column", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={roleEmailFixtures.threeItems}
            catalogNames={roleEmailFixtures.catalogNames}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Catalog Name")).toBeNull();
    expect(
      screen.queryByTestId("RoleEmailTable-cell-row-0-col-catalogName-select"),
    ).toBeNull();
  });

  test("with a handler, each row gets a dropdown of (null) and every catalog name, on the current one", () => {
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={roleEmailFixtures.threeItems}
            catalogNames={roleEmailFixtures.catalogNames}
            onCatalogNameChange={onChange}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const headers = Array.from(
      document.querySelectorAll('[data-testid="RoleEmailTable"] thead th'),
    ).map((th) => th.textContent.trim());
    expect(headers).toEqual([
      "Email",
      "First Name",
      "Last Name",
      "Catalog Name",
      "Delete",
    ]);

    const first = screen.getByTestId(
      "RoleEmailTable-cell-row-0-col-catalogName-select",
    );
    expect([...first.options].map((o) => o.textContent)).toEqual([
      "(null)",
      "CONRAD P",
      "STRUCTOR I",
      "TEACHER S",
    ]);
    expect(NO_CATALOG_NAME).toBe("(null)");
    expect(first.options[0].value).toBe("");
    expect(first).toHaveValue("STRUCTOR I");
    expect(first).toHaveAccessibleName(
      "Catalog name for instructor1@example.com",
    );
    // No catalog name yet: (null) selected.
    expect(
      screen.getByTestId("RoleEmailTable-cell-row-1-col-catalogName-select"),
    ).toHaveValue("");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("choosing a name, or (null), calls back with the email and the choice", async () => {
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={roleEmailFixtures.threeItems}
            catalogNames={roleEmailFixtures.catalogNames}
            onCatalogNameChange={onChange}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(
      screen.getByTestId("RoleEmailTable-cell-row-1-col-catalogName-select"),
      { target: { value: "CONRAD P" } },
    );
    expect(onChange).toHaveBeenCalledWith("admin1@example.com", "CONRAD P");

    fireEvent.change(
      screen.getByTestId("RoleEmailTable-cell-row-0-col-catalogName-select"),
      { target: { value: "" } },
    );
    expect(onChange).toHaveBeenLastCalledWith("instructor1@example.com", null);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test("with a handler but no names yet, the dropdown offers only (null)", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable
            data={roleEmailFixtures.threeItems}
            onCatalogNameChange={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const select = screen.getByTestId(
      "RoleEmailTable-cell-row-1-col-catalogName-select",
    );
    expect(select.options).toHaveLength(1);
  });

  /** Issue #61: names from the users table, so only for people who have logged in. */
  test("First and Last Name columns come after Email and are blank until the person has logged in", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RoleEmailTable data={roleEmailFixtures.threeItems} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const headers = Array.from(
      document.querySelectorAll('[data-testid="RoleEmailTable"] thead th'),
    ).map((th) => th.textContent.trim());
    expect(headers).toEqual(["Email", "First Name", "Last Name", "Delete"]);

    expect(
      screen.getByTestId("RoleEmailTable-cell-row-0-col-givenName"),
    ).toHaveTextContent("Ina");
    expect(
      screen.getByTestId("RoleEmailTable-cell-row-0-col-familyName"),
    ).toHaveTextContent("Structor");
    expect(
      screen.getByTestId("RoleEmailTable-cell-row-1-col-givenName").textContent,
    ).toBe("");
    expect(
      screen.getByTestId("RoleEmailTable-cell-row-1-col-familyName")
        .textContent,
    ).toBe("");
    expect(NAMES_NOTE).toBe(
      "First and Last name are populated when the user logs in for the first time.",
    );
  });
});
