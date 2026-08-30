import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import SignInPage from "main/pages/Auth/SignInPage";
import { currentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const axiosMock = new AxiosMockAdapter(axios);

function renderSignInPage(systemInfo) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["current user"], currentUserFixtures.notLoggedIn);
  queryClient.setQueryData(["systemInfo"], systemInfo);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SignInPage tests", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  test("renders the login card", () => {
    renderSignInPage(systemInfoFixtures.showingNeither);

    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log In with Google" }),
    ).toBeInTheDocument();
  });

  test("clicking Log In with Google navigates to the systemInfo oauthLogin url", () => {
    renderSignInPage({
      ...systemInfoFixtures.showingNeither,
      oauthLogin: "/oauth2/authorization/google-test",
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log In with Google" }));

    expect(window.location.href).toBe("/oauth2/authorization/google-test");
  });
});
