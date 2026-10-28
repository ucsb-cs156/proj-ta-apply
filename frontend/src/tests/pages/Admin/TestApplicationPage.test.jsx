import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import TestApplicationPage from "main/pages/Admin/TestApplicationPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import recruitmentCoursesFixtures from "fixtures/recruitmentCoursesFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

// Recruitment 3 is a CLOSED TA recruitment: the preview must work before applications open.
const [closedTa, openUla] = recruitmentsFixtures.threeRecruitments;

function renderPage(recruitmentId = 3) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter
        initialEntries={[
          `/admin/recruitments/${recruitmentId}/test-application`,
        ]}
      >
        <Routes>
          <Route
            path="/admin/recruitments/:recruitmentId/test-application"
            element={<TestApplicationPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Adds one UCSB course through the coursework modal; a TA application needs three. */
async function addCourse(courseNumber) {
  await userEvent.click(
    screen.getByTestId("TestApplicationPage-coursework-add-button"),
  );
  await userEvent.type(
    screen.getByTestId("TestApplicationPage-coursework-modal-courseNumber"),
    courseNumber,
  );
  await userEvent.click(
    screen.getByTestId("TestApplicationPage-coursework-modal-save"),
  );
  await waitFor(() =>
    expect(
      screen.queryByTestId("TestApplicationPage-coursework-modal"),
    ).toBeNull(),
  );
}

describe("TestApplicationPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock.onGet("/api/currentUser").reply(200, {
      ...apiCurrentUserFixtures.adminUser,
      user: {
        ...apiCurrentUserFixtures.adminUser.user,
        givenName: "Ada",
        familyName: "Admin",
      },
    });
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/admin/recruitments/all")
      .reply(200, recruitmentsFixtures.threeRecruitments);
    axiosMock
      .onGet("/api/recruitmentcourses/all")
      .reply(200, recruitmentCoursesFixtures.fourCourses);
    axiosMock.onGet("/api/applications/mine").reply(200, []);
    axiosMock
      .onGet("/api/recruitments/options")
      .reply(200, appSettingsFixtures.taOptions);
    axiosMock.onGet("/api/notices/current").reply(200, []);
  });

  test("shows the current notice for the recruitment's type, as applicants see it", async () => {
    axiosMock.onGet("/api/notices/current").reply(200, [noticesFixtures.taV2]);
    renderPage();

    expect(
      await screen.findByTestId("TestApplicationPage-notice-agree"),
    ).not.toBeChecked();
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices/current")[0]
        .params,
    ).toEqual({ type: "TA" });
  });

  test("the form is fed the majors and topics for the recruitment", async () => {
    renderPage();

    const select = await screen.findByTestId("TestApplicationPage-major");
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toContain(
        "Statistics",
      ),
    );
    expect(
      screen.getByTestId("TestApplicationPage-topic-Compilers-1"),
    ).toBeInTheDocument();
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/options",
      )[0].params,
    ).toEqual({ recruitmentId: "3" });
  });

  test("shows the test-only banner below the navbar", async () => {
    renderPage();

    const banner = await screen.findByTestId("TestOnlyBanner");
    expect(banner).toHaveTextContent("This is a test only");
    const navbar = screen.getByText("TA Apply");
    expect(navbar.compareDocumentPosition(banner)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test("names the recruitment being tested", async () => {
    renderPage();

    expect(
      await screen.findByText("Test Application: TA positions, S26"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("TestApplicationPage-explanation"),
    ).toHaveTextContent("saved as a test application");
  });

  /** The same form an applicant gets, driven by the recruitment's type. */
  test("shows the form for the recruitment's type", async () => {
    renderPage();

    expect(
      await screen.findByTestId("TestApplicationPage-residencyStatus"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("TestApplicationPage-videoLink")).toBeNull();

    expect(screen.getByTestId("TestApplicationPage-submit")).toHaveTextContent(
      "Submit Test Application",
    );
  });

  test("a ULA recruitment shows the ULA form", async () => {
    renderPage(openUla.id);

    expect(
      await screen.findByTestId("TestApplicationPage-videoLink"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("TestApplicationPage-residencyStatus"),
    ).toBeNull();
  });

  /** The admin endpoint returns one row per lecture; the dropdown wants each course once. */
  test("the course dropdown lists each of the recruitment's courses once, sorted", async () => {
    renderPage();

    const select = await screen.findByTestId(
      "TestApplicationPage-firstChoiceCourse",
    );
    // fourCourses has CMPSC 156 twice (two lectures) and is not in sorted order.
    await waitFor(() =>
      expect([...select.options].map((o) => o.value)).toEqual([
        "",
        "CMPSC     1A",
        "CMPSC   156",
        "CMPSC   165A",
      ]),
    );
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitmentcourses/all",
      )[0].params,
    ).toEqual({ recruitmentId: "3" });
  });

  test("the names come from the admin's Google account", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("TestApplicationPage-firstName")).toHaveValue(
        "Ada",
      ),
    );
    expect(screen.getByTestId("TestApplicationPage-lastName")).toHaveValue(
      "Admin",
    );
  });

  test("an unknown recruitment offers no form", async () => {
    renderPage(99);

    expect(
      await screen.findByTestId("TestApplicationPage-unavailable"),
    ).toHaveTextContent("There is no recruitment with id 99.");
    expect(screen.queryByTestId("TestApplicationPage-submit")).toBeNull();
    // The banner is still there: this whole page is the test area.
    expect(screen.getByTestId("TestOnlyBanner")).toBeInTheDocument();
  });

  test("submitting posts a test application for the recruitment", async () => {
    axiosMock
      .onPost("/api/applications/test")
      .reply(200, applicationsFixtures.oneTestApplication);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("TestApplicationPage-firstName")).toHaveValue(
        "Ada",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("TestApplicationPage-firstChoiceCourse").options
          .length,
      ).toBe(4),
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("TestApplicationPage-major").options.length,
      ).toBe(5),
    );
    await userEvent.selectOptions(
      screen.getByTestId("TestApplicationPage-major"),
      "Computer Science",
    );
    await userEvent.selectOptions(
      screen.getByTestId("TestApplicationPage-firstChoiceCourse"),
      "CMPSC   156",
    );
    for (const number of ["CMPSC 8", "CMPSC 16", "CMPSC 24"]) {
      await addCourse(number);
    }
    await userEvent.click(screen.getByTestId("TestApplicationPage-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].url).toBe("/api/applications/test");
    expect(axiosMock.history.post[0].params).toEqual({ recruitmentId: "3" });

    const sent = JSON.parse(axiosMock.history.post[0].data);
    expect(sent.firstName).toBe("Ada");
    expect(sent.firstChoiceCourse).toBe("CMPSC   156");
    // The flag is the backend's to set, not the form's.
    expect(sent.testApplication).toBeUndefined();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Test application saved. It is flagged as a test, not a real one.",
      ),
    );
  });

  /** After a submission the saved answers are shown back, so the admin can check what landed. */
  test("shows the saved test application for this recruitment", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, applicationsFixtures.threeApplicationsIncludingATest);

    renderPage();

    expect(
      await screen.findByTestId("TestApplicationPage-saved"),
    ).toHaveTextContent("Your saved test application");
    expect(screen.getByText("Just checking the form.")).toBeInTheDocument();
  });

  /** A real application by the same admin to this recruitment is not a test and is not shown. */
  test("does not show a real application as the saved test", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [
        { ...applicationsFixtures.oneTestApplication, testApplication: false },
      ]);

    renderPage();

    await screen.findByTestId("TestApplicationPage-firstName");
    expect(screen.queryByTestId("TestApplicationPage-saved")).toBeNull();
  });

  test("a test application for another recruitment is not shown", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [
        { ...applicationsFixtures.oneTestApplication, recruitmentId: 2 },
      ]);

    renderPage();

    await screen.findByTestId("TestApplicationPage-firstName");
    expect(screen.queryByTestId("TestApplicationPage-saved")).toBeNull();
  });
});
