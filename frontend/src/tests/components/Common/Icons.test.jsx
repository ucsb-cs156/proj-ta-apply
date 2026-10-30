import { render } from "@testing-library/react";
import {
  GraphIcon,
  UserListIcon,
  InfoIcon,
  WarningIcon,
} from "main/components/Common/Icons";

describe("Icons tests", () => {
  /** Issue #148: the red warning triangle on the ULA course table. */
  describe("WarningIcon", () => {
    test("WarningIcon is a 16px currentColor Bootstrap icon, hidden from readers by default", () => {
      const { container } = render(<WarningIcon />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("height", "16");
      expect(svg).toHaveAttribute("fill", "currentColor");
      expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg.querySelector("path")).toBeInTheDocument();
    });

    test("WarningIcon takes extra props, and aria-hidden can be lifted for a labelled one", () => {
      const { container } = render(
        <WarningIcon
          className="text-danger"
          role="img"
          aria-hidden={undefined}
          aria-label="Warning"
        />,
      );
      const svg = container.querySelector("svg");

      expect(svg).toHaveClass("text-danger");
      expect(svg).toHaveAttribute("role", "img");
      expect(svg).toHaveAttribute("aria-label", "Warning");
      expect(svg).not.toHaveAttribute("aria-hidden");
    });
  });

  describe("GraphIcon", () => {
    test("GraphIcon renders an svg with the expected default attributes", () => {
      const { container } = render(<GraphIcon />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
      expect(svg).toHaveAttribute("fill", "#000000");
      expect(svg).toHaveAttribute("viewBox", "0 0 256 256");
      expect(svg.querySelector("path")).toBeInTheDocument();
    });

    test("GraphIcon accepts and applies additional props, overriding defaults", () => {
      const { container } = render(
        <GraphIcon data-testid="graph-icon" width="64" className="my-icon" />,
      );
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("data-testid", "graph-icon");
      expect(svg).toHaveAttribute("width", "64");
      expect(svg).toHaveClass("my-icon");
      // height should still fall back to the component default
      expect(svg).toHaveAttribute("height", "32");
    });
  });
  describe("UserListIcon", () => {
    test("UserListIcon renders an svg with the expected default attributes", () => {
      const { container } = render(<UserListIcon />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
      expect(svg).toHaveAttribute("fill", "#000000");
      expect(svg).toHaveAttribute("viewBox", "0 0 256 256");
      expect(svg.querySelector("path")).toBeInTheDocument();
    });

    test("UserListIcon accepts and applies additional props, overriding defaults", () => {
      const { container } = render(
        <UserListIcon data-testid="user-list-icon" fill="#ff0000" />,
      );
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("data-testid", "user-list-icon");
      expect(svg).toHaveAttribute("fill", "#ff0000");
    });
  });

  describe("InfoIcon", () => {
    test("InfoIcon renders an svg with the expected default attributes", () => {
      const { container } = render(<InfoIcon />);
      const svg = container.querySelector("svg");

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
      expect(svg).toHaveAttribute("fill", "#000000");
      expect(svg).toHaveAttribute("viewBox", "0 0 256 256");
      expect(svg.querySelector("path")).toBeInTheDocument();
    });

    test("InfoIcon accepts and applies additional props, overriding defaults", () => {
      const { container } = render(
        <InfoIcon data-testid="info-icon" fill="#00ff00" />,
      );
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("data-testid", "info-icon");
      expect(svg).toHaveAttribute("fill", "#00ff00");
    });
  });
});
