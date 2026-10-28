import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import UlaAppSettingsPage from "main/pages/Admin/UlaAppSettingsPage";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <UlaAppSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UlaAppSettingsPage tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/admin/settings/ula-majors/all")
      .reply(200, appSettingsFixtures.threeMajors);
    axiosMock
      .onGet("/api/admin/settings/ula-topics/all")
      .reply(200, appSettingsFixtures.twoTopics);
  });

  test("is headed ULA App Settings and holds a card per list", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "ULA App Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Majors List for ULAs")).toBeInTheDocument();
    expect(screen.getByText("Topics List for ULAs")).toBeInTheDocument();
    // Both are React Bootstrap cards.
    expect(screen.getByTestId("UlaAppSettingsPage-majors")).toHaveClass("card");
    expect(screen.getByTestId("UlaAppSettingsPage-topics")).toHaveClass("card");
  });

  /** Each card is wired to the ULA list, not the other type's. */
  test("the cards load the ULA lists", async () => {
    renderPage();

    expect(
      await screen.findByTestId(
        "UlaAppSettingsPage-majors-table-cell-row-0-col-name",
      ),
    ).toHaveTextContent("Computer Engineering");
    expect(
      await screen.findByTestId(
        "UlaAppSettingsPage-topics-table-cell-row-1-col-name",
      ),
    ).toHaveTextContent("Web Development");

    await waitFor(() =>
      expect(
        axiosMock.history.get
          .map((r) => r.url)
          .filter((u) => u.includes("settings")),
      ).toEqual(
        expect.arrayContaining([
          "/api/admin/settings/ula-majors/all",
          "/api/admin/settings/ula-topics/all",
        ]),
      ),
    );
  });
});
