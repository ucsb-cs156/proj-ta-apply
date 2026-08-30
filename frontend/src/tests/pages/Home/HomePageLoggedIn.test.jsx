import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import HomePageLoggedIn from "main/pages/Home/HomePageLoggedIn";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";
import projectsFixtures from "fixtures/projectsFixtures";
import { vi } from "vitest";
import * as useBackendModule from "main/utils/useBackend";

const axiosMock = new AxiosMockAdapter(axios);
const queryClient = new QueryClient();

const useBackendSpy = vi.spyOn(useBackendModule, "useBackend");
const useBackendMutationSpy = vi.spyOn(useBackendModule, "useBackendMutation");

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

function renderHome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HomePageLoggedIn />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePageLoggedIn tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock.resetHistory();
    queryClient.clear();
    mockToast.mockReset();
    axiosMock.onGet("/api/projects/list/owner").reply(200, []);
    axiosMock.onGet("/api/projects/list/collaborator").reply(200, []);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });
  afterEach(() => {
    useBackendSpy.mockClear();
    useBackendMutationSpy.mockClear();
  });

  test("regular user sees only the collaborator section, and it fetches on mount", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByText("Projects You Collaborate On"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Your Projects")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Project")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("HomePageLoggedIn-no-collaborator-projects"),
    ).toBeInTheDocument();
  });

  test("regular user sees projects they collaborate on", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);
    axiosMock
      .onGet("/api/projects/list/collaborator")
      .reply(200, projectsFixtures.threeProjects);

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByTestId("CollaboratorProjectTable-cell-row-0-col-id"),
      ).toHaveTextContent("1");
    });
    expect(
      screen.queryByTestId("HomePageLoggedIn-no-collaborator-projects"),
    ).not.toBeInTheDocument();
  });

  test("instructor sees both sections, with owned projects empty message", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("Your Projects")).toBeInTheDocument();
    });
    expect(screen.getByText("Projects You Collaborate On")).toBeInTheDocument();
    expect(screen.getByText("Create Project")).toBeInTheDocument();
    expect(
      screen.getByTestId("HomePageLoggedIn-no-owned-projects"),
    ).toBeInTheDocument();
  });

  test("instructor sees their owned projects when there are some", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);
    axiosMock
      .onGet("/api/projects/list/owner")
      .reply(200, projectsFixtures.threeProjects);

    renderHome();

    await waitFor(() => {
      expect(
        screen.getByTestId("OwnerProjectTable-cell-row-0-col-id"),
      ).toHaveTextContent("1");
    });
    expect(
      screen.queryByTestId("HomePageLoggedIn-no-owned-projects"),
    ).not.toBeInTheDocument();
  });

  test("instructor can create a new project", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);
    axiosMock
      .onPost("/api/projects/post")
      .reply(200, projectsFixtures.oneProject);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("Create Project")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create Project"));

    await screen.findByTestId("ProjectModal-name");
    fireEvent.change(screen.getByTestId("ProjectModal-name"), {
      target: { value: "Citation Graphs" },
    });
    fireEvent.change(screen.getByTestId("ProjectModal-description"), {
      target: { value: "A project about citation graphs" },
    });
    fireEvent.click(screen.getByTestId("ProjectModal-submit"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].params).toEqual({
      name: "Citation Graphs",
      description: "A project about citation graphs",
      citationFormat: "ACM",
    });
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("Project Citation Graphs created"),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("ProjectModal-base")).not.toBeInTheDocument(),
    );
  });

  test("useBackend is called with correct cache query keys, owner list disabled for regular users", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.userOnly);

    renderHome();

    await waitFor(() => expect(useBackendSpy).toHaveBeenCalled());

    expect(useBackendSpy).toHaveBeenCalledWith(
      ["/api/projects/list/owner"],
      { method: "GET", url: "/api/projects/list/owner" },
      [],
      false,
      { enabled: false },
    );

    expect(useBackendSpy).toHaveBeenCalledWith(
      ["/api/projects/list/collaborator"],
      { method: "GET", url: "/api/projects/list/collaborator" },
      [],
    );
  });

  test("useBackendMutation is called with correct cache query key", async () => {
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.instructorUser);

    renderHome();

    await waitFor(() => expect(useBackendMutationSpy).toHaveBeenCalled());

    expect(useBackendMutationSpy).toHaveBeenCalledWith(
      expect.any(Function),
      { onSuccess: expect.any(Function) },
      ["/api/projects/list/owner"],
    );
  });
});
