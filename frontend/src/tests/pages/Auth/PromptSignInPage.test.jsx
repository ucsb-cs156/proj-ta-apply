import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import PromptSignInPage from "main/pages/Auth/PromptSignInPage";
import { currentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const axiosMock = new AxiosMockAdapter(axios);

function renderPromptSignInPage(initialEntries = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["current user"], currentUserFixtures.notLoggedIn);
  queryClient.setQueryData(["systemInfo"], systemInfoFixtures.showingNeither);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <PromptSignInPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PromptSignInPage tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  test("renders the sign-in prompt alert and login button", () => {
    renderPromptSignInPage();

    expect(
      screen.getByText("Please sign in before accessing this page."),
    ).toHaveClass("alert-danger");
    expect(
      screen.getByRole("button", { name: "Log In with Google" }),
    ).toBeInTheDocument();
  });

  test("clicking Log In with Google stores the current path as the redirect target", () => {
    renderPromptSignInPage(["/example/return"]);
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log In with Google" }));

    expect(sessionStorage.getItem("redirect")).toBe("/example/return");

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
