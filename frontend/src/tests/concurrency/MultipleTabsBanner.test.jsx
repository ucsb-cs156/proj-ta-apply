import { render, screen } from "@testing-library/react";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

const RISK =
  "Please know that this is risky; we recommend closing all but one of these.";
const you = { label: "me@example.org (Me)", samePerson: true };
const phill = { label: "phtcon@ucsb.edu (Phill Conrad)", samePerson: false };

describe("MultipleTabsBanner", () => {
  test("shows nothing when no one else is editing", () => {
    const { container } = render(
      <MultipleTabsBanner others={[]} noun="page" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("says that the user is editing in another tab, then that it is risky", () => {
    render(<MultipleTabsBanner others={[you]} noun="application" />);

    expect(screen.getByTestId("MultipleTabsBanner")).toHaveTextContent(
      `You are also editing this application in another tab or window. ${RISK}`,
    );
  });

  test("names one other person, then says that it is risky", () => {
    render(<MultipleTabsBanner others={[phill]} noun="page" />);

    expect(screen.getByTestId("MultipleTabsBanner")).toHaveTextContent(
      `phtcon@ucsb.edu (Phill Conrad) is also editing this page. ${RISK}`,
    );
  });

  test("names the user and another person", () => {
    render(<MultipleTabsBanner others={[you, phill]} noun="page" />);

    expect(screen.getByTestId("MultipleTabsBanner")).toHaveTextContent(
      `You and phtcon@ucsb.edu (Phill Conrad) are also editing this page in other windows or tabs. ${RISK}`,
    );
  });

  test("counts the people beyond the third", () => {
    const crowd = ["A", "B", "C", "D", "E"].map((label) => ({
      label,
      samePerson: false,
    }));
    render(<MultipleTabsBanner others={crowd} noun="budget" />);

    expect(screen.getByTestId("MultipleTabsBanner")).toHaveTextContent(
      `A, B, C and 2 others are also editing this budget. ${RISK}`,
    );
  });

  test("shows a name as text, never as markup", () => {
    const sneaky = {
      label: '<img src=x onerror="alert(1)"> <b>bold</b>',
      samePerson: false,
    };
    render(<MultipleTabsBanner others={[sneaky]} noun="page" />);

    const banner = screen.getByTestId("MultipleTabsBanner");
    expect(banner.textContent).toContain(
      '<img src=x onerror="alert(1)"> <b>bold</b>',
    );
    expect(banner.querySelector("img")).toBeNull();
    expect(banner.querySelector("b")).toBeNull();
  });

  test("a long name wraps instead of widening the page", () => {
    const long = { label: "x".repeat(300), samePerson: false };
    render(<MultipleTabsBanner others={[long]} noun="page" />);

    const banner = screen.getByTestId("MultipleTabsBanner");
    expect(banner.textContent).toContain("x".repeat(300));
    expect(banner).toHaveStyle({ overflowWrap: "anywhere" });
  });

  test("is an alert, so that it is announced, and a warning, so that it looks like one", () => {
    render(<MultipleTabsBanner others={[you]} noun="page" />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("alert", "alert-warning");
  });

  test("a picture of it, as in the Help, is not announced", () => {
    render(<MultipleTabsBanner others={[you]} noun="page" announce={false} />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("MultipleTabsBanner")).toHaveClass(
      "alert",
      "alert-warning",
    );
  });

  test("takes the test id it is given", () => {
    render(<MultipleTabsBanner others={[you]} noun="page" testId="mine" />);

    expect(screen.getByTestId("mine")).toBeInTheDocument();
    expect(screen.queryByTestId("MultipleTabsBanner")).toBeNull();
  });
});
