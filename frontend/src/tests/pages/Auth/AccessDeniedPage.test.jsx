import { BrowserRouter } from "react-router";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AccessDeniedPage from "main/pages/Auth/AccessDeniedPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { vi } from "vitest";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

const axiosMock = new AxiosMockAdapter(axios);

const queryClient = new QueryClient();

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockedNavigate,
}));

describe("AccessDeniedPage tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("Access Denied Page static checks", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AccessDeniedPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/You do not have access to this page/);
    expect(screen.getByText("Return")).toBeInTheDocument();
  });

  test("Clicking navigates to home page", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AccessDeniedPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/You do not have access to this page/);
    expect(screen.getByText("Return")).toBeInTheDocument();
    const returnButton = screen.getByText("Return");
    fireEvent.click(returnButton);
    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith("/"));
  });
});
