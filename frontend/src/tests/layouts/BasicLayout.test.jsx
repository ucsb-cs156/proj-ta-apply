import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import BasicLayout from "main/layouts/BasicLayout/BasicLayout";
import { currentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const axiosMock = new AxiosMockAdapter(axios);

function makeProviders(currentUser, systemInfo) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["current user"], currentUser);
  qc.setQueryData(["systemInfo"], systemInfo);
  return qc;
}

describe("BasicLayout tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("renders children inside the layout", () => {
    const qc = makeProviders(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingNeither,
    );
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <BasicLayout>
            <div data-testid="test-child">Hello from child</div>
          </BasicLayout>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("test-child")).toBeInTheDocument();
    expect(screen.getByText("Hello from child")).toBeInTheDocument();
  });

  test("renders AppNavbar brand inside layout", () => {
    const qc = makeProviders(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingNeither,
    );
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <BasicLayout />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText("TA Apply")).toBeInTheDocument();
  });

  test("renders Footer inside layout", () => {
    const qc = makeProviders(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingNeither,
    );
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <BasicLayout />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      screen.getByRole("link", { name: "About TA Apply" }),
    ).toBeInTheDocument();
  });
});
