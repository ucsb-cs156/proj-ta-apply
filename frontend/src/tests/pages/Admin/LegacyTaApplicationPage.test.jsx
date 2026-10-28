import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";

import LegacyTaApplicationPage from "main/pages/Admin/LegacyTaApplicationPage";
import { LEGACY_BANNER_TEXT, LEGACY_FORM_URL } from "main/utils/legacyForm";
import { apiCurrentUserFixtures } from "fixtures/currentUserFixtures";
import { systemInfoFixtures } from "fixtures/systemInfoFixtures";

const axiosMock = new AxiosMockAdapter(axios);

/** A cut-down copy of docs/legacy/legacy-ta-application-form.html with the parts the page handles. */
const legacyHtml =
  "<!doctype html><html lang='en'><head><title>Legacy TA Application Form</title>" +
  "<style>:root{--ink:#1d1d22}body{background:#6b6b70}" +
  ".hidefn .fn,.hidefn .note{display:none}</style></head>" +
  "<body><div class='wrap'><section class='about'>" +
  "<div class='toggle'><input type='checkbox' id='shownotes' checked>" +
  "<label for='shownotes'>Show field names and reconstruction notes</label></div>" +
  "</section><div id='content'><h1>CS TA/Reader Application Form</h1>" +
  "<span class='fn'>first_name</span></div></div>" +
  "<script>document.getElementById('shownotes')</script></body></html>";

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
    axiosMock.onGet(LEGACY_FORM_URL).reply(200, legacyHtml);
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

  /** No iframe: X-Frame-Options: DENY on the deployed app blocked it (#44). */
  test("fetches the one copy of the file from /legacy and renders its body in the page", async () => {
    renderPage();

    expect(
      screen.getByTestId("LegacyTaApplicationPage-loading"),
    ).toHaveTextContent("Loading the legacy form…");

    const form = await screen.findByTestId("LegacyTaApplicationPage-form");
    expect(
      axiosMock.history.get.filter((r) => r.url === LEGACY_FORM_URL),
    ).toHaveLength(1);
    expect(
      axiosMock.history.get.filter(
        (r) => r.url === "/legacy/legacy-ta-application-form.html",
      ),
    ).toHaveLength(1);

    expect(form).toHaveClass("legacy-form");
    expect(form).not.toHaveClass("hidefn");
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "CS TA/Reader Application Form",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("first_name")).toHaveClass("fn");
    // The document's own script is dropped, not run.
    expect(form.querySelector("script")).toBeNull();
    expect(document.title).not.toBe("changed");
    expect(document.querySelector("iframe")).toBeNull();
    expect(
      screen.queryByTestId("LegacyTaApplicationPage-loading"),
    ).not.toBeInTheDocument();
  });

  test("the legacy stylesheet is rendered scoped to the form's container", async () => {
    renderPage();

    const style = await screen.findByTestId("LegacyTaApplicationPage-style");
    expect(style.tagName).toBe("STYLE");
    expect(style.textContent).toBe(
      ".legacy-form{\n&{--ink:#1d1d22}&{background:#6b6b70}" +
        "&.hidefn .fn,&.hidefn .note{display:none}\n}",
    );
    expect(style.textContent).not.toContain(":root");
    expect(style.textContent).not.toContain("body");
  });

  test("the notes checkbox in the legacy form hides and shows the notes", async () => {
    renderPage();

    const form = await screen.findByTestId("LegacyTaApplicationPage-form");
    const toggle = screen.getByLabelText(
      "Show field names and reconstruction notes",
    );
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    await waitFor(() => expect(form).toHaveClass("legacy-form", "hidefn"));

    fireEvent.click(toggle);
    await waitFor(() => expect(form).not.toHaveClass("hidefn"));
    expect(form).toHaveClass("legacy-form");
  });

  test("a change elsewhere in the legacy form does not touch the notes", async () => {
    axiosMock
      .onGet(LEGACY_FORM_URL)
      .reply(
        200,
        legacyHtml.replace(
          "<span class='fn'>",
          "<input type='checkbox' id='other' checked><span class='fn'>",
        ),
      );
    renderPage();

    const form = await screen.findByTestId("LegacyTaApplicationPage-form");
    fireEvent.click(form.querySelector("#other"));

    expect(form.querySelector("#other")).not.toBeChecked();
    expect(form).not.toHaveClass("hidefn");
  });
});
