import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GradStudentsCreatePage from "main/pages/Admin/GradStudentsCreatePage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { afterEach, vi } from "vitest";
import * as useBackendModule from "main/utils/useBackend";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockedNavigate,
}));

const useBackendMutationSpy = vi.spyOn(useBackendModule, "useBackendMutation");

describe("GradStudentsCreatePage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);

  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  afterEach(() => {
    useBackendMutationSpy.mockClear();
  });

  const queryClient = new QueryClient();
  test("renders without crashing", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GradStudentsCreatePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });
  });

  test("on submit, makes request to backend, and redirects to /admin/gradstudents", async () => {
    const queryClient = new QueryClient();
    const gradStudent = {
      email: "testemailone@ucsb.edu",
    };

    axiosMock.onPost("/api/admin/gradstudents/post").reply(202, gradStudent);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GradStudentsCreatePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeInTheDocument();

    const createButton = screen.getByText("Create");
    expect(createButton).toBeInTheDocument();

    fireEvent.change(emailInput, {
      target: { value: "testemailone@ucsb.edu" },
    });

    fireEvent.click(createButton);

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));

    expect(axiosMock.history.post[0].params).toEqual({
      email: "testemailone@ucsb.edu",
    });

    // assert - check that the toast was called with the expected message
    expect(mockToast).toHaveBeenCalledWith(
      "New grad student added - email: testemailone@ucsb.edu",
    );
    await waitFor(() => {
      expect(mockedNavigate).toHaveBeenCalledWith("/admin/gradstudents");
    });
  });

  test("on storybook, no redirect", async () => {
    const queryClient = new QueryClient();
    const gradStudent = {
      email: "testemailone@ucsb.edu",
    };

    axiosMock.onPost("/api/admin/gradstudents/post").reply(202, gradStudent);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GradStudentsCreatePage storybook={true} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toBeInTheDocument();

    const createButton = screen.getByText("Create");
    expect(createButton).toBeInTheDocument();

    fireEvent.change(emailInput, {
      target: { value: "testemailone@ucsb.edu" },
    });

    fireEvent.click(createButton);

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));

    expect(axiosMock.history.post[0].params).toEqual({
      email: "testemailone@ucsb.edu",
    });

    // assert - check that the toast was called with the expected message
    expect(mockToast).toHaveBeenCalledWith(
      "New grad student added - email: testemailone@ucsb.edu",
    );
    await waitFor(() => {
      expect(mockedNavigate).not.toHaveBeenCalledWith("/admin/gradstudents");
    });
  });
  test("useBackendMutation is called with correct cache query key", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GradStudentsCreatePage storybook={true} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(useBackendMutationSpy).toHaveBeenCalledWith(
      expect.any(Function),
      { onSuccess: expect.any(Function) },
      [`/api/admin/gradstudents/all`],
    );
  });
});
