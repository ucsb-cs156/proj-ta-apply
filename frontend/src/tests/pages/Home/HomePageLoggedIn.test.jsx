import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderHome(currentUserFixture) {
  const queryClient = new QueryClient();
  axiosMock.reset();
  axiosMock.onGet("/api/currentUser").reply(200, currentUserFixture);
  axiosMock
    .onGet("/api/systemInfo")
    .reply(200, systemInfoFixtures.showingNeither);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePageLoggedIn />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePageLoggedIn tests", () => {
  test("greets the user by given name", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);
    expect(
      await screen.findByTestId("HomePageLoggedIn-greeting"),
    ).toHaveTextContent("Welcome, Gaucho.");
  });

  test("a plain user sees only the ULA message", async () => {
    renderHome(apiCurrentUserFixtures.userOnly);
    await screen.findByTestId("HomePageLoggedIn-undergrad");
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-gradstudent")).toBeNull();
  });

  test("an admin sees the admin message but is not treated as a grad student", async () => {
    renderHome(apiCurrentUserFixtures.adminUser);
    await screen.findByTestId("HomePageLoggedIn-admin");
    // Roles are independent: admin does not imply grad student.
    expect(screen.queryByTestId("HomePageLoggedIn-gradstudent")).toBeNull();
    expect(screen.queryByTestId("HomePageLoggedIn-instructor")).toBeNull();
  });

  test("an instructor sees the instructor message", async () => {
    renderHome(apiCurrentUserFixtures.instructorUser);
    await screen.findByTestId("HomePageLoggedIn-instructor");
    expect(screen.queryByTestId("HomePageLoggedIn-admin")).toBeNull();
  });

  test("a grad student sees the TA message and not the ULA message", async () => {
    renderHome(apiCurrentUserFixtures.gradStudentUser);
    await screen.findByTestId("HomePageLoggedIn-gradstudent");
    expect(screen.queryByTestId("HomePageLoggedIn-undergrad")).toBeNull();
  });

  test("a user who is both instructor and grad student sees both messages", async () => {
    renderHome(apiCurrentUserFixtures.instructorAndGradStudentUser);
    await screen.findByTestId("HomePageLoggedIn-instructor");
    await screen.findByTestId("HomePageLoggedIn-gradstudent");
  });
});
