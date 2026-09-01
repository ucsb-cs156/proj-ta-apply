import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import ApplyPage from "main/pages/Applications/ApplyPage";
import applicationsFixtures from "fixtures/applicationsFixtures";
import recruitmentsFixtures from "fixtures/recruitmentsFixtures";
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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
    axiosMock.onGet("/api/applications/prefill").reply(200, []);
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

  test("a first-time applicant gets an empty form", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("ApplyPage-firstName")).toHaveValue("");
  });

  /** The backend refuses the wrong type anyway; this keeps the page from pretending otherwise. */
  test("a recruitment the user cannot apply to offers no form", async () => {
    renderPage(99);

    expect(
      await screen.findByTestId("ApplyPage-unavailable"),
    ).toHaveTextContent("That recruitment is not one you can apply to.");
    expect(screen.queryByTestId("ApplyPage-submit")).toBeNull();
  });

  test("submitting posts the application and returns home", async () => {
    axiosMock
      .onPost("/api/applications/post")
      .reply(200, applicationsFixtures.oneUlaApplication);

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("ApplyPage-firstName")).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByTestId("ApplyPage-firstName"), "Chris");
    await userEvent.type(screen.getByTestId("ApplyPage-lastName"), "Gaucho");
    await userEvent.type(
      screen.getByTestId("ApplyPage-major"),
      "Computer Science",
    );
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].url).toBe("/api/applications/post");
    expect(axiosMock.history.post[0].params).toEqual({ recruitmentId: "2" });

    const sent = JSON.parse(axiosMock.history.post[0].data);
    expect(sent.firstName).toBe("Chris");
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
    await userEvent.type(screen.getByTestId("ApplyPage-firstName"), "Chris");
    await userEvent.type(screen.getByTestId("ApplyPage-lastName"), "Gaucho");
    await userEvent.type(screen.getByTestId("ApplyPage-major"), "CS");
    await userEvent.selectOptions(
      screen.getByTestId("ApplyPage-firstChoiceCourse"),
      "CMPSC   156",
    );
    await userEvent.click(screen.getByTestId("ApplyPage-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
