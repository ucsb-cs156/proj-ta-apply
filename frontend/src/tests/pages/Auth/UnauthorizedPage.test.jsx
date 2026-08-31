import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import UnauthorizedPage from "main/pages/Auth/UnauthorizedPage";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

describe("UnauthorizedPage tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    // The OAuth flow failed, so there is no session: /api/currentUser is a 403.
    axiosMock.onGet("/api/currentUser").reply(403);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("shows the not-authorized message", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <UnauthorizedPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("UnauthorizedPage-message"),
    ).toHaveTextContent("You are not authorized to access this application");
  });
});
