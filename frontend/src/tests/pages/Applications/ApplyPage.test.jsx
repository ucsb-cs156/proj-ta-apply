import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplyPage from "main/pages/Applications/ApplyPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import courseInstructorsFixtures from "fixtures/courseInstructorsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
import appSettingsFixtures from "fixtures/appSettingsFixtures";
import noticesFixtures from "fixtures/noticesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
const mockNavigate = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}));

const axiosMock = new AxiosMockAdapter(axios);

const [, openUla] = recruitmentsFixtures.threeRecruitments;
const courses = ["CMPSC     8", "CMPSC   156"];

function renderPage(recruitmentId = 2) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`/apply/${recruitmentId}`]}>
        <Routes>
          <Route path="/apply/:recruitmentId" element={<ApplyPage />} />
          {/* Where an applicant who has already applied is sent (issue #102). */}
          <Route
            path="/applications/:id"
            element={<p data-testid="redirected-to-application" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Adds one UCSB course through the coursework modal; a ULA application needs at least one. */
async function addCourse(prefix, courseNumber) {
  await userEvent.click(screen.getByTestId(`${prefix}-coursework-add-button`));
  await userEvent.type(
    screen.getByTestId(`${prefix}-coursework-modal-courseNumber`),
    courseNumber,
  );
  await userEvent.click(screen.getByTestId(`${prefix}-coursework-modal-save`));
  await waitFor(() =>
    expect(screen.queryByTestId(`${prefix}-coursework-modal`)).toBeNull(),
  );
}

/** The ULA form's own required questions (issue #72). */
async function fillUlaRequired() {
  await userEvent.type(screen.getByTestId("ApplyPage-gpaMajor"), "3.9");
  await userEvent.type(screen.getByTestId("ApplyPage-gpaOverall"), "3.8");
  await userEvent.type(screen.getByTestId("ApplyPage-yearInProgram"), "2nd");
  await userEvent.type(screen.getByTestId("ApplyPage-graduationDate"), "S27");
  await userEvent.type(
    screen.getByTestId("ApplyPage-previousServiceAsUla"),
    "2",
  );
  await userEvent.type(screen.getByTestId("ApplyPage-permNumber"), "1234567");
  await userEvent.selectOptions(
    screen.getByTestId("ApplyPage-bsMsStudent"),
    "false",
  );
  await userEvent.selectOptions(
    screen.getByTestId("ApplyPage-otherCampusJob"),
    "NO",
  );
  await userEvent.selectOptions(
    screen.getByTestId("ApplyPage-priorUcsbEmployment"),
    "false",
  );
}

describe("ApplyPage tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    mockNavigate.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock.onGet("/api/recruitments/applicable").reply(200, [openUla]);
    axiosMock.onGet("/api/recruitments/courses").reply(200, courses);
    axiosMock
      .onGet("/api/recruitments/instructors")
      .reply(200, courseInstructorsFixtures.twoCourses);
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);
    axiosMock
      .onGet("/api/recruitments/options")
      .reply(200, appSettingsFixtures.ulaOptions);
    axiosMock.onGet("/api/applications/prefill").reply(200, []);
    // No application yet for this recruitment, so the form is offered.
    axiosMock.onGet("/api/applications/mine").reply(200, []);
    // No notice written yet for most tests, so the form asks for no agreement.
    axiosMock.onGet("/api/notices/current").reply(200, []);
  });

  /** The notice shown is the current one for the recruitment's type, and must be agreed to. */
  /** Issue #150: the notice's fields are filled from the recruitment being applied to. */
  test("fills the notice's quarter and date fields from the recruitment", async () => {
    axiosMock.onGet("/api/notices/current").reply(200, [
      {
        ...noticesFixtures.ulaV1,
        content: "Apply for ${quarter} by ${primaryConsiderationDate}.",
      },
    ]);
    renderPage();
    expect(
      await screen.findByTestId("ApplyPage-notice-content"),
    ).toHaveTextContent("Apply for Winter 2026 by January 20, 2026.");
  });

  test("shows the current notice for the recruitment's type and sends the agreed version", async () => {
    axiosMock.onGet("/api/notices/current").reply(200, [noticesFixtures.ulaV1]);
    axiosMock
      .onPost("/api/applications/post")
      .reply(200, applicationsFixtures.oneUlaApplication);

    renderPage();

    const box = await screen.findByTestId("ApplyPage-notice-agree");
    expect(
      screen.getByTestId("ApplyPage-notice-content").querySelector("h1"),
    ).toHaveTextContent("ULA Terms");
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/notices/current")[0]
        .params,
    ).toEqual({ type: "ULA" });

    await userEvent.clear(screen.getByTestId("ApplyPage-firstName"));
    await userEvent.type(screen.getByTestId("ApplyPage-firstName"), "Chris");
    await userEvent.clear(screen.getByTestId("ApplyPage-lastName"));
    await userEvent.type(screen.getByTestId("ApplyPage-lastName"), "Gaucho");
    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-major").options.length).toBe(4),
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-major"),
      "Computer Science",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-firstChoiceCourse"),
      "CMPSC   156",
    );

    // Unticked: refused in the browser, nothing sent.
    await addCourse("ApplyPage", "CMPSC 16");
    await fillUlaRequired();
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));
    await waitFor(() => expect(box).toHaveClass("is-invalid"));
    expect(axiosMock.history.post.length).toBe(0);

    await userEvent.click(box);
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));
    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(JSON.parse(axiosMock.history.post[0].data).noticeVersionId).toBe(3);
  });

  /** The majors and topics come from the lists for this recruitment's type. */
  test("the major dropdown and topic rows are fed from the recruitment's options", async () => {
    renderPage();

    const select = await screen.findByTestId("ApplyPage-major");
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toEqual([
        "Choose a major",
        "Computer Science",
        "Mathematics",
        "Other",
      ]),
    );
    expect(
      screen.getByTestId("ApplyPage-topic-JavaScript-1"),
    ).toBeInTheDocument();
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/options",
      )[0].params,
    ).toEqual({ recruitmentId: "2" });
  });

  test("names the recruitment being applied to", async () => {
    renderPage();

    expect(
      await screen.findByText("Apply: ULA positions, W26"),
    ).toBeInTheDocument();
  });

  test("shows the form for the recruitment's type", async () => {
    renderPage();

    expect(
      await screen.findByTestId("ApplyPage-previousServiceAsUla"),
    ).toBeInTheDocument();
    // ULA, so no residency question.
    expect(screen.queryByTestId("ApplyPage-residencyStatus")).toBeNull();
  });

  test("the course dropdown is fed from the recruitment's courses", async () => {
    renderPage();

    const select = await screen.findByTestId("ApplyPage-firstChoiceCourse");
    expect([...select.options].map((o) => o.value)).toEqual(["", ...courses]);
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/courses",
      )[0].params,
    ).toEqual({ recruitmentId: "2" });
  });

  /** Issue #121: the instructors come from the recruitment and follow the course number. */
  test("the course dropdown names each course's instructors", async () => {
    renderPage();

    const select = await screen.findByTestId("ApplyPage-firstChoiceCourse");
    await waitFor(() =>
      expect([...select.options].map((o) => o.textContent)).toEqual([
        "Choose a course",
        "CMPSC     8 (GAUCHO C)",
        "CMPSC   156 (CONRAD P)",
      ]),
    );
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/api/recruitments/instructors",
      )[0].params,
    ).toEqual({ recruitmentId: "2" });
  });

  test("choosing a course looks up its times in the recruitment being applied to", async () => {
    renderPage();

    await userEvent.selectOptions(
      await screen.findByTestId("ApplyPage-firstChoiceCourse"),
      "CMPSC   156",
    );

    expect(
      await screen.findByTestId("ApplyPage-firstChoiceSections-row-0-type"),
    ).toHaveTextContent("Lecture");
    const request = axiosMock.history.get.find(
      (r) => r.url === "/api/recruitments/sections",
    );
    expect(request.params).toEqual({
      recruitmentId: "2",
      courseId: "CMPSC   156",
    });
  });

  /** The point of pre-filling: a repeat applicant should not retype everything. */
  test("pre-fills from the applicant's most recent application", async () => {
    axiosMock
      .onGet("/api/applications/prefill")
      .reply(200, [applicationsFixtures.oneUlaApplication]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Chris"),
    );
    expect(screen.getByTestId("ApplyPage-major")).toHaveValue(
      "Computer Science",
    );
  });

  /** Nothing to copy from, so the names come from the signed-in Google account. */
  test("a first-time applicant gets their name from their Google account", async () => {
    axiosMock.onGet("/api/currentUser").reply(200, {
      ...apiCurrentUserFixtures.userOnly,
      user: {
        ...apiCurrentUserFixtures.userOnly.user,
        givenName: "Chris",
        familyName: "Gaucho",
      },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Chris"),
    );
    expect(screen.getByTestId("ApplyPage-lastName")).toHaveValue("Gaucho");
    // Nothing else is guessed at.
    expect(screen.getByTestId("ApplyPage-major")).toHaveValue("");
  });

  /** The backend refuses the wrong type anyway; this keeps the page from pretending otherwise. */
  test("a recruitment the user cannot apply to offers no form", async () => {
    renderPage(99);

    expect(
      await screen.findByTestId("ApplyPage-unavailable"),
    ).toHaveTextContent("That recruitment is not one you can apply to.");
    expect(screen.queryByTestId("ApplyPage-submit")).toBeNull();
  });

  /**
   * Issue #102: the browser's back button after submitting returns to this page, where the form
   * used to be offered again and the second submission refused with a 400. The applicant is sent
   * to their application instead.
   */
  test("an applicant who has already applied is sent to their application", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [applicationsFixtures.oneUlaApplication]);

    renderPage(applicationsFixtures.oneUlaApplication.recruitmentId);

    expect(
      await screen.findByTestId("redirected-to-application"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ApplyPage-submit")).toBeNull();
  });

  test("an application for a different recruitment does not redirect", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [
        { ...applicationsFixtures.oneUlaApplication, recruitmentId: 77 },
      ]);

    renderPage();

    expect(await screen.findByTestId("ApplyPage-submit")).toBeInTheDocument();
    expect(screen.queryByTestId("redirected-to-application")).toBeNull();
  });

  test("the form waits until the existing applications are known", async () => {
    let release;
    axiosMock.onGet("/api/applications/mine").reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, []]);
        }),
    );

    renderPage();

    // The heading is up, but no form until the list has arrived.
    expect(
      await screen.findByText("Apply: ULA positions, W26"),
    ).toBeInTheDocument();
    await waitFor(() => expect(release).toBeDefined());
    expect(screen.queryByTestId("ApplyPage-submit")).toBeNull();

    release();
    expect(await screen.findByTestId("ApplyPage-submit")).toBeInTheDocument();
  });

  test("submitting posts the application and returns home", async () => {
    axiosMock
      .onPost("/api/applications/post")
      .reply(200, applicationsFixtures.oneUlaApplication);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toBeInTheDocument(),
    );

    // The name fields start filled in from the Google account, so replace rather than append.
    await userEvent.clear(screen.getByTestId("ApplyPage-firstName"));
    await userEvent.type(screen.getByTestId("ApplyPage-firstName"), "Chris");
    await userEvent.clear(screen.getByTestId("ApplyPage-lastName"));
    await userEvent.type(screen.getByTestId("ApplyPage-lastName"), "Gaucho");
    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-major").options.length).toBe(4),
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-major"),
      "Computer Science",
    );
    // A ULA form rates topics 1 to 3 and asks about interests 1 to 5.
    await userEvent.click(screen.getByTestId("ApplyPage-topic-React-2"));
    await userEvent.click(screen.getByTestId("ApplyPage-interest-Tutoring-5"));
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-firstChoiceCourse"),
      "CMPSC   156",
    );
    await addCourse("ApplyPage", "CMPSC 16");
    await fillUlaRequired();
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].url).toBe("/api/applications/post");
    expect(axiosMock.history.post[0].params).toEqual({ recruitmentId: "2" });

    const sent = JSON.parse(axiosMock.history.post[0].data);
    expect(sent.firstName).toBe("Chris");
    expect(sent.major).toBe("Computer Science");
    expect(sent.topicProficiencies).toEqual({ React: 2 });
    expect(sent.interests).toEqual({ Tutoring: 5 });
    expect(sent.priorCoursework).toEqual([
      {
        ucsbCourse: true,
        otherSchool: null,
        courseNumber: "CMPSC 16",
        courseTitle: null,
        term: null,
        grade: null,
      },
    ]);
    expect(sent.firstChoiceCourse).toBe("CMPSC   156");
    // The applicant does not get to choose these.
    expect(sent.status).toBeUndefined();
    expect(sent.email).toBeUndefined();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Your application has been submitted.",
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  test("a refused application leaves the user on the page", async () => {
    axiosMock
      .onPost("/api/applications/post")
      .reply(400, { message: "You already have an application" });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toBeInTheDocument(),
    );
    await userEvent.clear(screen.getByTestId("ApplyPage-firstName"));
    await userEvent.type(screen.getByTestId("ApplyPage-firstName"), "Chris");
    await userEvent.clear(screen.getByTestId("ApplyPage-lastName"));
    await userEvent.type(screen.getByTestId("ApplyPage-lastName"), "Gaucho");
    // A major that is not on the list goes in as Other plus text.
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-major"),
      "Other",
    );
    await userEvent.type(screen.getByTestId("ApplyPage-otherMajor"), "CS");
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-firstChoiceCourse"),
      "CMPSC   156",
    );
    await addCourse("ApplyPage", "CMPSC 16");
    await fillUlaRequired();
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
