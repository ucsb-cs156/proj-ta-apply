import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import NoticeAgreement from "main/components/Notices/NoticeAgreement";
import noticesFixtures from "fixtures/noticesFixtures";

describe("NoticeAgreement tests", () => {
  test("renders nothing at all without a notice", () => {
    const { container } = render(
      <NoticeAgreement notice={null} agreed={false} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();

    const { container: c2 } = render(
      <NoticeAgreement notice={undefined} agreed={false} onChange={vi.fn()} />,
    );
    expect(c2).toBeEmptyDOMElement();
  });

  test("shows the text as rendered Markdown, the version, and the required box", () => {
    render(
      <NoticeAgreement
        notice={noticesFixtures.taV2}
        agreed={false}
        onChange={vi.fn()}
        testIdPrefix="N"
      />,
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
      `Version 2, saved ${new Date("2026-02-03T04:05:06").toLocaleString()}`,
    );

    const box = screen.getByTestId("N-agree");
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).not.toBeChecked();
    expect(box).toBeEnabled();
    expect(box).not.toHaveClass("is-invalid");
    expect(
      screen.getByLabelText(
        "I have read and understood the text above, and I agree to the terms and conditions it specifies",
      ),
    ).toBe(box);
  });

  test("GitHub-flavoured Markdown such as strikethrough renders, via remark-gfm", () => {
    render(
      <NoticeAgreement
        notice={noticesFixtures.taV1}
        agreed={false}
        onChange={vi.fn()}
        testIdPrefix="G"
      />,
    );
    expect(
      screen.getByTestId("G-content").querySelector("del"),
    ).toHaveTextContent("Readers exempt.");
  });

  test("ticking and unticking report through onChange", async () => {
    const onChange = vi.fn();
    render(
      <NoticeAgreement
        notice={noticesFixtures.taV1}
        agreed={false}
        onChange={onChange}
        testIdPrefix="N"
      />,
    );

    await userEvent.click(screen.getByTestId("N-agree"));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  test("a ticked box reports unticking", async () => {
    const onChange = vi.fn();
    render(
      <NoticeAgreement
        notice={noticesFixtures.taV1}
        agreed={true}
        onChange={onChange}
        testIdPrefix="N"
      />,
    );

    expect(screen.getByTestId("N-agree")).toBeChecked();
    await userEvent.click(screen.getByTestId("N-agree"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  test("invalid shows the complaint", () => {
    render(
      <NoticeAgreement
        notice={noticesFixtures.taV1}
        agreed={false}
        onChange={vi.fn()}
        invalid
        testIdPrefix="N"
      />,
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
      <NoticeAgreement
        notice={noticesFixtures.taV1}
        agreed={true}
        onChange={vi.fn()}
        readOnly
        testIdPrefix="N"
      />,
    );

    const box = screen.getByTestId("N-agree");
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
  });

  test("uses NoticeAgreement as the default test id prefix", () => {
    render(
      <NoticeAgreement
        notice={noticesFixtures.taV1}
        agreed={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("NoticeAgreement-agree")).toBeInTheDocument();
  });
});
