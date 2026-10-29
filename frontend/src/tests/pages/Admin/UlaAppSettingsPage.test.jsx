import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import UlaAppSettingsPage from "main/pages/Admin/UlaAppSettingsPage";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";

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
    axiosMock
      .onGet("/api/admin/settings/ula-interests/all")
      .reply(200, appSettingsFixtures.twoInterests);
    axiosMock.onGet("/api/admin/notices/all").reply(200, []);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, recruitmentsFixtures.threeRecruitments);
  });

  test("has a Notices, Terms and Conditions card for the ULA form", async () => {
    renderPage();

    expect(screen.getByTestId("UlaAppSettingsPage-notices")).toHaveClass(
      "card",
    );
    expect(
      screen.getByRole("heading", { name: "Notices, Terms and Conditions" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter(
          (r) => r.url === "/api/admin/notices/all",
        )[0].params,
      ).toEqual({ type: "ULA" }),
    );
  });

  test("is headed ULA App Settings and holds a card per list", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "ULA App Settings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Majors List for ULAs")).toBeInTheDocument();
    expect(screen.getByText("Topics List for ULAs")).toBeInTheDocument();
    expect(screen.getByText("Interests List for ULAs")).toBeInTheDocument();
    // All three are React Bootstrap cards, interests after topics.
    expect(screen.getByTestId("UlaAppSettingsPage-majors")).toHaveClass("card");
    expect(screen.getByTestId("UlaAppSettingsPage-topics")).toHaveClass("card");
    expect(screen.getByTestId("UlaAppSettingsPage-interests")).toHaveClass(
      "card",
    );
    expect(
      screen
        .getByTestId("UlaAppSettingsPage-topics")
        .compareDocumentPosition(
          screen.getByTestId("UlaAppSettingsPage-interests"),
        ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
    expect(
      await screen.findByTestId(
        "UlaAppSettingsPage-interests-table-cell-row-1-col-name",
      ),
    ).toHaveTextContent("Tutoring");

    await waitFor(() =>
      expect(
        axiosMock.history.get
          .map((r) => r.url)
          .filter((u) => u.includes("settings")),
      ).toEqual(
        expect.arrayContaining([
          "/api/admin/settings/ula-majors/all",
          "/api/admin/settings/ula-topics/all",
          "/api/admin/settings/ula-interests/all",
        ]),
      ),
    );
  });

  /** Issue #70: the ULA form's responses are imported from here, into one ULA recruitment. */
  test("has an Import ULA Form Responses card offering the ULA quarters", async () => {
    renderPage();

    expect(screen.getByTestId("UlaAppSettingsPage-legacy")).toHaveClass("card");
    expect(
      screen.getByRole("heading", { name: "Import ULA Form Responses" }),
    ).toBeInTheDocument();
    const select = await screen.findByTestId(
      "UlaAppSettingsPage-legacy-quarter",
    );
    await waitFor(() => expect(select.options.length).toBe(2));
    expect(select.options[1].textContent).toBe("W26");
  });
});
