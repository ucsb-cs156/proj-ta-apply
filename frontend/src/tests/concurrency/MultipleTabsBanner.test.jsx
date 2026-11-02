import { render, screen } from "@testing-library/react";
import MultipleTabsBanner from "main/concurrency/MultipleTabsBanner";

describe("MultipleTabsBanner", () => {
  test("warns, in the agreed words, about the thing named", () => {
    render(<MultipleTabsBanner noun="application" />);

    expect(screen.getByTestId("MultipleTabsBanner")).toHaveTextContent(
      "The server has detected multiple tabs or windows open on the same application. Please know that this is risky; we recommend closing all but one of these.",
    );
  });

  test("names whatever it is told to", () => {
    render(<MultipleTabsBanner noun="budget" />);

    expect(screen.getByTestId("MultipleTabsBanner")).toHaveTextContent(
      "open on the same budget. Please know",
    );
  });

  test("is an alert, so that it is announced, and a warning, so that it looks like one", () => {
    render(<MultipleTabsBanner noun="application" />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveClass("alert", "alert-warning");
  });

  test("takes the test id it is given", () => {
    render(<MultipleTabsBanner noun="application" testId="mine" />);

    expect(screen.getByTestId("mine")).toBeInTheDocument();
    expect(screen.queryByTestId("MultipleTabsBanner")).toBeNull();
  });
});
