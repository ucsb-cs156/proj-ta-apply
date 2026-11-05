import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MemoryRouter } from "react-router";

import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import { noticesHelpPath } from "main/utils/notices";
import noticesFixtures from "fixtures/noticesFixtures";

describe("NoticeAgreement tests", () => {
  test("renders nothing at all without a notice", () => {
    const { container } = render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={null}
          agreed={false}
          onChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();

    const { container: c2 } = render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={undefined}
          agreed={false}
          onChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(c2).toBeEmptyDOMElement();
  });

  test("shows the text as rendered Markdown, the version, and the required box", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV2}
          agreed={false}
          onChange={vi.fn()}
          testIdPrefix="N"
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("N")).toHaveClass("card");
    expect(
      screen.getByRole("heading", { name: "Notices, Terms and Conditions" }),
    ).toBeInTheDocument();
    // Markdown became HTML: a heading, bold text and a list.
    const content = screen.getByTestId("N-content");
    expect(content.querySelector("h1")).toHaveTextContent("TA Terms");
    expect(content.querySelector("strong")).toHaveTextContent("whole");
    expect(content.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByTestId("N-version")).toHaveTextContent(
      `Version 2, saved 2/3/2026, 4:05:06 AM`,
    );

    const box = screen.getByTestId("N-agree");
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).not.toBeChecked();
    expect(box).toBeEnabled();
    expect(box).not.toHaveClass("is-invalid");
    const label = screen.getByText(
      /^I have read and understood the text above, and I agree to the terms and conditions it specifies/,
    );
    expect(label).toHaveAttribute("for", "N-agree");
    // Marked as required, like every other required field in the app.
    expect(label.querySelector(".required-field")).toHaveTextContent("*");
  });

  test("GitHub-flavoured Markdown such as strikethrough renders, via remark-gfm", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV1}
          agreed={false}
          onChange={vi.fn()}
          testIdPrefix="G"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByTestId("G-content").querySelector("del"),
    ).toHaveTextContent("Readers exempt.");
  });

  test("ticking and unticking report through onChange", async () => {
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV1}
          agreed={false}
          onChange={onChange}
          testIdPrefix="N"
        />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByTestId("N-agree"));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  test("a ticked box reports unticking", async () => {
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV1}
          agreed={true}
          onChange={onChange}
          testIdPrefix="N"
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("N-agree")).toBeChecked();
    await userEvent.click(screen.getByTestId("N-agree"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  test("invalid shows the complaint", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV1}
          agreed={false}
          onChange={vi.fn()}
          invalid
          testIdPrefix="N"
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("N-agree")).toHaveClass("is-invalid");
    expect(
      screen.getByText(
        "You must agree to the terms and conditions to continue.",
      ),
    ).toBeInTheDocument();
  });

  test("read-only shows the box ticked and disabled", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV1}
          agreed={true}
          onChange={vi.fn()}
          readOnly
          testIdPrefix="N"
        />
      </MemoryRouter>,
    );

    const box = screen.getByTestId("N-agree");
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  /** Issue #150: the fields are filled from the recruitment; without one, shown as written. */
  test("fills ${quarter} and ${primaryConsiderationDate} from fillIn, else shows them as written", () => {
    const notice = {
      ...noticesFixtures.taV2,
      content:
        "Apply for **${quarter}** by ${primaryConsiderationDate}. Not ${other}.",
    };
    const { rerender } = render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={notice}
          agreed={false}
          onChange={() => {}}
          fillIn={{ quarter: "20261", primaryConsiderationDate: "2026-01-20" }}
        />
      </MemoryRouter>,
    );
    const content = screen.getByTestId("NoticeAgreement-content");
    expect(content).toHaveTextContent(
      "Apply for Winter 2026 by January 20, 2026. Not ${other}.",
    );
    expect(content.querySelector("strong")).toHaveTextContent("Winter 2026");

    rerender(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={notice}
          agreed={false}
          onChange={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("NoticeAgreement-content")).toHaveTextContent(
      "Apply for ${quarter} by ${primaryConsiderationDate}. Not ${other}.",
    );
  });

  test("uses NoticeAgreement as the default test id prefix", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV1}
          agreed={false}
          onChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("NoticeAgreement-agree")).toBeInTheDocument();
  });

  test("the version line is flush right and links to the Help section for the kind of application (issue #325)", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="TA"
          notice={noticesFixtures.taV2}
          agreed={false}
          onChange={vi.fn()}
          testIdPrefix="N"
        />
      </MemoryRouter>,
    );
    const line = screen.getByTestId("N-version");
    expect(line).toHaveClass("text-end");
    expect(line).toHaveTextContent(
      "Version 2, saved 2/3/2026, 4:05:06 AM (what is this?)",
    );
    const link = screen.getByRole("link", { name: "what is this?" });
    expect(link).toHaveAttribute(
      "href",
      "/help/ta-applicants#notices-terms-and-conditions",
    );
    expect(link).not.toHaveAttribute("target");
    expect(screen.getByTestId("N-version-help")).toBe(link);
  });

  test("a ULA application links to the ULA Help page", () => {
    render(
      <MemoryRouter>
        <NoticeAgreement
          type="ULA"
          notice={noticesFixtures.ulaV1}
          agreed={false}
          onChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "what is this?" })).toHaveAttribute(
      "href",
      "/help/ula-applicants#notices-terms-and-conditions",
    );
    expect(noticesHelpPath("TA")).toBe(
      "/help/ta-applicants#notices-terms-and-conditions",
    );
  });
});
