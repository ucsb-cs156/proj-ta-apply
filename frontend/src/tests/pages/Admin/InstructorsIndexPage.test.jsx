import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InstructorsIndexPage from "main/pages/Admin/InstructorsIndexPage";
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
});
