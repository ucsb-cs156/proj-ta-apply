import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import CopySoftOfferEmails from "main/components/SoftOffers/CopySoftOfferEmails";
import softOfferResultsFixtures from "fixtures/softOfferResultsFixtures";

const mockToast = vi.fn();
vi.mock("react-toastify", async (importOriginal) => ({
  ...(await importOriginal()),
  toast: (x) => mockToast(x),
}));

// Grace answered for another lecture (no response for this one), Ada proceeded, Alan has not answered.
const { three } = softOfferResultsFixtures;
const P = "C";

const button = (id) => screen.getByTestId(`${P}-${id}`);

describe("CopySoftOfferEmails tests (issue #511)", () => {
  let writeText;

  beforeEach(() => {
    mockToast.mockClear();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
  });

  test("the label and the four buttons, each with the copy icon, in order", () => {
    render(<CopySoftOfferEmails rows={three.rows} testIdPrefix={P} />);

    const line = screen.getByTestId(P);
    expect(line).toHaveClass(
      "d-flex",
      "flex-wrap",
      "align-items-center",
      "gap-2",
      "mb-2",
    );
    expect(screen.getByTestId(`${P}-label`)).toHaveTextContent(
      "Copy Soft Offer Emails:",
    );
    const buttons = [...line.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent.trim())).toEqual([
      "All",
      'Responded "Proceed"',
      'Responded "Declined"',
      "No Response",
    ]);
    expect(buttons.map((b) => b.dataset.testid)).toEqual([
      `${P}-all`,
      `${P}-proceed`,
      `${P}-declined`,
      `${P}-none`,
    ]);
    for (const b of buttons) {
      expect(b).toHaveClass("btn", "btn-outline-primary", "btn-sm");
      expect(b.querySelector("svg[data-testid='copy-icon']")).not.toBeNull();
    }
  });

  test("All copies every assigned ULA's email, one per line, in the table's order", async () => {
    render(<CopySoftOfferEmails rows={three.rows} testIdPrefix={P} />);

    expect(button("all")).toBeEnabled();
    await userEvent.click(button("all"));
    expect(writeText).toHaveBeenCalledWith(
      "grace@ucsb.edu\nada@ucsb.edu\nalan@ucsb.edu",
    );
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("3 emails copied to clipboard."),
    );
  });

  test('Responded "Proceed" copies only the answers for the lecture now held', async () => {
    render(<CopySoftOfferEmails rows={three.rows} testIdPrefix={P} />);

    await userEvent.click(button("proceed"));
    expect(writeText).toHaveBeenCalledWith("ada@ucsb.edu");
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("1 email copied to clipboard."),
    );
  });

  test("No Response includes a stale answer for another lecture; nobody declined, so that button is disabled", async () => {
    render(<CopySoftOfferEmails rows={three.rows} testIdPrefix={P} />);

    expect(button("declined")).toBeDisabled();
    await userEvent.click(button("none"));
    expect(writeText).toHaveBeenCalledWith("grace@ucsb.edu\nalan@ucsb.edu");
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("2 emails copied to clipboard."),
    );
  });

  test("a declined answer goes to the Declined button", async () => {
    const rows = [
      three.rows[1],
      [...three.rows[2].slice(0, 12), "Declined", "2025-10-23T10:30", "No"],
    ];
    render(<CopySoftOfferEmails rows={rows} testIdPrefix={P} />);

    expect(button("none")).toBeDisabled();
    await userEvent.click(button("declined"));
    expect(writeText).toHaveBeenCalledWith("alan@ucsb.edu");
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith("1 email copied to clipboard."),
    );
  });

  test("with no rows every button is disabled and nothing is copied", () => {
    render(<CopySoftOfferEmails rows={[]} testIdPrefix={P} />);

    for (const id of ["all", "proceed", "declined", "none"]) {
      expect(button(id)).toBeDisabled();
    }
    expect(writeText).not.toHaveBeenCalled();
  });

  test("a browser that refuses the clipboard gets the failure toast", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopySoftOfferEmails rows={three.rows} testIdPrefix={P} />);

    await userEvent.click(button("all"));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Unable to copy to clipboard. Check your browser clipboard permissions.",
      ),
    );
  });

  test("uses CopySoftOfferEmails as the default test id prefix", () => {
    render(<CopySoftOfferEmails rows={three.rows} />);
    expect(screen.getByTestId("CopySoftOfferEmails-all")).toBeInTheDocument();
  });
});
