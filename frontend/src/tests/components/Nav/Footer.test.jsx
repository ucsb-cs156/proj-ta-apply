import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import Footer from "main/components/Nav/Footer";
import { DeveloperModeFooterControlsContext } from "main/utils/developerModeFooter";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderFooter(controls = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DeveloperModeFooterControlsContext.Provider value={controls}>
          <Footer />
        </DeveloperModeFooterControlsContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Footer tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("renders correctly", () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: false, on: false });
    renderFooter();
    const aboutLink = screen.getByRole("link", { name: "About TA Apply" });
    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink).toHaveAttribute("href", "/help/about");
    // The footer's row is as wide as the page's content column (see index.css).
    expect(aboutLink.closest("div")).toHaveClass("content-column");
  });

  test("no badge while developer mode is off, even if the switch is available", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: false });
    renderFooter(<button>Fake data</button>);

    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/developerMode"),
      ).toHaveLength(1),
    );
    expect(
      screen.queryByTestId("Footer-developer-mode"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("Footer-developer-mode-badge"),
    ).not.toBeInTheDocument();
    // Registered controls are shown only along with the badge.
    expect(
      screen.queryByRole("button", { name: "Fake data" }),
    ).not.toBeInTheDocument();
  });

  test("a red Developer Mode badge, flush right, while developer mode is on", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderFooter();

    const badge = await screen.findByTestId("Footer-developer-mode-badge");
    expect(badge).toHaveTextContent("Developer Mode");
    expect(badge).toHaveClass("badge", "bg-danger");
    const group = screen.getByTestId("Footer-developer-mode");
    expect(group).toHaveClass(
      "ms-auto",
      "d-flex",
      "align-items-center",
      "gap-2",
    );
    expect(
      screen.queryByTestId("Footer-developer-mode-controls"),
    ).not.toBeInTheDocument();
  });

  test("the page's registered controls appear to the right of the badge", async () => {
    axiosMock
      .onGet("/api/developerMode")
      .reply(200, { available: true, on: true });
    renderFooter(<button>Fake data</button>);

    const controls = await screen.findByTestId(
      "Footer-developer-mode-controls",
    );
    expect(controls).toHaveTextContent("Fake data");
    const group = screen.getByTestId("Footer-developer-mode");
    expect(group.firstChild).toBe(
      screen.getByTestId("Footer-developer-mode-badge"),
    );
    expect(group.lastChild).toBe(controls);
  });

  test("the status is read without a toast when the backend cannot answer", async () => {
    axiosMock.onGet("/api/developerMode").reply(500);
    renderFooter();

    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/developerMode"),
      ).toHaveLength(1),
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId("Footer-developer-mode-badge"),
    ).not.toBeInTheDocument();
  });
});
