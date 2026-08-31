import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import AppNavbar from "main/components/Nav/AppNavbar";
import { currentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

function renderNavbar(currentUser, systemInfo) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppNavbar
          currentUser={currentUser}
          systemInfo={systemInfo}
          doLogout={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const axiosMock = new AxiosMockAdapter(axios);

describe("AppNavbar tests", () => {
  const originalLocation = window.location;

  beforeEach(() => {
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

  test("clicking Log In navigates to the systemInfo oauthLogin url", () => {
    renderNavbar(currentUserFixtures.notLoggedIn, {
      ...systemInfoFixtures.showingNeither,
      oauthLogin: "/oauth2/authorization/google-test",
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    fireEvent.click(screen.getByText("Log In"));

    expect(window.location.href).toBe("/oauth2/authorization/google-test");
  });

  test("clicking Log In falls back to the default oauth url when systemInfo has none", () => {
    const { oauthLogin: _oauthLogin, ...systemInfoWithoutOauthLogin } =
      systemInfoFixtures.showingNeither;
    renderNavbar(currentUserFixtures.notLoggedIn, systemInfoWithoutOauthLogin);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    fireEvent.click(screen.getByText("Log In"));

    expect(window.location.href).toBe("/oauth2/authorization/google");
  });

  test("renders Log In button when not logged in", () => {
    renderNavbar(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingNeither,
    );
    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.queryByText("Log Out")).not.toBeInTheDocument();
  });

  test("renders user email and Log Out button when logged in", () => {
    renderNavbar(
      currentUserFixtures.userOnly,
      systemInfoFixtures.showingNeither,
    );
    expect(screen.getByText("Log Out")).toBeInTheDocument();
    expect(screen.queryByText("Log In")).not.toBeInTheDocument();
  });

  test("renders Swagger and H2Console links when systemInfo enables them", () => {
    renderNavbar(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingBoth,
    );
    expect(screen.getByText("Swagger")).toBeInTheDocument();
    expect(screen.getByText("H2Console")).toBeInTheDocument();
  });

  test("renders TA Apply brand link", () => {
    renderNavbar(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingNeither,
    );
    expect(screen.getByText("TA Apply")).toBeInTheDocument();
  });

  test("renders Admin menu for admins", async () => {
    renderNavbar(
      currentUserFixtures.adminUser,
      systemInfoFixtures.showingNeither,
    );
    const adminToggle = screen.getByText("Admin");
    expect(adminToggle).toBeInTheDocument();

    // The Admin menu items aren't rendered into the DOM until the
    // dropdown toggle is clicked open, so click it first.
    fireEvent.click(adminToggle);

    // Check that the Admin menu contains the expected items
    const adminMenuItems = [
      "Users",
      "Admins",
      "Instructors",
      "Grad Students",
      "Courses",
      "Jobs",
      "Developer Info",
    ];

    await waitFor(() => {
      adminMenuItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
  });

  test("does not render Admin menu for non-admin users", () => {
    renderNavbar(
      currentUserFixtures.userOnly,
      systemInfoFixtures.showingNeither,
    );
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Developer Info")).not.toBeInTheDocument();
  });
});
