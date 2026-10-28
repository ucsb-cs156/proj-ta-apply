import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import LegacyTaApplicationPage from "main/pages/Admin/LegacyTaApplicationPage";
import {
  LEGACY_BANNER_TEXT,
  LEGACY_FORM_URL,
  fitFrameToContent,
} from "main/utils/legacyForm";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <LegacyTaApplicationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LegacyTaApplicationPage tests", () => {
  beforeEach(() => {
    axiosMock.reset();
    axiosMock
      .onGet("/api/currentUser")
      .reply(200, apiCurrentUserFixtures.adminUser);
    axiosMock
      .onGet("/api/systemInfo")
      .reply(200, systemInfoFixtures.showingNeither);
  });

  test("the banner is at the top and says exactly what the issue asks", () => {
    renderPage();

    const banner = screen.getByTestId("LegacyTaApplicationPage-banner");
    expect(banner).toHaveTextContent(
      "This page is not functional. It preserves the user interface of the old TA application so that it can be compared with the new application. Data entered on this page is not stored anywhere. This is for documentation purposes only.",
    );
    expect(banner).toHaveTextContent(LEGACY_BANNER_TEXT);
    expect(banner).toHaveClass("alert-warning", "fw-bold");

    // Above the heading and the form, directly under the navbar.
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Legacy TA Application",
    });
    expect(banner.compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen
        .getByTestId("BasicLayout-main-content")
        .compareDocumentPosition(banner),
    ).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY,
    );
  });

  /** The frame loads the one copy of the file, served from docs/legacy by the backend. */
  test("the legacy form is shown in a sandboxed frame loaded from /legacy", () => {
    renderPage();

    const frame = screen.getByTestId("LegacyTaApplicationPage-frame");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("title", "Legacy TA application form");
    expect(frame).toHaveAttribute(
      "src",
      "/legacy/legacy-ta-application-form.html",
    );
    expect(frame).toHaveAttribute("src", LEGACY_FORM_URL);
    expect(frame).toHaveAttribute("sandbox", "allow-same-origin allow-scripts");
    // jsdom does not resolve vh units, so read the declared values directly.
    expect(frame.style.width).toBe("100%");
    expect(frame.style.minHeight).toBe("80vh");
    expect(frame.style.borderStyle).toBe("none");
  });

  test("the frame grows to fit its document once it loads", () => {
    renderPage();
    const frame = screen.getByTestId("LegacyTaApplicationPage-frame");

    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      value: { documentElement: { scrollHeight: 2400 } },
    });
    fireEvent.load(frame);

    expect(frame.style.height).toBe("2416px");
  });

  test("the frame keeps its minimum height when the document is not measurable", () => {
    const frame = document.createElement("iframe");
    frame.style.height = "100px";

    // jsdom gives a frame no contentDocument until it is attached; neither case should throw.
    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      value: null,
    });
    fitFrameToContent(frame);
    expect(frame.style.height).toBe("100px");

    Object.defineProperty(frame, "contentDocument", {
      configurable: true,
      value: { documentElement: { scrollHeight: 0 } },
    });
    fitFrameToContent(frame);
    expect(frame.style.height).toBe("100px");
  });
});
