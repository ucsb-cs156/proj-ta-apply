import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginScreen from "main/components/Auth/LoginScreen";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import type { SystemInfo } from "main/utils/systemInfo";

import axios from "axios";
import axiosMockAdapter from "axios-mock-adapter";

const axiosMock = new axiosMockAdapter(axios);

function renderLoginScreen(
  systemInfo: Partial<SystemInfo> | undefined,
  onLogin?: () => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(["systemInfo"], systemInfo);
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginScreen onLogin={onLogin} />
    </QueryClientProvider>,
  );
}

describe("LoginScreen", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetAllMocks();
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

  test("renders the TaApply branding, prompt, and login button", () => {
    renderLoginScreen(systemInfoFixtures.showingNeither);

    expect(screen.getByText("Welcome to TaApply")).toBeInTheDocument();
    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Log In with Google" }),
    ).toBeInTheDocument();
  });

  test("clicking the button navigates to the systemInfo oauthLogin url", () => {
    renderLoginScreen({
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

  test("clicking the button falls back to the default oauth url when systemInfo has none", () => {
    renderLoginScreen({
      ...systemInfoFixtures.showingNeither,
      oauthLogin: undefined,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log In with Google" }));

    expect(window.location.href).toBe("/oauth2/authorization/google");
  });

  test("clicking the button calls onLogin when provided", () => {
    const onLogin = vi.fn();
    renderLoginScreen(systemInfoFixtures.showingNeither, onLogin);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log In with Google" }));

    expect(onLogin).toHaveBeenCalled();
  });

  test("clicking the button does not throw when onLogin is not provided", () => {
    renderLoginScreen(systemInfoFixtures.showingNeither);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    expect(() =>
      fireEvent.click(
        screen.getByRole("button", { name: "Log In with Google" }),
      ),
    ).not.toThrow();
  });
});
