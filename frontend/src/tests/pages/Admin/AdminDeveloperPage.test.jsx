import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDeveloperPage from "main/pages/Admin/AdminDeveloperPage";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import { MemoryRouter } from "react-router";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

function renderPage(systemInfo) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["systemInfo"], systemInfo);
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AdminDeveloperPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const axiosMock = new AxiosMockAdapter(axios);

describe("AdminDeveloperPage tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("renders developer information with backend links", () => {
    renderPage(systemInfoFixtures.showingNeither);

    expect(screen.getByText("Developer Information")).toBeInTheDocument();
    expect(screen.getByText("Current Deployed Branch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Swagger" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "H2 Console (only on localhost)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: systemInfoFixtures.showingBoth.sourceRepo,
      }),
    ).toBeInTheDocument();
  });
});
