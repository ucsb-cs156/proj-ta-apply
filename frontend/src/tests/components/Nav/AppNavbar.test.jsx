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
      "Courses",
      "Quarters",
      "TA App Settings",
      "ULA App Settings",
      "Legacy TA Application",
      "Audit Trail",
    ];

    await waitFor(() => {
      adminMenuItems.forEach((item) => {
        expect(screen.getByText(item)).toBeInTheDocument();
      });
    });
    // Issue #141: the recruitments live on the admin's home page, so there is no menu item.
    expect(screen.queryByText("Recruitments")).toBeNull();
  });

  test("renders Help menu with only the About page when not logged in", async () => {
    renderNavbar(
      currentUserFixtures.notLoggedIn,
      systemInfoFixtures.showingNeither,
    );
    const helpToggle = screen.getByText("Help");
    expect(helpToggle).toBeInTheDocument();

    // The Help menu items aren't rendered into the DOM until the
    // dropdown toggle is clicked open, so click it first.
    fireEvent.click(helpToggle);

    await waitFor(() => {
      expect(screen.getByText("About TA Apply")).toBeInTheDocument();
    });
    expect(screen.getByText("About TA Apply")).toHaveAttribute(
      "href",
      "/help/about",
    );
    // Issue #140: the applicant pages are for everyone; the rest are by role.
    expect(screen.getByText("For TA Applicants")).toHaveAttribute(
      "href",
      "/help/ta-applicants",
    );
    expect(screen.getByText("For ULA Applicants")).toHaveAttribute(
      "href",
      "/help/ula-applicants",
    );
    expect(screen.queryByText("For Instructors")).toBeNull();
    expect(screen.queryByText("For Admins")).toBeNull();
    // Issue #99: the CSV formats page is admin-only, so it is not offered to anyone else.
    expect(screen.queryByText("CSV Upload/Download Formats")).toBeNull();
    expect(
      [...document.querySelectorAll(".dropdown-item")].map(
        (a) => a.textContent,
      ),
    ).toEqual(["About TA Apply", "For TA Applicants", "For ULA Applicants"]);
  });

  test("Help menu offers the instructors page to an instructor, and not the admin pages", async () => {
    renderNavbar(
      currentUserFixtures.instructorUser,
      systemInfoFixtures.showingNeither,
    );
    fireEvent.click(screen.getByText("Help"));

    await waitFor(() => {
      expect(screen.getByText("For Instructors")).toBeInTheDocument();
    });
    expect(screen.getByText("For Instructors")).toHaveAttribute(
      "href",
      "/help/instructors",
    );
    expect(screen.queryByText("For Admins")).toBeNull();
    expect(screen.queryByText("Notices Fields")).toBeNull();
    expect(screen.queryByText("CSV Upload/Download Formats")).toBeNull();
  });

  test("Help menu does not offer the CSV formats page to an ordinary user", async () => {
    renderNavbar(
      currentUserFixtures.userOnly,
      systemInfoFixtures.showingNeither,
    );
    fireEvent.click(screen.getByText("Help"));

    await waitFor(() => {
      expect(screen.getByText("About TA Apply")).toBeInTheDocument();
    });
    expect(screen.queryByText("CSV Upload/Download Formats")).toBeNull();
    expect(screen.queryByText("For Instructors")).toBeNull();
    expect(screen.queryByText("For Admins")).toBeNull();
  });

  test("Help menu offers the CSV formats page to an admin", async () => {
    renderNavbar(
      currentUserFixtures.adminUser,
      systemInfoFixtures.showingNeither,
    );
    fireEvent.click(screen.getByText("Help"));

    await waitFor(() => {
      expect(screen.getByText("About TA Apply")).toBeInTheDocument();
    });
    expect(screen.getByText("CSV Upload/Download Formats")).toHaveAttribute(
      "href",
      "/help/csv",
    );
    expect(screen.getByText("For Admins")).toHaveAttribute(
      "href",
      "/help/admins",
    );
    expect(screen.getByText("Notices Fields")).toHaveAttribute(
      "href",
      "/help/notice-fields",
    );
    // An admin who is not an instructor does not get the instructors page.
    expect(screen.queryByText("For Instructors")).toBeNull();
    expect(
      [
        ...document.querySelectorAll(
          "#appnavbar-help-dropdown + .dropdown-menu .dropdown-item, [aria-labelledby='appnavbar-help-dropdown'] .dropdown-item",
        ),
      ].map((a) => a.textContent),
    ).toEqual([
      "About TA Apply",
      "For TA Applicants",
      "For ULA Applicants",
      "For Admins",
      "Notices Fields",
      "CSV Upload/Download Formats",
    ]);
  });

  /** Jobs and Developer Info moved out of Admin into their own menu, still admin-only. */
  test("renders a Developer menu for admins with Jobs and Developer Info", async () => {
    renderNavbar(
      currentUserFixtures.adminUser,
      systemInfoFixtures.showingNeither,
    );
    expect(
      screen.getByTestId("appnavbar-developer-dropdown"),
    ).toHaveTextContent("Developer");

    // Like the Admin menu, the items render only once the toggle is clicked.
    fireEvent.click(screen.getByText("Developer"));

    await waitFor(() => {
      expect(screen.getByText("Jobs")).toHaveAttribute("href", "/admin/jobs");
    });
    expect(screen.getByText("Developer Info")).toHaveAttribute(
      "href",
      "/admin/developer",
    );
    // And they are no longer in the Admin menu.
    fireEvent.click(screen.getByText("Admin"));
    await waitFor(() => expect(screen.getByText("Users")).toBeInTheDocument());
    const adminMenu = screen.getByText("Users").closest(".dropdown-menu");
    expect(adminMenu).not.toHaveTextContent("Jobs");
    expect(adminMenu).not.toHaveTextContent("Developer Info");
  });

  test("does not render the Developer menu for non-admin users", () => {
    renderNavbar(
      currentUserFixtures.instructorUser,
      systemInfoFixtures.showingNeither,
    );
    expect(screen.queryByTestId("appnavbar-developer-dropdown")).toBeNull();
    expect(screen.queryByText("Developer")).toBeNull();
  });

  test("does not render Admin menu for non-admin users", () => {
    renderNavbar(
      currentUserFixtures.userOnly,
      systemInfoFixtures.showingNeither,
    );
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("Developer Info")).not.toBeInTheDocument();
  });
});
