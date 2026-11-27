import { render, screen } from "@testing-library/react";
import CopyIcon from "main/components/Common/CopyIcon";

describe("CopyIcon tests", () => {
  test("renders Bootstrap's clipboard icon, hidden from screen readers", () => {
    render(<CopyIcon />);
    const icon = screen.getByTestId("copy-icon");
    expect(icon.tagName).toBe("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveAttribute("width", "16");
    expect(icon).toHaveAttribute("height", "16");
    expect(icon).toHaveAttribute("fill", "currentColor");
    expect(icon).toHaveAttribute("viewBox", "0 0 16 16");
    expect(icon.querySelectorAll("path")).toHaveLength(2);
  });
});
