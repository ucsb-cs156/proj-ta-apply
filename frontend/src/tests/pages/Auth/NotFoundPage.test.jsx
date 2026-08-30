import { BrowserRouter } from "react-router";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotFoundPage from "main/pages/Auth/NotFoundPage";

import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

const axiosMock = new AxiosMockAdapter(axios);

const queryClient = new QueryClient();

describe("NotFoundPage tests", () => {
  beforeEach(() => {
    queryClient.clear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("Not Found Page static checks", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotFoundPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await screen.findByText(/Page Not Found/);
    expect(
      screen.getByText("Let's get you back on track."),
    ).toBeInTheDocument();
    expect(screen.getByText("Click to Return Home")).toBeInTheDocument();
  });

  test("Clicking navigates to home page", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NotFoundPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Click to Return Home")).toBeInTheDocument();
    const returnHomeButton = screen.getByText("Click to Return Home");
    fireEvent.click(returnHomeButton);
    expect(window.location.pathname).toBe("/");
  });
});
