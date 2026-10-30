import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstructorsIndexPage, {
  CATALOG_NAME_NOTE,
} from "main/pages/Admin/InstructorsIndexPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import mockConsole from "tests/testutils/mockConsole";
import { roleEmailFixtures } from "fixtures/roleEmailFixtures";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const axiosMock = new AxiosMockAdapter(axios);

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");

describe("InstructorsIndexPage tests", () => {
  const testId = "InstructorsIndexPage";

  const setupAdminUser = () => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/admin/instructors/catalogNames")
      .reply(200, roleEmailFixtures.catalogNames);
  };

  const queryClient = new QueryClient();

  afterEach(() => {
    useBackendSpy.mockClear();
  });

  test("Renders with New Instructor Button", async () => {
    setupAdminUser();
    axiosMock.onGet("/api/admin/instructors/get").reply(200, []);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/New Instructor/)).toBeInTheDocument();
    });
    const button = screen.getByText(/New Instructor/);
    expect(button).toHaveAttribute("href", "/admin/instructors/create");
    expect(button).toHaveAttribute("style", "float: right;");
  });

  test("renders three items correctly", async () => {
    setupAdminUser();
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`${testId}-cell-row-0-col-email`),
      ).toHaveTextContent("instructor1@example.com");
    });
    expect(
      screen.getByTestId(`${testId}-cell-row-1-col-email`),
    ).toHaveTextContent("admin1@example.com");
    expect(
      screen.getByTestId(`${testId}-cell-row-2-col-email`),
    ).toHaveTextContent("instructor2@example.com");

    // delete button should be visible
    expect(
      screen.getByTestId(`${testId}-cell-row-0-col-delete-button`),
    ).toBeInTheDocument();
  });

  test("renders empty table when backend unavailable", async () => {
    setupAdminUser();

    axiosMock.onGet("/api/admin/instructors/get").timeout();

    const restoreConsole = mockConsole();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(axiosMock.history.get.length).toBeGreaterThanOrEqual(1);
    });

    const errorMessage = console.error.mock.calls[0][0];
    expect(errorMessage).toMatch(
      "Error communicating with backend via GET on /api/admin/instructors/get",
    );
    restoreConsole();
  });

  test("what happens when you click delete", async () => {
    setupAdminUser();

    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    axiosMock
      .onDelete("/api/admin/instructors/delete")
      .reply(200, "first instructor deleted");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`${testId}-cell-row-0-col-email`),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByTestId(`${testId}-cell-row-0-col-email`),
    ).toHaveTextContent("instructor1@example.com");

    const deleteButton = screen.getByTestId(
      `${testId}-cell-row-0-col-delete-button`,
    );
    expect(deleteButton).toBeInTheDocument();

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("first instructor deleted");
    });

    await waitFor(() => {
      expect(axiosMock.history.delete.length).toBe(1);
    });
    expect(axiosMock.history.delete[0].url).toBe(
      "/api/admin/instructors/delete",
    );
    expect(axiosMock.history.delete[0].params).toEqual({
      email: "instructor1@example.com",
    });
  });
  test("useBackend is called with correct cache query key", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(useBackendSpy).toHaveBeenCalledWith(
      [`/api/admin/instructors/get`],
      { method: "GET", url: `/api/admin/instructors/get` },
      [],
    );
  });
  test("uploading a CSV posts it and toasts the summary", async () => {
    setupAdminUser();
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    axiosMock.onPost("/api/admin/instructors/upload/csv").reply(200, {
      inserted: 2,
      alreadyPresent: 1,
      invalid: 0,
      invalidEmails: [],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(["email\na@ucsb.edu\n"], "grads.csv", {
      type: "text/csv",
    });
    await userEvent.upload(
      screen.getByTestId("InstructorCSVUploadForm-upload"),
      file,
    );
    await userEvent.click(screen.getByTestId("InstructorCSVUploadForm-submit"));

    await waitFor(() => {
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/admin/instructors/upload/csv",
        ),
      ).toHaveLength(1);
    });
    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith(
      "Upload complete: 2 added, 1 already present, 0 invalid",
    );
  });

  test("invalid emails from the upload are listed in the toast", async () => {
    setupAdminUser();
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    axiosMock.onPost("/api/admin/instructors/upload/csv").reply(200, {
      inserted: 1,
      alreadyPresent: 0,
      invalid: 2,
      invalidEmails: ["nope", "also-nope"],
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(["email\nnope\n"], "grads.csv", {
      type: "text/csv",
    });
    await userEvent.upload(
      screen.getByTestId("InstructorCSVUploadForm-upload"),
      file,
    );
    await userEvent.click(screen.getByTestId("InstructorCSVUploadForm-submit"));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith(
      "Upload complete: 1 added, 0 already present, 2 invalid (nope, also-nope)",
    );
  });

  // ---- catalog names (issue #120) ----

  test("explains the catalog name and fetches the names for the dropdown", async () => {
    setupAdminUser();
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("InstructorsIndexPage-catalog-note"),
    ).toHaveTextContent(CATALOG_NAME_NOTE);
    expect(CATALOG_NAME_NOTE).toMatch(
      /^Catalog Name is how the course schedule spells/,
    );
    const select = await screen.findByTestId(
      `${testId}-cell-row-0-col-catalogName-select`,
    );
    await waitFor(() => expect(select.options).toHaveLength(4));
    expect(select).toHaveValue("STRUCTOR I");
    expect(useBackendSpy).toHaveBeenCalledWith(
      ["/api/admin/instructors/catalogNames"],
      { method: "GET", url: "/api/admin/instructors/catalogNames" },
      [],
    );
  });

  test("choosing a catalog name saves it, toasts and refreshes the list", async () => {
    setupAdminUser();
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    axiosMock
      .onPut("/api/admin/instructors/catalogName")
      .reply(200, roleEmailFixtures.threeItems[1]);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const select = await screen.findByTestId(
      `${testId}-cell-row-1-col-catalogName-select`,
    );
    await waitFor(() => expect(select.options).toHaveLength(4));
    fireEvent.change(select, { target: { value: "CONRAD P" } });

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].url).toBe(
      "/api/admin/instructors/catalogName",
    );
    expect(axiosMock.history.put[0].params).toEqual({
      email: "admin1@example.com",
      catalogName: "CONRAD P",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Catalog name saved."),
    );
    // The list is re-fetched.
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/instructors/get",
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
  });

  test("choosing (null) clears the catalog name", async () => {
    setupAdminUser();
    axiosMock
      .onGet("/api/admin/instructors/get")
      .reply(200, roleEmailFixtures.threeItems);
    axiosMock
      .onPut("/api/admin/instructors/catalogName")
      .reply(200, roleEmailFixtures.threeItems[0]);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const select = await screen.findByTestId(
      `${testId}-cell-row-0-col-catalogName-select`,
    );
    await waitFor(() => expect(select).toHaveValue("STRUCTOR I"));
    fireEvent.change(select, { target: { value: "" } });

    await waitFor(() => expect(axiosMock.history.put.length).toBe(1));
    expect(axiosMock.history.put[0].params).toEqual({
      email: "instructor1@example.com",
      catalogName: "",
    });
  });

  /** Issue #61: the name columns are blank for anyone who has not logged in yet. */
  test("explains at the top where the names come from", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorsIndexPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("InstructorsIndexPage-names-note"),
    ).toHaveTextContent(
      "First and Last name are populated when the user logs in for the first time.",
    );
  });
});
