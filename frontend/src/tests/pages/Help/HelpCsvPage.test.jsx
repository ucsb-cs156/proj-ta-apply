import { render, screen } from "@testing-library/react";
import HelpCsvPage from "main/pages/Help/HelpCsvPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import csvFixtures from "fixtures/csvFixtures";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

describe("HelpCsvPage tests", () => {
  const axiosMock = new AxiosMockAdapter(axios);
  axiosMock
    .onGet("/api/currentUser")
    .reply(200, apiCurrentUserFixtures.userOnly);
  axiosMock
    .onGet("/api/systemInfo")
    .reply(200, systemInfoFixtures.showingNeither);

  const queryClient = new QueryClient();
  test("renders expected content", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HelpCsvPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "CSV Upload/Download Formats",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Email List CSV Upload formats",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "CSV Download formats" }),
    ).toBeInTheDocument();

    expect(screen.getByTestId("emailUploadsAccordion")).toBeInTheDocument();
    expect(screen.getByText("Grad Student Emails")).toBeInTheDocument();
    expect(screen.getByText("Instructor Emails")).toBeInTheDocument();

    expect(screen.getByTestId("gradStudentCsvExample")).toHaveTextContent(
      "cgaucho@ucsb.edu",
    );
    expect(screen.getByTestId("gradStudentCsvExample").textContent).toBe(
      csvFixtures.gradStudentEmails,
    );
    expect(screen.getByTestId("instructorCsvExample").textContent).toBe(
      csvFixtures.instructorEmails,
    );

    expect(
      screen.getByText(/does not currently offer any CSV downloads/),
    ).toBeInTheDocument();
  });
});
