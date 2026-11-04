import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplyPage from "main/pages/Applications/ApplyPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import draftApplicationsFixtures from "fixtures/draftApplicationsFixtures";
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
const { emptyUlaDraft, savedUlaDraft } = draftApplicationsFixtures;

/** The submissions of the application itself, apart from the draft calls beside them. */
const submissions = () =>
  axiosMock.history.post.filter((r) => r.url === "/api/applications/post");
/** The saves of the draft. */
const draftSaves = () =>
  axiosMock.history.put.filter((r) => r.url === "/api/draftApplications");
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
  // Every ULA applicant confirms the I-9 appointment (issue #213).
  await userEvent.click(screen.getByTestId("ApplyPage-i9Appointment"));
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
    axiosMock.onGet("/api/courses/all").reply(200, []);
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);
    axiosMock
      .onGet("/api/recruitments/options")
      .reply(200, appSettingsFixtures.ulaOptions);
    axiosMock.onGet("/api/applications/prefill").reply(200, []);
    // Opening the form starts a draft, and what is typed is saved to it (issue #270).
    axiosMock.onPost("/api/draftApplications/open").reply(200, emptyUlaDraft);
    axiosMock.onPut("/api/draftApplications").reply(200, savedUlaDraft);
    // No application yet for this recruitment, so the form is offered.
    axiosMock.onGet("/api/applications/mine").reply(200, []);
    // No notice written yet for most tests, so the form asks for no agreement.
    axiosMock.onGet("/api/notices/current").reply(200, []);
  });

  /** The notice shown is the current one for the recruitment's type, and must be agreed to. */
  /** Issue #153: the quarter calendar's fields, from /api/quarters/one for the recruitment's quarter. */
  test("fills a quarter calendar field from the quarter on file, and leaves it when none is", async () => {
    axiosMock.onGet("/api/notices/current").reply(200, [
      {
        ...noticesFixtures.ulaV1,
        content: "Classes begin ${firstDayOfClasses} in ${name}.",
      },
    ]);
    axiosMock
      .onGet("/api/quarters/one", { params: { yyyyq: "20261" } })
      .reply(200, {
        quarter: "20261",
        qyy: "W26",
        name: "WINTER 2026",
        firstDayOfClasses: "2026-01-05T00:00:00",
      });
    renderPage();
    const filled = await screen.findByTestId("ApplyPage-notice-content");
    await waitFor(() =>
      expect(filled).toHaveTextContent(
        "Classes begin January 5, 2026 in WINTER 2026.",
      ),
    );
    expect(
      axiosMock.history.get.filter((r) => r.url === "/api/quarters/one")[0]
        .params,
    ).toEqual({ yyyyq: "20261" });
  });

  test("a quarter not on file leaves the calendar fields as written, quietly", async () => {
    axiosMock.onGet("/api/notices/current").reply(200, [
      {
        ...noticesFixtures.ulaV1,
        content: "Classes begin ${firstDayOfClasses} in ${name}.",
      },
    ]);
    axiosMock.onGet("/api/quarters/one").reply(404, { message: "not on file" });
    renderPage();
    const content = await screen.findByTestId("ApplyPage-notice-content");
    await waitFor(() =>
      expect(
        axiosMock.history.get.filter((r) => r.url === "/api/quarters/one"),
      ).toHaveLength(1),
    );
    expect(content).toHaveTextContent(
      "Classes begin ${firstDayOfClasses} in ${name}.",
    );
  });

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
    expect(submissions().length).toBe(0);

    await userEvent.click(box);
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));
    await waitFor(() => expect(submissions().length).toBe(1));
    expect(JSON.parse(submissions()[0].data).noticeVersionId).toBe(3);
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

  /**
   * Issue #307: which earlier application seeds a TA form depends on the form's type, which the
   * server is told; and the form is not shown until the answer is in, since it reads its starting
   * answers only once.
   */
  test("asks for the pre-fill for the recruitment's type, and fills the form from the answer", async () => {
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [{ ...openUla, type: "TA" }]);
    axiosMock
      .onGet("/api/applications/prefill")
      .reply(200, [{ firstName: "Seeded", major: "Computer Science" }]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Seeded"),
    );
    const requests = axiosMock.history.get.filter(
      (r) => r.url === "/api/applications/prefill",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0].params).toEqual({ type: "TA" });
  });

  test("a seeded form keeps the choices, course interests and topic ratings that this recruitment also has", async () => {
    axiosMock
      .onGet("/api/recruitments/applicable")
      .reply(200, [{ ...openUla, type: "TA" }]);
    axiosMock.onGet("/api/applications/prefill").reply(200, [
      {
        firstName: "Seeded",
        firstChoiceCourse: "CMPSC     8",
        secondChoiceCourse: "CMPSC    24",
        courseInterests: {
          "CMPSC   156": "ENTHUSIASTIC",
          "CMPSC    24": "WOULD_CONSIDER",
        },
        topicProficiencies: { JavaScript: 5, Python: 3 },
      },
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Seeded"),
    );
    expect(screen.getByTestId("ApplyPage-firstChoiceCourse")).toHaveValue(
      "CMPSC     8",
    );
    expect(screen.getByTestId("ApplyPage-secondChoiceCourse")).toHaveValue("");
    expect(
      screen.getByTestId("ApplyPage-courseInterest-CMPSC-156-ENTHUSIASTIC"),
    ).toBeChecked();
    expect(screen.getByTestId("ApplyPage-topic-JavaScript-5")).toBeChecked();
  });

  test("a pre-fill that cannot be fetched is reported, and the form is still offered", async () => {
    axiosMock.onGet("/api/applications/prefill").reply(500);

    renderPage();

    expect(await screen.findByTestId("ApplyPage-submit")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/applications/prefill",
      ),
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

  // ---- starting again after a cancellation (issue #318) ----

  /** The cancelled application is kept; it does not stand in the way of a new one. */
  test("an applicant who cancelled is given an empty form, not sent to the cancelled application", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [applicationsFixtures.oneCancelledApplication]);
    // The most recent application would normally fill the form in.
    axiosMock
      .onGet("/api/applications/prefill")
      .reply(200, [applicationsFixtures.oneCancelledApplication]);

    renderPage(applicationsFixtures.oneCancelledApplication.recruitmentId);

    expect(await screen.findByTestId("ApplyPage-submit")).toBeInTheDocument();
    expect(screen.queryByTestId("redirected-to-application")).toBeNull();
    // Nothing from the earlier application: only what a first-time applicant gets, the Google name.
    expect(screen.getByTestId("ApplyPage-firstName")).not.toHaveValue("Chris");
    expect(screen.getByTestId("ApplyPage-major")).toHaveValue("");
    // A draft of its own is begun.
    await waitFor(() =>
      expect(
        axiosMock.history.post.filter(
          (r) => r.url === "/api/draftApplications/open",
        ).length,
      ).toBe(1),
    );
  });

  test("a draft saved while starting again is what comes back", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [applicationsFixtures.oneCancelledApplication]);
    axiosMock.onPost("/api/draftApplications/open").reply(200, savedUlaDraft);

    renderPage(applicationsFixtures.oneCancelledApplication.recruitmentId);

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Dana"),
    );
  });

  test("an applicant who cancelled and then applied again is sent to the new application", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [
        applicationsFixtures.oneUlaApplication,
        applicationsFixtures.oneCancelledApplication,
      ]);

    renderPage(applicationsFixtures.oneUlaApplication.recruitmentId);

    expect(
      await screen.findByTestId("redirected-to-application"),
    ).toBeInTheDocument();
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

    await waitFor(() => expect(submissions().length).toBe(1));
    expect(submissions()[0].params).toEqual({ recruitmentId: "2" });

    const sent = JSON.parse(submissions()[0].data);
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

    await waitFor(() => expect(submissions().length).toBe(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ---- drafts (issue #270) ----

  test("opening the form starts, or resumes, the draft for the recruitment", async () => {
    renderPage();

    expect(await screen.findByTestId("ApplyPage-submit")).toBeInTheDocument();
    const opens = axiosMock.history.post.filter(
      (r) => r.url === "/api/draftApplications/open",
    );
    expect(opens.length).toBe(1);
    expect(opens[0].params).toEqual({ recruitmentId: "2" });
    // Nothing was typed, so nothing is saved.
    expect(draftSaves().length).toBe(0);
  });

  test("there is no form until the draft is there to save into", async () => {
    let release;
    axiosMock.onPost("/api/draftApplications/open").reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([200, emptyUlaDraft]);
        }),
    );

    renderPage();

    await waitFor(() => expect(release).toBeDefined());
    expect(screen.queryByTestId("ApplyPage-submit")).toBeNull();
    // No conflict is announced just because there is no draft yet.
    expect(screen.queryByTestId("ApplyPage-conflict")).toBeNull();
    release();
    expect(await screen.findByTestId("ApplyPage-submit")).toBeInTheDocument();
  });

  test("the draft is not asked for again when the window regains focus", async () => {
    renderPage();
    await screen.findByTestId("ApplyPage-submit");
    const opens = () =>
      axiosMock.history.post.filter(
        (r) => r.url === "/api/draftApplications/open",
      ).length;
    expect(opens()).toBe(1);

    window.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(opens()).toBe(1);
  });

  test("an empty draft is filled in from the earlier application", async () => {
    axiosMock
      .onGet("/api/applications/prefill")
      .reply(200, [applicationsFixtures.oneUlaApplication]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Chris"),
    );
  });

  test("a draft the form saved earlier is what comes back, not the earlier application", async () => {
    axiosMock
      .onGet("/api/applications/prefill")
      .reply(200, [applicationsFixtures.oneUlaApplication]);
    axiosMock.onPost("/api/draftApplications/open").reply(200, savedUlaDraft);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Dana"),
    );
    expect(screen.getByTestId("ApplyPage-lastName")).toHaveValue("Draft");
    expect(screen.getByTestId("ApplyPage-gpaMajor")).toHaveValue(3.4);
    expect(screen.getByTestId("ApplyPage-comments")).toHaveValue(
      "Saved before I finished",
    );
  });

  test("an applicant who has already applied is not given a draft", async () => {
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [applicationsFixtures.oneUlaApplication]);

    renderPage(applicationsFixtures.oneUlaApplication.recruitmentId);

    expect(
      await screen.findByTestId("redirected-to-application"),
    ).toBeInTheDocument();
    expect(
      axiosMock.history.post.filter(
        (r) => r.url === "/api/draftApplications/open",
      ).length,
    ).toBe(0);
  });

  test("if the draft cannot be started the form says so", async () => {
    axiosMock
      .onPost("/api/draftApplications/open")
      .reply(400, { message: "Applications are not currently open" });

    renderPage();

    expect(
      await screen.findByTestId("ApplyPage-draft-failed"),
    ).toHaveTextContent("The application could not be started.");
    // And the failure is reported like any other failed request.
    expect(mockToast).toHaveBeenCalledWith(
      "Error communicating with backend via POST on /api/draftApplications/open",
    );
    expect(screen.queryByTestId("ApplyPage-submit")).toBeNull();
  });

  /** Typing is saved a few seconds later, not at every keystroke. */
  test("what is typed is saved to the draft every few seconds", async () => {
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fireEvent.change(comments, { target: { value: "Hello" } });
      fireEvent.change(comments, { target: { value: "Hello there" } });
      act(() => {
        vi.advanceTimersByTime(2900);
      });
      expect(draftSaves().length).toBe(0);
      // Typing on does not push the save back.
      fireEvent.change(comments, { target: { value: "Hello there, ULA" } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(draftSaves().length).toBe(1));
    expect(draftSaves()[0].params).toEqual({ id: 21, version: 0 });
    const sent = JSON.parse(draftSaves()[0].data);
    expect(sent.comments).toBe("Hello there, ULA");
    // Incomplete as it is, and not agreed to anything yet.
    expect(sent.gpaMajor).toBeNull();
    expect(sent.noticeVersionId).toBeNull();
    expect(mockToast).not.toHaveBeenCalled();
  });

  test("changing an answer and changing it back saves nothing", async () => {
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      fireEvent.change(comments, { target: { value: "Hello" } });
      fireEvent.change(comments, { target: { value: "" } });
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(draftSaves().length).toBe(0);
  });

  test("leaving the form saves what has not been saved yet", async () => {
    const { unmount } = renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    fireEvent.change(comments, { target: { value: "Before I go" } });
    expect(draftSaves().length).toBe(0);
    unmount();

    await waitFor(() => expect(draftSaves().length).toBe(1));
    expect(JSON.parse(draftSaves()[0].data).comments).toBe("Before I go");
  });

  test("a draft that could not be saved says so", async () => {
    axiosMock
      .onPut("/api/draftApplications")
      .reply(500, { message: "Something broke" });
    const { unmount } = renderPage();
    fireEvent.change(await screen.findByTestId("ApplyPage-comments"), {
      target: { value: "Hello" },
    });
    unmount();

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Your draft could not be saved: Something broke",
      ),
    );
  });

  test("a save refused because the session is gone is not toasted", async () => {
    axiosMock.onPut("/api/draftApplications").reply(403, { message: "No" });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { unmount } = renderPage();
    fireEvent.change(await screen.findByTestId("ApplyPage-comments"), {
      target: { value: "Hello" },
    });
    unmount();

    await waitFor(() => expect(draftSaves().length).toBe(1));
    expect(mockToast).not.toHaveBeenCalled();
    // Quiet, but not silent: it is logged.
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Backend request failed",
        expect.anything(),
      ),
    );
    consoleError.mockRestore();
  });

  test("Save Draft saves at once, says so, and returns home", async () => {
    renderPage();
    fireEvent.change(await screen.findByTestId("ApplyPage-comments"), {
      target: { value: "Half done" },
    });
    expect(screen.getByTestId("ApplyPage-saveDraft")).toHaveTextContent(
      "Save Draft",
    );

    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
    expect(draftSaves().length).toBe(1);
    expect(draftSaves()[0].params).toEqual({ id: 21, version: 0 });
    expect(JSON.parse(draftSaves()[0].data).comments).toBe("Half done");
    expect(mockToast).toHaveBeenCalledWith(
      "Your draft has been saved. It is not an application until you submit it.",
    );
    // Required answers are not asked for: nothing was submitted.
    expect(submissions().length).toBe(0);
    expect(screen.queryByTestId("ApplyPage-missing")).toBeNull();
  });

  test("Save Draft with nothing typed still saves, and leaving afterwards does not save again", async () => {
    const { unmount } = renderPage();

    await userEvent.click(await screen.findByTestId("ApplyPage-saveDraft"));
    await waitFor(() => expect(draftSaves().length).toBe(1));
    unmount();

    expect(draftSaves().length).toBe(1);
  });

  // ---- concurrent edits ----

  /** The server's answer to a refused save: the message and the draft as it now stands. */
  const theOtherTabsDraft = {
    ...savedUlaDraft,
    firstName: "Other",
    version: 7,
    comments: "Typed in the other tab",
  };
  const conflictBody = {
    message:
      "This draft was changed in another tab or window. Reload to see the latest version.",
    version: 7,
    draft: theOtherTabsDraft,
  };

  test("saves made one after the other, before the first is answered, go in order with the right versions", async () => {
    let answerFirst;
    let puts = 0;
    axiosMock.onPut("/api/draftApplications").reply(() => {
      puts += 1;
      if (puts === 1) {
        return new Promise((resolve) => {
          answerFirst = () => resolve([200, { ...savedUlaDraft, version: 1 }]);
        });
      }
      return [200, { ...savedUlaDraft, version: 2 }];
    });
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    // The first save goes when the form is left...
    fireEvent.change(comments, { target: { value: "one" } });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    await waitFor(() => expect(answerFirst).toBeDefined());
    // ...and a second change is saved by the button again before it is answered.
    fireEvent.change(comments, { target: { value: "two" } });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    expect(draftSaves().length).toBe(1);

    answerFirst();
    await waitFor(() => expect(draftSaves().length).toBe(2));
    expect(draftSaves().map((r) => r.params.version)).toEqual([0, 1]);
  });

  test("a stale autosave says the draft was changed elsewhere, and nothing more is saved", async () => {
    axiosMock.onPut("/api/draftApplications").reply(409, conflictBody);
    const { unmount } = renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    expect(screen.queryByTestId("ApplyPage-conflict")).toBeNull();
    fireEvent.change(comments, { target: { value: "mine" } });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));

    expect(await screen.findByTestId("ApplyPage-conflict")).toHaveTextContent(
      "This draft was changed in another tab or window. Reload to see the latest version.",
    );
    expect(screen.getByTestId("ApplyPage-conflict-reload")).toHaveTextContent(
      "Reload",
    );
    // Save Draft did not take the applicant home.
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(draftSaves().length).toBe(1);

    // Further typing, and leaving the form, send nothing to the draft.
    fireEvent.change(comments, { target: { value: "mine again" } });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(draftSaves().length).toBe(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("Reload fetches the draft as it now stands and refills the form from it", async () => {
    let puts = 0;
    axiosMock.onPut("/api/draftApplications").reply(() => {
      puts += 1;
      return puts === 1
        ? [409, conflictBody]
        : [200, { ...theOtherTabsDraft, version: 8 }];
    });
    let opens = 0;
    axiosMock.onPost("/api/draftApplications/open").reply(() => {
      opens += 1;
      return [200, opens === 1 ? emptyUlaDraft : theOtherTabsDraft];
    });
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");
    fireEvent.change(comments, { target: { value: "mine" } });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    await screen.findByTestId("ApplyPage-conflict");

    const lookups = (url) =>
      axiosMock.history.get.filter((r) => r.url === url).length;
    const coursesBefore = lookups("/api/recruitments/courses");
    await userEvent.click(screen.getByTestId("ApplyPage-conflict-reload"));

    // The form starts again from the other tab's draft, and the warning is gone.
    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("Other"),
    );
    expect(screen.getByTestId("ApplyPage-comments")).toHaveValue(
      "Typed in the other tab",
    );
    expect(screen.queryByTestId("ApplyPage-conflict")).toBeNull();
    expect(
      axiosMock.history.post.filter(
        (r) => r.url === "/api/draftApplications/open",
      ).length,
    ).toBe(2);
    // Only the draft was fetched again, not everything else on the page.
    expect(lookups("/api/recruitments/courses")).toBe(coursesBefore);

    // And saving works again, from the version that came back.
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    await waitFor(() => expect(draftSaves().length).toBe(2));
    expect(draftSaves()[1].params).toEqual({ id: 21, version: 7 });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
  });

  test("Reload also looks again for an application submitted elsewhere", async () => {
    axiosMock.onPut("/api/draftApplications").reply(409, conflictBody);
    renderPage();
    fireEvent.change(await screen.findByTestId("ApplyPage-comments"), {
      target: { value: "mine" },
    });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    await screen.findByTestId("ApplyPage-conflict");
    const lookups = () =>
      axiosMock.history.get.filter((r) => r.url === "/api/applications/mine")
        .length;
    const before = lookups();

    // The other tab submitted: the draft is gone and the application is on file.
    axiosMock
      .onGet("/api/applications/mine")
      .reply(200, [applicationsFixtures.oneUlaApplication]);
    axiosMock
      .onPost("/api/draftApplications/open")
      .reply(400, { message: "You already have an application" });
    await userEvent.click(screen.getByTestId("ApplyPage-conflict-reload"));

    expect(
      await screen.findByTestId("redirected-to-application"),
    ).toBeInTheDocument();
    expect(lookups()).toBeGreaterThan(before);
  });

  test("a save that fails for another reason is not taken for a conflict", async () => {
    axiosMock
      .onPut("/api/draftApplications")
      .reply(500, { message: "Something broke" });
    renderPage();
    fireEvent.change(await screen.findByTestId("ApplyPage-comments"), {
      target: { value: "mine" },
    });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Your draft could not be saved: Something broke",
      ),
    );
    expect(screen.queryByTestId("ApplyPage-conflict")).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("submitting does not save the draft again as the form is left", async () => {
    axiosMock
      .onPost("/api/applications/post")
      .reply(200, applicationsFixtures.oneUlaApplication);
    const { unmount } = renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toBeInTheDocument(),
    );
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
    await addCourse("ApplyPage", "CMPSC 16");
    await fillUlaRequired();
    // Whatever the timer has sent so far was sent while the draft still existed.
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
    const before = draftSaves().length;

    unmount();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(draftSaves().length).toBe(before);
  });

  // ---- the multi-tab warning (issue #273) ----

  /** The heartbeats this tab has sent. */
  const heartbeats = () =>
    axiosMock.history.post.filter((r) =>
      r.url.startsWith("/api/draftApplications/heartbeat"),
    );
  const HEARTBEAT = /\/api\/draftApplications\/heartbeat/;
  const ADMIN = "We recommend that only one admin edits this page at a time.";
  const RISK =
    "Please know that this is risky; we recommend closing all but one of these.";
  const phill = { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false };
  const me = { label: "me@example.org (Me)", samePerson: true };

  test("the heartbeat and the saves name this tab by the same identifier", async () => {
    renderPage();
    const comments = await screen.findByTestId("ApplyPage-comments");

    // A heartbeat goes as soon as the draft is open, for that draft.
    await waitFor(() => expect(heartbeats().length).toBe(1));
    expect(heartbeats()[0].url).toBe("/api/draftApplications/heartbeat?id=21");

    fireEvent.change(comments, { target: { value: "Hello" } });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));
    await waitFor(() => expect(draftSaves().length).toBe(1));

    const id = heartbeats()[0].headers["X-Client-Id"];
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(draftSaves()[0].headers["X-Client-Id"]).toBe(id);
  });

  test("no warning is shown when the server says no one else has the draft open", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [], heartbeatSeconds: 20 });
    renderPage();
    await screen.findByTestId("ApplyPage-comments");
    await waitFor(() => expect(heartbeats().length).toBe(1));

    expect(screen.queryByTestId("ApplyPage-multiple-tabs")).toBeNull();
  });

  test("no warning is shown if the heartbeat cannot be answered at all", async () => {
    // The default for these tests: nothing answers a heartbeat.
    renderPage();
    await screen.findByTestId("ApplyPage-comments");
    await waitFor(() => expect(heartbeats().length).toBe(1));

    expect(screen.queryByTestId("ApplyPage-multiple-tabs")).toBeNull();
  });

  test("the user's own other tab is announced as 'You are also editing...'", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me], heartbeatSeconds: 20 });
    renderPage();

    expect(
      await screen.findByTestId("ApplyPage-multiple-tabs"),
    ).toHaveTextContent(
      `You are also editing this application in another tab or window. ${RISK}`,
    );
    // It is advice: the form is still there to use.
    expect(screen.getByTestId("ApplyPage-comments")).toBeInTheDocument();
    expect(screen.getByTestId("ApplyPage-submit")).toBeInTheDocument();
  });

  test("another person is named", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me, phill], heartbeatSeconds: 20 });
    renderPage();

    expect(
      await screen.findByTestId("ApplyPage-multiple-tabs"),
    ).toHaveTextContent(
      `You and phtcon@ucsb.edu (Phill Conrad) are also editing this application in other windows or tabs. ${ADMIN}`,
    );
  });

  test("the warning goes when a later heartbeat says the others have gone", async () => {
    let beats = 0;
    axiosMock.onPost(HEARTBEAT).reply(() => {
      beats += 1;
      // The server asks for a heartbeat every twentieth of a second, to keep the test short.
      return [
        200,
        { others: beats === 1 ? [phill] : [], heartbeatSeconds: 0.05 },
      ];
    });
    renderPage();

    expect(
      await screen.findByTestId("ApplyPage-multiple-tabs"),
    ).toHaveTextContent(
      "phtcon@ucsb.edu (Phill Conrad) is also editing this application.",
    );
    await waitFor(() =>
      expect(screen.queryByTestId("ApplyPage-multiple-tabs")).toBeNull(),
    );
  });

  test("the warning does not take the place of the conflict message", async () => {
    axiosMock
      .onPost(HEARTBEAT)
      .reply(200, { others: [me], heartbeatSeconds: 20 });
    axiosMock.onPut("/api/draftApplications").reply(409, {
      message:
        "This draft was changed in another tab or window. Reload to see the latest version.",
      version: 7,
      draft: { ...savedUlaDraft, version: 7 },
    });
    renderPage();
    fireEvent.change(await screen.findByTestId("ApplyPage-comments"), {
      target: { value: "mine" },
    });
    await userEvent.click(screen.getByTestId("ApplyPage-saveDraft"));

    expect(await screen.findByTestId("ApplyPage-conflict")).toBeInTheDocument();
    expect(screen.getByTestId("ApplyPage-multiple-tabs")).toBeInTheDocument();
  });

  // ---- the modal for the newest tab, and the goodbye (issue #284) ----

  const MODAL = "ApplyPage-multiple-tabs-modal";

  test("the newest tab is asked what to do, and the banner is there too", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId(`${MODAL}-message`)).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this application open for editing. ${ADMIN}`,
    );
    // The banner of the tab that arrived later says "already" too.
    expect(screen.getByTestId("ApplyPage-multiple-tabs")).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) already has this application open for editing. ${ADMIN}`,
    );
  });

  test("an older tab has the banner alone, and is not interrupted", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: false,
      arrivedAtMillis: 1000,
    });
    renderPage();

    expect(
      await screen.findByTestId("ApplyPage-multiple-tabs"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("Continue anyway closes the modal, keeps the banner and lets the form be used", async () => {
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage();
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByTestId(`${MODAL}-continue`));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("ApplyPage-multiple-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("ApplyPage-comments")).toBeInTheDocument();
  });

  test("Leave this page says goodbye for this draft, naming this tab, and goes home", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    axiosMock.onPost(HEARTBEAT).reply(200, {
      others: [phill],
      heartbeatSeconds: 20,
      newest: true,
      arrivedAtMillis: 1000,
    });
    renderPage();
    await screen.findByRole("dialog");
    await waitFor(() => expect(heartbeats().length).toBe(1));

    fireEvent.click(screen.getByTestId(`${MODAL}-leave`));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/draftApplications/leave?id=21");
    expect(init.keepalive).toBe(true);
    expect(init.headers["X-Client-Id"]).toBe(
      heartbeats()[0].headers["X-Client-Id"],
    );
    expect(mockNavigate).toHaveBeenCalledWith("/");
    vi.unstubAllGlobals();
  });

  test("Wait covers the form until a later heartbeat says the others have gone", async () => {
    let beats = 0;
    axiosMock.onPost(HEARTBEAT).reply(() => {
      beats += 1;
      return [
        200,
        {
          others: beats <= 2 ? [phill] : [],
          heartbeatSeconds: 0.05,
          newest: true,
          arrivedAtMillis: 1000,
        },
      ];
    });
    renderPage();
    fireEvent.click(await screen.findByTestId(`${MODAL}-wait`));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByTestId("ApplyPage-multiple-tabs")).toBeNull();
  });

  test("leaving the page says goodbye even though no pagehide happened", async () => {
    const fetchMock = vi.fn().mockResolvedValue({});
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderPage();
    await waitFor(() => expect(heartbeats().length).toBe(1));

    unmount();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/draftApplications/leave?id=21",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    vi.unstubAllGlobals();
  });
});
