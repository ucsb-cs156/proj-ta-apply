import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { vi } from "vitest";

import CourseSectionsCard from "main/components/Applications/CourseSectionsCard";
import courseSectionsFixtures from "fixtures/courseSectionsFixtures";
import mockConsole from "tests/testutils/mockConsole";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

const axiosMock = new AxiosMockAdapter(axios);

function renderCard(props = {}) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CourseSectionsCard
        recruitmentId={2}
        courseId="CMPSC   156"
        testIdPrefix="Card"
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("CourseSectionsCard tests", () => {
  beforeEach(() => {
    mockToast.mockClear();
    axiosMock.reset();
    axiosMock.resetHistory();
  });

  test("asks the backend about the chosen course in the chosen recruitment", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);

    renderCard();

    await screen.findByTestId("Card-row-0");
    const request = axiosMock.history.get.find(
      (r) => r.url === "/api/recruitments/sections",
    );
    expect(request.params).toEqual({
      recruitmentId: 2,
      courseId: "CMPSC   156",
    });
  });

  test("lists every meeting with its type, days, time, place and instructor", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);

    renderCard();

    expect(await screen.findByTestId("Card-row-0-section")).toHaveTextContent(
      "0100",
    );
    expect(screen.getByTestId("Card-title")).toHaveTextContent(
      "Lecture and section times for CMPSC 156: ADV APP PROGRAM",
    );
    expect(screen.getByTestId("Card-row-0-type")).toHaveTextContent("Lecture");
    expect(screen.getByTestId("Card-row-0-days")).toHaveTextContent("T R");
    expect(screen.getByTestId("Card-row-0-time")).toHaveTextContent(
      "14:00 - 15:15",
    );
    expect(screen.getByTestId("Card-row-0-location")).toHaveTextContent(
      "PHELP 3526",
    );
    expect(screen.getByTestId("Card-row-0-instructors")).toHaveTextContent(
      "CONRAD P",
    );
    expect(screen.getByTestId("Card-row-1-section")).toHaveTextContent("0101");
    expect(screen.getByTestId("Card-row-1-type")).toHaveTextContent("Section");
    expect(screen.getByTestId("Card-row-2-section")).toHaveTextContent("0102");
    expect(screen.queryByTestId("Card-row-3")).toBeNull();
    ["Section", "Type", "Days", "Time", "Location", "Instructor"].forEach(
      (heading) =>
        expect(
          screen.getByRole("columnheader", { name: heading }),
        ).toBeInTheDocument(),
    );
  });

  test("the course id in the title keeps its padding", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);

    renderCard();

    const title = await screen.findByTestId("Card-title");
    const courseId = title.querySelector("span");
    expect(courseId.textContent).toBe("CMPSC   156");
    expect(courseId).toHaveStyle({
      fontFamily: "monospace",
      whiteSpace: "pre",
    });
  });

  /** An online section has no time or place, but the row should still be there. */
  test("a section with no scheduled time shows blank time columns", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.online);

    renderCard({ courseId: "CMPSC     8" });

    expect(await screen.findByTestId("Card-row-0-section")).toHaveTextContent(
      "0100",
    );
    expect(screen.getByTestId("Card-row-0-days").textContent).toBe("");
    expect(screen.getByTestId("Card-row-0-time").textContent).toBe("");
    expect(screen.getByTestId("Card-row-0-location").textContent).toBe("");
    expect(screen.getByTestId("Card-row-0-instructors").textContent).toBe("");
  });

  test("says so when nothing is known about the course", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.none);

    renderCard({ courseId: "CMPSC   130A" });

    expect(await screen.findByTestId("Card-none")).toHaveTextContent(
      "No lecture or section times are available for this course.",
    );
    // No title to add after the course id.
    expect(screen.getByTestId("Card-title")).toHaveTextContent(
      "Lecture and section times for CMPSC 130A",
    );
    expect(screen.getByTestId("Card-title").textContent).not.toContain(":");
    expect(screen.queryByTestId("Card-row-0")).toBeNull();
  });

  test("shows that it is looking the times up until they arrive", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve([200, courseSectionsFixtures.cmpsc156]),
              50,
            ),
          ),
      );

    renderCard();

    expect(screen.getByTestId("Card-loading")).toHaveTextContent(
      "Looking up lecture and section times…",
    );
    expect(await screen.findByTestId("Card-row-0")).toBeInTheDocument();
    expect(screen.queryByTestId("Card-loading")).toBeNull();
  });

  /** The UCSB API being down should not make the form unusable. */
  test("explains when the lookup fails", async () => {
    const restoreConsole = mockConsole();
    axiosMock.onGet("/api/recruitments/sections").reply(500, {});

    renderCard();

    expect(await screen.findByTestId("Card-error")).toHaveTextContent(
      "The lecture and section times could not be looked up right now.",
    );
    expect(screen.queryByTestId("Card-loading")).toBeNull();
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Error communicating with backend via GET on /api/recruitments/sections",
      ),
    );
    restoreConsole();
  });

  test("can be hidden and shown again", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);

    renderCard();

    await screen.findByTestId("Card-row-0");
    const toggle = screen.getByTestId("Card-toggle");
    expect(toggle).toHaveTextContent("Hide");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(toggle);
    expect(screen.queryByTestId("Card-body")).toBeNull();
    expect(screen.queryByTestId("Card-row-0")).toBeNull();
    expect(toggle).toHaveTextContent("Show");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // The header, with the course named, stays so it is clear what was folded away.
    expect(screen.getByTestId("Card-title")).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByTestId("Card-row-0")).toBeInTheDocument();
    expect(toggle).toHaveTextContent("Hide");
  });

  test("the test id prefix has a default", async () => {
    axiosMock
      .onGet("/api/recruitments/sections")
      .reply(200, courseSectionsFixtures.cmpsc156);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <CourseSectionsCard recruitmentId={2} courseId="CMPSC   156" />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByTestId("CourseSectionsCard-row-0"),
    ).toBeInTheDocument();
  });
});
