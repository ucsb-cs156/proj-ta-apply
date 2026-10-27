import { render, screen } from "@testing-library/react";
import TestOnlyBanner from "main/components/Common/TestOnlyBanner";

describe("TestOnlyBanner tests", () => {
  test("says, loudly, that this is a test", () => {
    render(<TestOnlyBanner />);

    const banner = screen.getByTestId("TestOnlyBanner");
    expect(banner).toHaveTextContent("This is a test only");
    expect(banner).toHaveAttribute("role", "alert");
    // The colour is the whole point: nothing else in the app is orange.
    expect(banner).toHaveStyle({
      backgroundColor: "#ff6f00",
      color: "#ffffff",
    });
    // jsdom does not resolve rem/em units, so check the declared values directly.
    expect(banner.style.fontSize).toBe("1.25rem");
    expect(banner.style.letterSpacing).toBe("0.05em");
  });
});
