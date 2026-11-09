import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import InstructorFeedbackSettingsPage from "main/pages/Admin/InstructorFeedbackSettingsPage";
import instructorFeedbackSettingsFixtures from "fixtures/instructorFeedbackSettingsFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

// CodeMirror does not run under jsdom; the card's own tests drive the editor this way too.
vi.mock("react-simplemde-editor", () => ({
  default: ({ value }) => <textarea data-testid="mde" value={value} readOnly />,
}));

const axiosMock = new AxiosMockAdapter(axios);

describe("InstructorFeedbackSettingsPage (issue #429)", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/admin/instructorFeedbackSettings/all")
      .reply(200, instructorFeedbackSettingsFixtures.history);
    axiosMock.onGet("/api/admin/budget/quarters").reply(200, []);
  });

  test("is titled Instructor Feedback Settings and holds the checkbox, then the notes editor", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <InstructorFeedbackSettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Instructor Feedback Settings",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/What instructors see around the form/),
    ).toHaveTextContent(
      "What instructors see around the form on their home page where they give feedback on their courses' TA and ULA allocations. Changes take effect immediately.",
    );
    expect(
      screen.getByTestId("InstructorFeedbackSettingsPage-notes"),
    ).toHaveClass("card");
    // Issue #430: the checkbox has a card of its own, at the top.
    const ask = screen.getByTestId("InstructorFeedbackSettingsPage-ask");
    expect(ask).toHaveClass("card");
    expect(ask.nextElementSibling).toBe(
      screen.getByTestId("InstructorFeedbackSettingsPage-notes"),
    );
    expect(ask.previousElementSibling.tagName).toBe("P");
    await waitFor(() =>
      expect(
        screen.getByTestId("InstructorFeedbackSettingsPage-ask-checkbox"),
      ).toBeChecked(),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId(
          "InstructorFeedbackSettingsPage-notes-history-row-0",
        ),
      ).toHaveTextContent("admin@ucsb.edu"),
    );
  });
});
