import { render, screen } from "@testing-library/react";

import InterestMark from "main/components/Common/InterestMark";
import InterestLegend from "main/components/Common/InterestLegend";

describe("InterestMark tests", () => {
  test("a first choice is a large numbered mark with its meaning", () => {
    render(<InterestMark preference="1st Choice" testId="mark" />);
    const mark = screen.getByTestId("mark");
    expect(mark).toHaveTextContent("➊");
    // Issue #415: the 120% size is a class in index.css, not an inline style.
    expect(mark).toHaveClass("me-1", "interest-mark-large");
    expect(mark).not.toHaveAttribute("style");
    expect(mark).toHaveAttribute("role", "img");
    expect(mark).toHaveAttribute("aria-label", "Applicant's 1st choice");
    expect(mark).toHaveAttribute("title", "Applicant's 1st choice");
  });

  test("a second choice is ➋, also large", () => {
    render(<InterestMark preference="2nd Choice" testId="mark" />);
    expect(screen.getByTestId("mark")).toHaveTextContent("➋");
    expect(screen.getByTestId("mark")).toHaveClass("interest-mark-large");
  });

  test("the other levels are ordinary-sized symbols", () => {
    const { unmount } = render(
      <InterestMark preference="Enthusiastic" testId="mark" />,
    );
    expect(screen.getByTestId("mark")).toHaveTextContent("✓");
    expect(screen.getByTestId("mark")).toHaveClass("me-1");
    expect(screen.getByTestId("mark")).not.toHaveClass("interest-mark-large");
    expect(screen.getByTestId("mark")).not.toHaveAttribute("style");
    unmount();
    render(<InterestMark preference="Would Consider" testId="mark" />);
    expect(screen.getByTestId("mark")).toHaveTextContent("▬");
    expect(screen.getByTestId("mark")).toHaveAttribute(
      "title",
      "Applicant would consider this course",
    );
  });

  test("no preference is the not-interested cross, and the test id is optional", () => {
    render(<InterestMark preference={null} />);
    const mark = screen.getByRole("img", {
      name: "Applicant marked this course Not Interested/Not Applicable",
    });
    expect(mark).toHaveTextContent("✖");
    expect(mark).not.toHaveAttribute("data-testid");
  });
});

describe("InterestLegend tests", () => {
  test("lists the five levels in order with swatch, symbol and label", () => {
    render(<InterestLegend testIdPrefix="L" />);
    const legend = screen.getByTestId("L");
    expect(legend).toHaveAttribute("aria-label", "Interest legend");
    expect(legend).toHaveClass("list-inline", "small", "mb-2");
    const items = [...legend.querySelectorAll("li")];
    expect(items[0]).toHaveTextContent("Applicant's interest:");
    expect(items[0]).toHaveClass("fw-bold");
    expect(items.slice(1).map((li) => li.textContent)).toEqual([
      "➊1st choice",
      "➋2nd choice",
      "✓Enthusiastic",
      "▬Would Consider",
      "✖Not Interested/Not Applicable",
    ]);
    // Issue #415: each swatch's colour is a class in index.css, not an inline style.
    expect(screen.getByTestId("L-1stChoice")).toHaveClass(
      "candidate-course-rank-enthusiastic",
    );
    expect(screen.getByTestId("L-2ndChoice")).toHaveClass(
      "candidate-course-rank-enthusiastic",
    );
    expect(screen.getByTestId("L-Enthusiastic")).toHaveClass(
      "candidate-course-rank-enthusiastic",
    );
    expect(screen.getByTestId("L-WouldConsider")).toHaveClass(
      "candidate-course-rank-would-consider",
    );
    expect(screen.getByTestId("L-NotInterested")).toHaveClass(
      "list-inline-item",
      "px-2",
      "rounded",
      "candidate-course-rank-not-applicable",
    );
    expect(screen.getByTestId("L-NotInterested")).not.toHaveAttribute("style");
  });

  test("has a default test id prefix", () => {
    render(<InterestLegend />);
    expect(screen.getByTestId("InterestLegend")).toBeInTheDocument();
    expect(screen.getByTestId("InterestLegend-1stChoice")).toBeInTheDocument();
  });
});
