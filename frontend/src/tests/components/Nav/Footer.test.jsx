import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Footer from "main/components/Nav/Footer";

describe("Footer tests", () => {
  test("renders correctly", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    const aboutLink = screen.getByRole("link", { name: "About TA Apply" });
    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink).toHaveAttribute("href", "/about");
  });
});
