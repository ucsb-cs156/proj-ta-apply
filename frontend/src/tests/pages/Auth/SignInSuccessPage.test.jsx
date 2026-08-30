import { render, waitFor, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import SignInSuccessPage from "main/pages/Auth/SignInSuccessPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import mockConsole from "tests/testutils/mockConsole";
import { vi } from "vitest";

import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

const axiosMock = new AxiosMockAdapter(axios);

const queryClient = new QueryClient();

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockedNavigate,
}));
describe("SignInSuccessPage tests", () => {
  beforeEach(() => {
    queryClient.clear();
    sessionStorage.clear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });
  test("Page redirects correctly on set value", async () => {
    const restoreConsole = mockConsole();
    sessionStorage.setItem("redirect", "return-url");
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SignInSuccessPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockedNavigate).toBeCalledWith("return-url"));
    expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    restoreConsole();
  });

  test("Page redirects to / on no value", async () => {
    const restoreConsole = mockConsole();
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SignInSuccessPage />
        </BrowserRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mockedNavigate).toBeCalledWith("/"));
    restoreConsole();
  });
});
