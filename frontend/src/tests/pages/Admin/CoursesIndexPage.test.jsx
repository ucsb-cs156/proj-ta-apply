import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import CoursesIndexPage from "main/pages/Admin/CoursesIndexPage";
import coursesFixtures from "fixtures/coursesFixtures";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    toast: (x) => mockToast(x),
  };
});

const axiosMock = new AxiosMockAdapter(axios);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CoursesIndexPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CoursesIndexPage tests", () => {
  beforeEach(() => {
    localStorage.clear();
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
    axiosMock
      .onGet("/api/courses/all")
      .reply(200, coursesFixtures.threeCourses);
    axiosMock
      .onPost("/api/jobs/launch/populateCourses")
      .reply(200, { id: 1, status: "running" });
  });

  test("renders the heading, the configured subject area, and the courses", async () => {
    renderPage();

    expect(await screen.findByText("Courses")).toBeInTheDocument();
    // Subject area comes from systemInfo, not a hardcoded literal.
    expect(await screen.findByText("CMPSC")).toBeInTheDocument();
    expect(
      await screen.findByTestId("CoursesIndexPage-cell-row-0-col-courseId"),
    ).toHaveTextContent("CMPSC 130A");
  });

  test("renders the two quarter dropdowns and the level dropdown", async () => {
    renderPage();

    expect(
      await screen.findByTestId("CoursesIndexPage.StartQuarter"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("CoursesIndexPage.EndQuarter"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Course Level")).toBeInTheDocument();
  });

  test("Populate posts the selected range and level", async () => {
    renderPage();
    await screen.findByTestId("CoursesIndexPage-populate");

    await userEvent.selectOptions(
      screen.getByTestId("CoursesIndexPage.StartQuarter"),
      "20212",
    );
    await userEvent.selectOptions(
      screen.getByTestId("CoursesIndexPage.EndQuarter"),
      "20214",
    );
    await userEvent.selectOptions(screen.getByLabelText("Course Level"), "G");

    await userEvent.click(screen.getByTestId("CoursesIndexPage-populate"));

    await waitFor(() => expect(axiosMock.history.post.length).toBe(1));
    expect(axiosMock.history.post[0].params).toEqual({
      startQuarter: "20212",
      endQuarter: "20214",
      level: "G",
    });
  });

  test("a successful Populate points the admin at the Jobs page", async () => {
    renderPage();
    await screen.findByTestId("CoursesIndexPage-populate");

    await userEvent.click(screen.getByTestId("CoursesIndexPage-populate"));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(/Populate job started/);
    expect(mockToast.mock.calls[0][0]).toMatch(/Jobs/);
  });

  test("a backwards range is rejected client-side and posts nothing", async () => {
    renderPage();
    await screen.findByTestId("CoursesIndexPage-populate");

    await userEvent.selectOptions(
      screen.getByTestId("CoursesIndexPage.StartQuarter"),
      "20214",
    );
    await userEvent.selectOptions(
      screen.getByTestId("CoursesIndexPage.EndQuarter"),
      "20211",
    );

    await userEvent.click(screen.getByTestId("CoursesIndexPage-populate"));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(mockToast.mock.calls[0][0]).toMatch(
      /Start quarter must not be after end quarter/,
    );
    expect(axiosMock.history.post.length).toBe(0);
  });

  test("falls back to defaults when systemInfo has no quarter bounds", async () => {
    axiosMock.onGet("/api/systemInfo").reply(200, {
      springH2ConsoleEnabled: false,
      showSwaggerUILink: false,
      oauthLogin: "/oauth2/authorization/google",
      sourceRepo: "",
    });

    renderPage();

    // The default subject area label still renders rather than the page crashing.
    expect(await screen.findByText("CMPSC")).toBeInTheDocument();
    expect(
      screen.getByTestId("CoursesIndexPage.StartQuarter"),
    ).toBeInTheDocument();
  });
});
