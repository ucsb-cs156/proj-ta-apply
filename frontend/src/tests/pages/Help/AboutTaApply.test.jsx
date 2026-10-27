import { render, screen } from "@testing-library/react";
import AboutTaApply from "main/pages/Help/AboutTaApply";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

describe("AboutTaApply tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  axiosMock
    .onGet("/api/currentUser")
    .reply(200, apiCurrentUserFixtures.userOnly);
  axiosMock
    .onGet("/api/systemInfo")
    .reply(200, systemInfoFixtures.showingNeither);

  const queryClient = new QueryClient();
  test("renders expected content", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AboutTaApply />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "About proj-ta-apply",
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("Proj-ta-apply allows:")).toBeInTheDocument();
    expect(
      screen.getByText(/Grad Students to apply for TA positions/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Undergrad students to apply for ULA positions/),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: "Key Features" }),
    ).toBeInTheDocument();

    expect(screen.getByText("For students")).toBeInTheDocument();
    expect(screen.getByText("For admins")).toBeInTheDocument();
    expect(screen.getByText("For faculty")).toBeInTheDocument();

    expect(
      screen.getByText(/keeps track of past applications/),
    ).toBeInTheDocument();
    expect(screen.getByText(/UCSB Registrar API/)).toBeInTheDocument();
    expect(
      screen.getByText(/only the applications that are relevant/),
    ).toBeInTheDocument();
  });
});
